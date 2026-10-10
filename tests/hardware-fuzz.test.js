// Seeded random-program fuzzing: generates hazard-dense Y86 programs and
// checks the pipelined CPU against the reference simulator.
import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { assemble, run, hex64, MEM_SIZE, OP_NAMES, JUMP_NAMES, CMOV_NAMES } from '../shared/y86/index.js';

const HW = new URL('../hardware/', import.meta.url).pathname;
const PROGRAM_COUNT = Number(process.env.FUZZ_PROGRAMS ?? 40);
const SEED = Number(process.env.FUZZ_SEED ?? 0x5eed);

before(() => execFileSync('make', ['-C', HW, 'all'], { stdio: 'pipe' }));

function rng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// %rsp is the stack, %r14 is the data-region base; neither is a random destination.
const REGS = ['rax', 'rcx', 'rdx', 'rbx', 'rbp', 'rsi', 'rdi', 'r8', 'r9', 'r10', 'r11', 'r12', 'r13'];

function generate(rand, length) {
  const pick = (arr) => arr[Math.floor(rand() * arr.length)];
  const r = () => `%${pick(REGS)}`;
  const lines = ['irmovq $0x1800, %rsp', 'irmovq $0x1000, %r14'];
  let depth = 0;
  let label = 0;
  for (let i = 0; i < length; i += 1) {
    const k = rand();
    if (k < 0.18) lines.push(`irmovq $${Math.floor(rand() * 2000) - 1000}, ${r()}`);
    else if (k < 0.40) lines.push(`${pick(OP_NAMES)} ${r()}, ${r()}`);
    else if (k < 0.50) lines.push(`${pick(CMOV_NAMES)} ${r()}, ${r()}`);
    else if (k < 0.60) lines.push(`rmmovq ${r()}, ${8 * Math.floor(rand() * 16)}(%r14)`);
    else if (k < 0.72) lines.push(`mrmovq ${8 * Math.floor(rand() * 16)}(%r14), ${r()}`);
    else if (k < 0.78 && depth < 6) { lines.push(`pushq ${r()}`); depth += 1; }
    else if (k < 0.84 && depth > 0) { lines.push(`popq ${r()}`); depth -= 1; }
    else if (k < 0.92) {
      // forward conditional jump over 0-2 instructions
      const target = `L${label++}`;
      lines.push(`${pick(JUMP_NAMES)} ${target}`);
      for (let j = Math.floor(rand() * 3); j > 0; j -= 1) lines.push(`irmovq $${j}, ${r()}`);
      lines.push(`${target}:`);
    } else if (k < 0.96) lines.push('call fn');
    else lines.push('nop');
  }
  lines.push('halt', 'fn:', `addq ${r()}, ${r()}`, `mrmovq 0(%r14), ${r()}`, 'ret');
  return lines.join('\n');
}

function runHardware(hex) {
  const dir = mkdtempSync(join(tmpdir(), 'y86-fuzz-'));
  try {
    writeFileSync(join(dir, 'p.hex'), hex);
    const out = execFileSync('vvp', ['-n', join(HW, 'build', 'proc.vvp'), `+program=${join(dir, 'p.hex')}`,
      `+vcd=${join(dir, 't.vcd')}`, `+memdump=${join(dir, 'm.hex')}`, '+max_cycles=20000'], { encoding: 'utf8' });
    const mem = new Uint8Array(MEM_SIZE);
    readFileSync(join(dir, 'm.hex'), 'utf8').split('\n').filter((l) => l && !l.startsWith('//'))
      .forEach((l, i) => { mem[i] = parseInt(l, 16); });
    return {
      stat: Number(/STATUS stat=(\d+)/.exec(out)[1]),
      regs: /REGS ((?:[0-9a-f]{16} ?){15})/.exec(out)[1].trim().split(' ').map((h) => hex64(BigInt('0x' + h))),
      cc: /CC ([01]{3})/.exec(out)[1],
      mem,
    };
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

test(`pipeline matches reference on ${PROGRAM_COUNT} random programs (seed ${SEED})`, () => {
  const rand = rng(SEED);
  for (let n = 0; n < PROGRAM_COUNT; n += 1) {
    const src = generate(rand, 40 + Math.floor(rand() * 40));
    const asm = assemble(src);
    assert.deepEqual(asm.errors, [], src);
    const ref = run(asm.memory, { maxSteps: 20000 });
    const hw = runHardware(asm.hex);
    const ctx = `program #${n}:\n${src}`;
    assert.equal(hw.stat, ref.state.stat, `status — ${ctx}`);
    assert.deepEqual(hw.regs, ref.state.regs.map(hex64), `registers — ${ctx}`);
    assert.equal(hw.cc, `${+ref.state.cc.of}${+ref.state.cc.sf}${+ref.state.cc.zf}`, `cc — ${ctx}`);
    assert.ok(hw.mem.every((b, i) => b === ref.state.mem[i]), `memory — ${ctx}`);
  }
});
