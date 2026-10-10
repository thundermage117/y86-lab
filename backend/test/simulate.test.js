// End-to-end: assemble examples, run both Verilog CPUs, check the mapped
// cycles show the hazards each example is designed to demonstrate.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { simulateSource } from '../src/sim/runner.js';
import { PROGRAMS_DIR } from '../src/config.js';

const results = new Map();
async function sim(id) {
  if (!results.has(id)) {
    const source = readFileSync(join(PROGRAMS_DIR, `${id}.ys`), 'utf8');
    results.set(id, await simulateSource(source, { maxCycles: 3000 }));
  }
  return results.get(id);
}

const count = (cycles, pred) => cycles.filter(pred).length;

test('sum_1_to_100: 609 pipelined vs 603 sequential cycles, same result', async () => {
  const { modes } = await sim('01_sum_1_to_100');
  const { pipelined, sequential } = modes;
  assert.equal(pipelined.total, 609);
  assert.equal(sequential.total, 603);
  assert.equal(pipelined.retired, 603);
  assert.equal(pipelined.status.statName, 'HLT');
  const last = (m) => m.cycles.at(-1).registers.rax;
  assert.equal(last(pipelined), '0x00000000000013ba');
  assert.equal(last(sequential), '0x00000000000013ba');
  // Only the final, not-taken jge is mispredicted.
  assert.equal(count(pipelined.cycles, (c) => c.control.mispredict), 1);
});

test('load_use: exactly one load/use stall, then forwarding from m_valM', async () => {
  const { pipelined } = (await sim('03_load_use')).modes;
  const stalls = pipelined.cycles.filter((c) => c.control.loadUse);
  assert.equal(stalls.length, 1);
  const i = stalls[0].cycle; // 1-based; next cycle is index i
  const next = pipelined.cycles[i];
  assert.equal(next.stages.execute.bubble, true, 'bubble injected into Execute');
  assert.equal(next.stages.decode.text, 'addq %rax, %rax');
  assert.equal(next.stages.decode.fwdA, 'm_valM');
  assert.equal(next.stages.decode.uid, stalls[0].stages.decode.uid, 'Decode held the same instruction');
});

test('branch_mispredict: one misprediction squashes two instructions', async () => {
  const { program, modes: { pipelined } } = await sim('04_branch_mispredict');
  const mis = pipelined.cycles.filter((c) => c.control.mispredict);
  assert.equal(mis.length, 1);
  assert.equal(mis[0].stages.execute.text, `jne 0x${program.symbols.wrong.toString(16)}`);
  const after = pipelined.cycles[mis[0].cycle];
  assert.equal(after.stages.decode.bubble, true);
  assert.equal(after.stages.execute.bubble, true);
  assert.equal(after.stages.fetch.text, 'irmovq $1, %rcx');
  assert.equal(pipelined.cycles.at(-1).registers.rcx, '0x0000000000000001');
});

test('call_ret: ret stalls fetch for three cycles', async () => {
  const { pipelined } = (await sim('05_call_ret')).modes;
  assert.equal(count(pipelined.cycles, (c) => c.control.retHazard), 3);
  assert.equal(pipelined.cycles.at(-1).registers.rax, '0x0000000000000015');
});

test('cmov_max: failed cmov has its destination cancelled in Execute', async () => {
  const { pipelined } = (await sim('06_cmov_max')).modes;
  const cmovg = pipelined.cycles.find((c) => c.stages.execute.text === 'cmovg %rsi, %rbx');
  assert.equal(cmovg.stages.execute.Cnd, false);
  assert.equal(cmovg.stages.execute.dstE, 3);
  assert.equal(cmovg.stages.execute.finalDstE, 15);
});

test('push_pop: memory changes report the stack words', async () => {
  const { pipelined, sequential } = (await sim('07_push_pop')).modes;
  for (const mode of [pipelined, sequential]) {
    assert.deepEqual(mode.memoryChanges.map((c) => [c.addr, c.after]), [
      [0xe8, '0x0000000000000003'], [0xf0, '0x0000000000000002'], [0xf8, '0x0000000000000001'],
    ]);
  }
});

test('bad_address: ADR stops both CPUs without committing later work', async () => {
  const { pipelined, sequential } = (await sim('09_bad_address')).modes;
  assert.equal(pipelined.status.statName, 'ADR');
  assert.equal(sequential.status.statName, 'ADR');
  assert.equal(pipelined.cycles.at(-1).registers.rax, '0x0000000000000001');
  assert.ok(pipelined.cycles.some((c) => c.control.exception));
});

test('sequential cycles carry source lines and decoded fields', async () => {
  const { program, modes } = await sim('05_call_ret');
  const call = modes.sequential.cycles.find((c) => c.text?.startsWith('call'));
  assert.equal(program.listing[call.line - 1].text.trim().startsWith('call triple'), true);
  assert.equal(call.memory.write, true);
});

test('assembly errors skip simulation', async () => {
  const result = await simulateSource('irmovq $1, %rax\nbogus\n', { maxCycles: 100 });
  assert.equal(result.program.ok, false);
  assert.equal(result.modes, undefined);
  assert.deepEqual(result.program.errors.map((e) => e.line), [2]);
});

test('runaway programs stop at maxCycles and report timedOut', async () => {
  const { modes } = await simulateSource('loop: jmp loop', { maxCycles: 50 });
  assert.equal(modes.pipelined.timedOut, true);
  assert.equal(modes.pipelined.total, 50);
  assert.equal(modes.sequential.timedOut, true);
});
