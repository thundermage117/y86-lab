// Turns the hardware's control signals for one cycle into plain-language
// explanations. Everything here is derived from signals the Verilog CPU
// actually produced (load_use, mispredict, d_fwdA, ...), not re-simulated.

import { ICODE, RNONE, STAT } from '@y86/isa.js';
import { STAGE_LABELS, formatWord, regLabel, flagsLabel } from './format.js';

export const EVENT_KINDS = Object.freeze({
  loadUse: { label: 'Load/use stall', tone: 'stall' },
  mispredict: { label: 'Branch mispredict', tone: 'bubble' },
  ret: { label: 'Return stall', tone: 'stall' },
  forward: { label: 'Forwarding', tone: 'forward' },
  exception: { label: 'Exception / halt', tone: 'error' },
  redirect: { label: 'Fetch redirect', tone: 'info' },
  cmov: { label: 'Cancelled cmov', tone: 'info' },
  cc: { label: 'Condition codes', tone: 'info' },
});

/** Which pipeline stage produced a forwarded value. */
const FORWARD_ORIGIN = {
  e_valE: { stage: 'execute', what: 'the ALU result (e_valE)' },
  M_valE: { stage: 'memory', what: 'the ALU result saved in M (M_valE)' },
  m_valM: { stage: 'memory', what: 'the value just read from memory (m_valM)' },
  W_valE: { stage: 'writeback', what: 'the ALU result waiting in W (W_valE)' },
  W_valM: { stage: 'writeback', what: 'the loaded value waiting in W (W_valM)' },
};

const code = (stage) => (stage?.text ? `\`${stage.text}\`` : 'a bubble');

function live(stage) {
  return stage && !stage.bubble;
}

function retStage(stages) {
  return ['decode', 'execute', 'memory'].find((s) => live(stages[s]) && stages[s].icode === ICODE.RET);
}

/**
 * Explain one pipelined cycle.
 * @returns {{kind:string, title:string, detail:string, stages:string[]}[]}
 */
export function explainPipelineCycle(cycle, numberFormat = 'dec') {
  if (!cycle) return [];
  const { stages, control } = cycle;
  const { fetch, decode, execute, memory, writeback } = stages;
  const events = [];
  const fmt = (v) => formatWord(v, numberFormat);

  if (control.loadUse && live(execute) && live(decode)) {
    const reg = regLabel(execute.dstM);
    events.push({
      kind: 'loadUse',
      title: `Load/use hazard on ${reg}`,
      detail: `${code(execute)} in Execute is loading ${reg} from memory, but ${code(decode)} in Decode `
        + `needs ${reg} now. The value won't exist until the end of the Memory stage, so forwarding can't help: `
        + 'Fetch and Decode hold their instructions for one cycle and a bubble is inserted into Execute.',
      stages: ['decode', 'execute'],
    });
  }

  if (control.mispredict && live(execute)) {
    const squashed = [live(decode) ? `${code(decode)} (Decode)` : null, `${code(fetch)} (Fetch)`].filter(Boolean);
    events.push({
      kind: 'mispredict',
      title: 'Branch mispredicted',
      detail: `${code(execute)} reaches Execute and its condition is false (${flagsLabel(cycle.cc)}), so the jump is `
        + `not taken. The CPU had predicted "taken" and already fetched from the target. `
        + `${squashed.join(' and ')} ${squashed.length === 1 ? 'is' : 'are'} squashed: bubbles enter Decode and `
        + `Execute next cycle, and Fetch restarts at the fall-through address ${fmt(execute.valA)}.`,
      stages: ['fetch', 'decode', 'execute'],
    });
  }

  const ret = retStage(stages);
  if (control.retHazard && ret) {
    events.push({
      kind: 'ret',
      title: `ret in ${STAGE_LABELS[ret]}: waiting for the return address`,
      detail: `${code(stages[ret])} pops its return address off the stack in the Memory stage, and Fetch can only `
        + 'use it once ret reaches Write-back. Until then Fetch stalls'
        + (control.loadUse ? ' (a load/use stall takes priority this cycle).' : ' and a bubble is sent into Decode.'),
      stages: ['fetch', ret],
    });
  }

  if (live(memory) && memory.icode === ICODE.JXX && memory.Cnd === false) {
    events.push({
      kind: 'redirect',
      title: 'Fetch redirected after misprediction',
      detail: `Fetch takes the fall-through address ${fmt(memory.valA)} from M_valA instead of the predicted target.`,
      stages: ['fetch', 'memory'],
    });
  }
  if (live(writeback) && writeback.icode === ICODE.RET) {
    events.push({
      kind: 'redirect',
      title: 'Fetch resumes at the return address',
      detail: `ret is in Write-back, so Fetch uses the return address ${fmt(writeback.valM)} from W_valM.`,
      stages: ['fetch', 'writeback'],
    });
  }

  if (live(decode) && !control.loadUse) {
    for (const [operand, src, fwd, val] of [
      ['valA', decode.srcA, decode.fwdA, decode.valA],
      ['valB', decode.srcB, decode.fwdB, decode.valB],
    ]) {
      const origin = FORWARD_ORIGIN[fwd];
      if (!origin || src === RNONE) continue;
      const producer = stages[origin.stage];
      events.push({
        kind: 'forward',
        title: `Forward ${regLabel(src)} → ${operand} from ${STAGE_LABELS[origin.stage]}`,
        detail: `${code(decode)} needs ${regLabel(src)} = ${fmt(val)}. ${code(producer)} has computed it but not `
          + `written it to the register file yet, so Decode takes ${origin.what} directly. No stall needed.`,
        stages: ['decode', origin.stage],
      });
    }
  }

  if (live(execute) && execute.icode === ICODE.RRMOVQ && execute.ifun !== 0 && execute.Cnd === false) {
    events.push({
      kind: 'cmov',
      title: 'Conditional move not taken',
      detail: `The condition of ${code(execute)} is false (${flagsLabel(cycle.cc)}), so its destination is changed `
        + `to RNONE and ${regLabel(execute.dstE)} is left unchanged.`,
      stages: ['execute'],
    });
  }

  if (cycle.setCC && live(execute)) {
    events.push({
      kind: 'cc',
      title: 'Condition codes updated',
      detail: `${code(execute)} sets ${flagsLabel(cycle.newCC)} at the end of this cycle.`,
      stages: ['execute'],
    });
  }

  for (const key of ['memory', 'writeback']) {
    const s = stages[key];
    if (!live(s) || s.stat === STAT.AOK || s.stat === null) continue;
    const stat = key === 'memory' ? memory.outStat ?? s.stat : s.stat;
    if (stat === STAT.AOK) continue;
    events.push({
      kind: 'exception',
      title: stat === STAT.HLT
        ? `halt in ${STAGE_LABELS[key]}`
        : `Exception ${s.statName} in ${STAGE_LABELS[key]}`,
      detail: key === 'writeback'
        ? `${code(s)} reached Write-back with status ${s.statName}. The processor stops here; nothing after it `
          + 'ever changed the programmer-visible state.'
        : `${code(s)} has status ${s.statName}. Condition-code updates are blocked and a bubble is inserted into `
          + 'Memory so younger instructions cannot change state.',
      stages: [key],
    });
  }
  if (live(memory) && memory.error) {
    events.push({
      kind: 'exception',
      title: 'Invalid memory address',
      detail: `${code(memory)} accesses address ${fmt(memory.addr)}, outside the 8 KB memory. Its status becomes ADR.`,
      stages: ['memory'],
    });
  }

  return events;
}

/** Explain one sequential (SEQ) cycle. */
export function explainSequentialCycle(cycle, numberFormat = 'dec') {
  if (!cycle) return [];
  const fmt = (v) => formatWord(v, numberFormat);
  const ins = `\`${cycle.text}\``;
  const events = [{
    kind: 'info',
    title: 'One instruction per cycle',
    detail: `SEQ runs ${ins} through all five stages within this single, long clock cycle. `
      + 'Registers, memory, CC and the PC update together at the rising edge.',
    stages: [],
  }];
  if (cycle.icode === ICODE.JXX) {
    events.push({
      kind: 'redirect',
      title: cycle.Cnd ? 'Jump taken' : 'Jump not taken',
      detail: `Condition is ${cycle.Cnd ? 'true' : 'false'} (${flagsLabel(cycle.cc)}); next PC = ${fmt(cycle.newPC)}.`,
      stages: [],
    });
  }
  if (cycle.icode === ICODE.RRMOVQ && cycle.ifun !== 0 && !cycle.Cnd) {
    events.push({ kind: 'cmov', title: 'Conditional move not taken', detail: `${regLabel(cycle.rB)} is unchanged.`, stages: [] });
  }
  if (cycle.setCC) {
    events.push({ kind: 'cc', title: 'Condition codes updated', detail: `New flags: ${flagsLabel(cycle.newCC)}.`, stages: [] });
  }
  if (cycle.stat !== STAT.AOK && cycle.stat !== null) {
    events.push({
      kind: 'exception',
      title: cycle.stat === STAT.HLT ? 'halt' : `Exception ${cycle.statName}`,
      detail: 'The processor stops; this instruction does not change any state.',
      stages: [],
    });
  }
  return events;
}

/** Hazard kinds present in a pipelined cycle (for navigation and filtering). */
export function cycleKinds(cycle) {
  const kinds = new Set();
  if (!cycle?.control) return kinds;
  const c = cycle.control;
  if (c.loadUse) kinds.add('loadUse');
  if (c.mispredict) kinds.add('mispredict');
  if (c.retHazard) kinds.add('ret');
  if (c.exception) kinds.add('exception');
  const d = cycle.stages.decode;
  if (!d.bubble && !c.loadUse && ((d.fwdA in FORWARD_ORIGIN && d.srcA !== RNONE)
    || (d.fwdB in FORWARD_ORIGIN && d.srcB !== RNONE))) kinds.add('forward');
  return kinds;
}

/** Index of the next/previous cycle containing any of `kinds`, or -1. */
export function findHazard(cycles, from, direction, kinds) {
  for (let i = from + direction; i >= 0 && i < cycles.length; i += direction) {
    const k = cycleKinds(cycles[i]);
    for (const kind of kinds) if (k.has(kind)) return i;
  }
  return -1;
}
