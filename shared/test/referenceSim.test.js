import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { assemble, run, STAT, REG_NAMES } from '../y86/index.js';

const PROGRAMS_DIR = new URL('../../programs/', import.meta.url).pathname;

function runProgram(file) {
  const out = assemble(readFileSync(join(PROGRAMS_DIR, file), 'utf8'));
  assert.deepEqual(out.errors, [], file);
  return run(out.memory);
}

function reg(result, name) {
  return result.state.regs[REG_NAMES.indexOf(name)];
}

const EXPECTED = {
  '01_sum_1_to_100.ys': { stat: STAT.HLT, regs: { rax: 5050n, rcx: 101n } },
  '02_array_sum.ys': { stat: STAT.HLT, regs: { rax: 0xabcdabcdabcdn, rsp: 0x200n } },
  '03_load_use.ys': { stat: STAT.HLT, regs: { rax: 142n, rcx: 100n } },
  '04_branch_mispredict.ys': { stat: STAT.HLT, regs: { rcx: 1n } },
  '05_call_ret.ys': { stat: STAT.HLT, regs: { rax: 21n, rbx: 21n, rsp: 0x100n } },
  '06_cmov_max.ys': { stat: STAT.HLT, regs: { rax: 42n, rbx: 0xffffffffffffffffn } },
  '07_push_pop.ys': { stat: STAT.HLT, regs: { rax: 3n, rbx: 2n, rcx: 1n, rsp: 0x100n } },
  '08_forwarding.ys': { stat: STAT.HLT, regs: { rax: 7n, rcx: 6n, rdx: 7n } },
  '09_bad_address.ys': { stat: STAT.ADR, regs: { rax: 1n, rcx: 0n } },
  '10_invalid_instruction.ys': { stat: STAT.INS, regs: { rax: 20n } },
};

test('every example program has an expectation', () => {
  const files = readdirSync(PROGRAMS_DIR).filter((f) => f.endsWith('.ys')).sort();
  assert.deepEqual(files, Object.keys(EXPECTED).sort());
});

for (const [file, want] of Object.entries(EXPECTED)) {
  test(`reference sim: ${file}`, () => {
    const result = runProgram(file);
    assert.equal(result.timedOut, false);
    assert.equal(result.state.stat, want.stat);
    for (const [name, value] of Object.entries(want.regs)) {
      assert.equal(reg(result, name), value, `%${name}`);
    }
  });
}

test('sum_1_to_100 executes 603 instructions including halt', () => {
  assert.equal(runProgram('01_sum_1_to_100.ys').steps, 603);
});

test('push/pop leaves the pushed words in memory', () => {
  const { state } = runProgram('07_push_pop.ys');
  assert.equal(state.mem[0xf8], 1);
  assert.equal(state.mem[0xf0], 2);
  assert.equal(state.mem[0xe8], 3);
});
