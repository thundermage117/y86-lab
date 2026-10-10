import { describe, expect, test } from 'vitest';
import loadUse from './__fixtures__/03_load_use.json';
import mispredict from './__fixtures__/04_branch_mispredict.json';
import callRet from './__fixtures__/05_call_ret.json';
import pushPop from './__fixtures__/07_push_pop.json';
import badAddress from './__fixtures__/09_bad_address.json';
import { explainPipelineCycle, explainSequentialCycle, cycleKinds, findHazard } from './hazards.js';
import { pipelineMetrics, timingModel } from './metrics.js';
import { buildTimeline } from './timeline.js';
import { collectWrites, interestingWords, memoryAt, readWord } from './memory.js';
import { formatWord, formatAddr, regLabel } from './format.js';

const pipe = (fixture) => fixture.modes.pipelined;

describe('format', () => {
  test('formats 64-bit words signed, unsigned and hex', () => {
    expect(formatWord('0xffffffffffffffff', 'dec')).toBe('-1');
    expect(formatWord('0xffffffffffffffff', 'dec', { signed: false })).toBe('18446744073709551615');
    expect(formatWord('0x00000000000013ba', 'hex')).toBe('0x13ba');
    expect(formatWord(null)).toBe('—');
    expect(formatAddr('0x0000000000000100')).toBe('0x100');
    expect(regLabel(4)).toBe('%rsp');
    expect(regLabel(15)).toBe('—');
  });
});

describe('hazard explanations', () => {
  test('load/use cycle is explained and found by navigation', () => {
    const cycles = pipe(loadUse).cycles;
    const i = findHazard(cycles, -1, 1, ['loadUse']);
    expect(i).toBe(3);
    const events = explainPipelineCycle(cycles[i]);
    const lu = events.find((e) => e.kind === 'loadUse');
    expect(lu.title).toBe('Load/use hazard on %rax');
    expect(lu.detail).toContain('`mrmovq 0(%rbx), %rax` in Execute');
    expect(lu.detail).toContain('`addq %rax, %rax` in Decode');
  });

  test('the stalled addq then gets %rax forwarded from m_valM', () => {
    const cycles = pipe(loadUse).cycles;
    const events = explainPipelineCycle(cycles[4], 'dec');
    const fwd = events.filter((e) => e.kind === 'forward');
    expect(fwd.map((e) => e.title)).toEqual([
      'Forward %rax → valA from Memory',
      'Forward %rax → valB from Memory',
    ]);
    expect(fwd[0].detail).toContain('%rax = 21');
    expect(cycleKinds(cycles[4]).has('forward')).toBe(true);
  });

  test('misprediction names the squashed instructions and the fall-through address', () => {
    const cycles = pipe(mispredict).cycles;
    const i = findHazard(cycles, -1, 1, ['mispredict']);
    const ev = explainPipelineCycle(cycles[i], 'hex').find((e) => e.kind === 'mispredict');
    expect(ev.detail).toMatch(/squashed/);
    expect(ev.detail).toContain('(Fetch)');
    expect(ev.detail).toMatch(/fall-through address 0x1f/);
  });

  test('ret stall cycles are explained, then fetch resumes from W_valM', () => {
    const cycles = pipe(callRet).cycles;
    const retCycles = cycles.filter((c) => c.control.retHazard);
    expect(retCycles).toHaveLength(3);
    for (const c of retCycles) expect(explainPipelineCycle(c).some((e) => e.kind === 'ret')).toBe(true);
    const resume = cycles.find((c) => explainPipelineCycle(c).some((e) => e.title === 'Fetch resumes at the return address'));
    expect(resume).toBeTruthy();
  });

  test('exceptions are explained in Memory and Write-back', () => {
    const cycles = pipe(badAddress).cycles;
    const all = cycles.flatMap((c) => explainPipelineCycle(c));
    expect(all.some((e) => e.title === 'Invalid memory address')).toBe(true);
    expect(all.some((e) => e.title === 'Exception ADR in Write-back')).toBe(true);
  });

  test('sequential cycles get a per-instruction explanation', () => {
    const seq = mispredict.modes.sequential.cycles;
    const jne = seq.find((c) => c.text.startsWith('jne'));
    expect(explainSequentialCycle(jne).map((e) => e.title)).toContain('Jump not taken');
  });
});

describe('metrics', () => {
  test('CPI decomposition adds up to total cycles', () => {
    for (const fixture of [loadUse, mispredict, callRet]) {
      const m = pipelineMetrics(pipe(fixture));
      const sum = m.retired + m.penalties.loadUse + m.penalties.mispredict + m.penalties.ret + m.fill;
      expect(sum).toBe(m.total);
    }
    const lu = pipelineMetrics(pipe(loadUse));
    expect(lu.counts.loadUse).toBe(1);
    expect(lu.fill).toBe(4);
    expect(pipelineMetrics(pipe(mispredict)).penalties.mispredict).toBe(2);
    expect(pipelineMetrics(pipe(callRet)).penalties.ret).toBe(3);
  });

  test('timing model compares clock periods', () => {
    const t = timingModel({ fetch: 300, decode: 200, execute: 250, memory: 300, writeback: 100, register: 20 }, 609, 603);
    expect(t.seqPeriod).toBe(1150);
    expect(t.pipePeriod).toBe(320);
    expect(t.speedup).toBeCloseTo((1150 * 603) / (320 * 609));
    expect(t.bottleneck).toBe('fetch');
  });
});

describe('timeline', () => {
  test('shows the staircase, the load/use repeat and no squashed rows', () => {
    const rows = buildTimeline(pipe(loadUse).cycles);
    const addq = rows.find((r) => r.text === 'addq %rax, %rax');
    const letters = Object.values(addq.cells).map((c) => c.letter + (c.repeat ? '*' : ''));
    expect(letters).toEqual(['F', 'D', 'D*', 'E', 'M', 'W']);
    // Only the halts behind the final halt are cancelled when the CPU stops.
    expect(rows.filter((r) => r.squashed).every((r) => r.text === 'halt')).toBe(true);
  });

  test('mispredicted wrong-path instructions are squashed', () => {
    const rows = buildTimeline(pipe(mispredict).cycles);
    const squashed = rows.filter((r) => r.squashed).map((r) => r.text);
    expect(squashed).toContain('irmovq $-1, %rcx');
  });
});

describe('memory', () => {
  test('replays pushes so the stack is visible at each cycle', () => {
    const { program } = pushPop;
    const cycles = pipe(pushPop).cycles;
    const writes = collectWrites(cycles, 'pipelined');
    expect(writes.map((w) => w.addr)).toEqual([0xf8, 0xf0, 0xe8]);
    const end = memoryAt(program.image, writes, cycles.length);
    expect(readWord(end, 0xe8)).toBe('0x0000000000000003');
    const before = memoryAt(program.image, writes, writes[0].cycle);
    expect(readWord(before, 0xf8)).toBe('0x0000000000000000');
    expect(interestingWords(program, writes).map((w) => w.addr)).toEqual([0xe8, 0xf0, 0xf8]);
  });

  test('sequential writes are collected too', () => {
    const writes = collectWrites(pushPop.modes.sequential.cycles, 'sequential');
    expect(writes).toHaveLength(3);
  });
});
