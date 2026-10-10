// Runs every example program on both Verilog CPUs and checks the final
// architectural state (status, registers, CC, memory) against the JS reference
// simulator. Requires Icarus Verilog; builds via `make -C hardware`.
import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, readdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { assemble, run, hex64, MEM_SIZE } from '../shared/y86/index.js';

const ROOT = new URL('..', import.meta.url).pathname;
const HW = join(ROOT, 'hardware');
const PROGRAMS = join(ROOT, 'programs');

before(() => {
  execFileSync('make', ['-C', HW, 'all'], { stdio: 'pipe' });
});

function simulate(cpu, hex) {
  const dir = mkdtempSync(join(tmpdir(), 'y86-xcheck-'));
  try {
    writeFileSync(join(dir, 'prog.hex'), hex);
    const stdout = execFileSync('vvp', [
      '-n', join(HW, 'build', `${cpu}.vvp`),
      `+program=${join(dir, 'prog.hex')}`,
      `+vcd=${join(dir, 'trace.vcd')}`,
      `+memdump=${join(dir, 'mem.hex')}`,
      '+max_cycles=5000',
    ], { encoding: 'utf8' });
    const stat = Number(/STATUS stat=(\d+) cycles=(\d+)/.exec(stdout)[1]);
    const cycles = Number(/STATUS stat=\d+ cycles=(\d+)/.exec(stdout)[1]);
    const regs = /REGS ((?:[0-9a-f]{16} ?){15})/.exec(stdout)[1].trim().split(' ').map((h) => BigInt('0x' + h));
    const cc = /CC ([01]{3})/.exec(stdout)[1];
    const mem = new Uint8Array(MEM_SIZE);
    readFileSync(join(dir, 'mem.hex'), 'utf8').split('\n')
      .filter((l) => l && !l.startsWith('//'))
      .forEach((l, i) => { mem[i] = parseInt(l, 16); });
    return { stat, cycles, regs, cc, mem, timedOut: /TIMEOUT/.test(stdout) };
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

const files = readdirSync(PROGRAMS).filter((f) => f.endsWith('.ys')).sort();

for (const file of files) {
  const asm = assemble(readFileSync(join(PROGRAMS, file), 'utf8'));
  const ref = run(asm.memory);
  const refCC = `${+ref.state.cc.of}${+ref.state.cc.sf}${+ref.state.cc.zf}`;

  for (const cpu of ['seq', 'proc']) {
    test(`${cpu}: ${file} matches reference`, () => {
      assert.deepEqual(asm.errors, []);
      const hw = simulate(cpu, asm.hex);
      assert.equal(hw.timedOut, false, 'simulation timed out');
      assert.equal(hw.stat, ref.state.stat, 'status');
      assert.deepEqual(hw.regs.map(hex64), ref.state.regs.map(hex64), 'registers');
      assert.equal(hw.cc, refCC, 'condition codes {OF,SF,ZF}');
      const diffs = [];
      for (let a = 0; a < MEM_SIZE; a += 1) if (hw.mem[a] !== ref.state.mem[a]) diffs.push(a);
      assert.deepEqual(diffs.slice(0, 8), [], 'memory bytes differ');
      if (cpu === 'seq') assert.equal(hw.cycles, ref.steps, 'SEQ runs one instruction per cycle');
    });
  }
}
