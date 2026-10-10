// Assembles a program and runs it on both Verilog CPUs (Icarus `vvp`), then
// maps the waveforms into per-cycle JSON. Each run gets its own temp
// directory; results are cached by program image.

import { execFile } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { assemble, MEM_SIZE, STAT_NAMES } from '../../../shared/y86/index.js';
import { parseVcd } from '../vcd/parser.js';
import { mapPipeline } from '../vcd/pipelineMapper.js';
import { mapSequential } from '../vcd/sequentialMapper.js';
import { BUILD_DIR, CACHE_ENTRIES, HARDWARE_DIR, SIM_TIMEOUT_MS } from '../config.js';

const execFileP = promisify(execFile);

export class SimulatorUnavailableError extends Error {
  constructor(detail) {
    super('The Verilog simulator could not be run. Install Icarus Verilog (`brew install icarus-verilog` '
      + 'or `sudo apt-get install iverilog`) and make sure `make`, `iverilog` and `vvp` are on your PATH.');
    this.detail = detail;
  }
}

const CPUS = {
  pipelined: { vvp: 'proc.vvp', clock: 'clock', map: mapPipeline },
  sequential: { vvp: 'seq.vvp', clock: 'clock', map: mapSequential },
};

// ---------------------------------------------------------------- build

let buildChain = Promise.resolve();

/** Run `make all` (a no-op when up to date). Calls are serialized. */
export function ensureBuilt() {
  const run = buildChain.then(async () => {
    try {
      await execFileP('make', ['-C', HARDWARE_DIR, 'all'], { timeout: 120_000 });
    } catch (err) {
      if (err.code === 'ENOENT' || /iverilog: (command )?not found|No such file/.test(err.stderr ?? '')) {
        throw new SimulatorUnavailableError(err.stderr || err.message);
      }
      throw new Error(`Hardware build failed:\n${(err.stderr || err.message).trim()}`);
    }
  });
  buildChain = run.catch(() => {});
  return run;
}

export async function simulatorVersion() {
  try {
    const { stdout } = await execFileP('iverilog', ['-V'], { timeout: 5000 });
    return stdout.split('\n')[0].trim();
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------- cache

const cache = new Map();

function cacheGet(key) {
  if (!cache.has(key)) return undefined;
  const value = cache.get(key);
  cache.delete(key);
  cache.set(key, value);
  return value;
}

function cacheSet(key, value) {
  cache.set(key, value);
  while (cache.size > CACHE_ENTRIES) cache.delete(cache.keys().next().value);
}

export function clearCache() {
  cache.clear();
}

// ---------------------------------------------------------------- run

function parseMemDump(text) {
  const mem = new Uint8Array(MEM_SIZE);
  let i = 0;
  for (const line of text.split('\n')) {
    const t = line.trim();
    if (!t || t.startsWith('//')) continue;
    if (t.startsWith('@')) { i = parseInt(t.slice(1), 16); continue; }
    mem[i] = parseInt(t, 16);
    i += 1;
  }
  return mem;
}

function wordAt(mem, addr) {
  let v = 0n;
  for (let k = 7; k >= 0; k -= 1) v = (v << 8n) | BigInt(mem[addr + k]);
  return '0x' + v.toString(16).padStart(16, '0');
}

/** 8-byte aligned words whose contents differ between two images. */
function memoryChanges(before, after) {
  const changes = [];
  for (let addr = 0; addr < MEM_SIZE; addr += 8) {
    let differs = false;
    for (let k = 0; k < 8; k += 1) if (before[addr + k] !== after[addr + k]) { differs = true; break; }
    if (differs) changes.push({ addr, before: wordAt(before, addr), after: wordAt(after, addr) });
  }
  return changes;
}

async function runCpu(mode, dir, program, maxCycles) {
  const cpu = CPUS[mode];
  const vcdPath = join(dir, `${mode}.vcd`);
  const memPath = join(dir, `${mode}.mem`);
  let stdout;
  try {
    ({ stdout } = await execFileP('vvp', [
      '-n', join(BUILD_DIR, cpu.vvp),
      `+program=${join(dir, 'program.hex')}`,
      `+vcd=${vcdPath}`,
      `+memdump=${memPath}`,
      `+max_cycles=${maxCycles}`,
    ], { timeout: SIM_TIMEOUT_MS, maxBuffer: 4 * 1024 * 1024 }));
  } catch (err) {
    if (err.code === 'ENOENT') throw new SimulatorUnavailableError(err.message);
    return { ok: false, error: `Simulation failed: ${(err.stderr || err.message).trim().split('\n')[0]}` };
  }

  const status = /STATUS stat=(\d+) cycles=(\d+)/.exec(stdout);
  const vcd = parseVcd(await readFile(vcdPath, 'utf8'), { clock: cpu.clock });
  const { cycles, retired } = cpu.map(vcd.samples, program);
  const finalMemory = parseMemDump(await readFile(memPath, 'utf8'));
  const stat = status ? Number(status[1]) : null;

  return {
    ok: true,
    total: cycles.length,
    retired,
    cpi: retired > 0 ? cycles.length / retired : null,
    timedOut: /TIMEOUT/.test(stdout),
    status: { stat, statName: stat === null ? null : STAT_NAMES[stat] },
    clock: {
      timescale: vcd.timescale,
      periodTicks: vcd.sampleTimes.length > 1 ? vcd.sampleTimes[1] - vcd.sampleTimes[0] : null,
    },
    memoryChanges: memoryChanges(program.memory, finalMemory),
    cycles,
  };
}

function programPayload(asm) {
  return {
    ok: asm.ok,
    errors: asm.errors,
    listing: asm.listing,
    symbols: asm.symbols,
    size: asm.size,
    pcToLine: asm.pcToLine,
    image: Buffer.from(asm.memory.subarray(0, asm.size)).toString('hex'),
  };
}

/** Assemble only. */
export function assembleSource(source) {
  return programPayload(assemble(source));
}

/**
 * Assemble and run on both CPUs.
 * @returns {Promise<{program: object, modes?: {pipelined: object, sequential: object}}>}
 */
export async function simulateSource(source, { maxCycles }) {
  const asm = assemble(source);
  const program = programPayload(asm);
  if (!asm.ok) return { program };

  const key = createHash('sha256').update(asm.hex).update(`:${maxCycles}`).digest('hex');
  const cached = cacheGet(key);
  if (cached) return { program, modes: cached };

  await ensureBuilt();
  const dir = await mkdtemp(join(tmpdir(), 'y86-sim-'));
  try {
    await writeFile(join(dir, 'program.hex'), asm.hex);
    const [pipelined, sequential] = await Promise.all(
      ['pipelined', 'sequential'].map((mode) => runCpu(mode, dir, asm, maxCycles)),
    );
    const modes = { pipelined, sequential };
    if (pipelined.ok && sequential.ok) cacheSet(key, modes);
    return { program, modes };
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}
