import { REG_NAMES, STAT } from '@y86/isa.js';
import { STAGE_KEYS } from '../../utils/format.js';

/** Source line -> stages currently holding that instruction. */
export function stageMarkers(cycle, mode) {
  const markers = new Map();
  if (mode === 'sequential') {
    if (cycle.line) markers.set(cycle.line, ['execute']);
    return markers;
  }
  for (const key of STAGE_KEYS) {
    const s = cycle.stages[key];
    if (s.bubble || !s.line) continue;
    if (!markers.has(s.line)) markers.set(s.line, []);
    markers.get(s.line).push(key);
  }
  return markers;
}

/** Register name -> value written at the end of this cycle. */
export function pendingWrites(cycle, mode) {
  const pending = new Map();
  if (mode === 'sequential') {
    if (cycle.stat !== STAT.AOK) return pending;
    if (cycle.dstE !== 15) pending.set(REG_NAMES[cycle.dstE], cycle.valE);
    if (cycle.dstM !== 15) pending.set(REG_NAMES[cycle.dstM], cycle.valM);
    return pending;
  }
  const w = cycle.stages.writeback;
  if (w.bubble) return pending;
  if (w.writeE !== 15) pending.set(REG_NAMES[w.writeE], w.valE);
  if (w.writeM !== 15) pending.set(REG_NAMES[w.writeM], w.valM);
  return pending;
}

/** Instruction uid currently at a source line (pipelined), or the cycle uid (SEQ). */
export function uidForLine(cycle, mode, line) {
  if (mode === 'sequential') return cycle.line === line ? cycle.uid : null;
  for (const key of STAGE_KEYS) {
    const s = cycle.stages[key];
    if (!s.bubble && s.line === line) return s.uid;
  }
  return null;
}

/** Source line of an instruction uid in this cycle, if it is in flight. */
export function lineForUid(cycle, mode, uid) {
  if (uid === null || uid === undefined) return null;
  if (mode === 'sequential') return cycle.uid === uid ? cycle.line : null;
  for (const key of STAGE_KEYS) {
    const s = cycle.stages[key];
    if (!s.bubble && s.uid === uid) return s.line;
  }
  return null;
}

/**
 * What happens to the instruction in stage i at the next clock edge.
 * @returns {{kind:'advance'|'held'|'bubble', label:string, title:string}}
 */
export function connectorState(control, fromKey, toKey) {
  const to = { decode: 'D', execute: 'E', memory: 'M', writeback: 'W' }[toKey];
  const from = { fetch: 'F', decode: 'D', execute: 'E', memory: 'M' }[fromKey];
  if (control[`${to}_bubble`]) {
    return { kind: 'bubble', label: 'bubble', title: `A bubble enters ${toKey} at the next clock edge (${to}_bubble).` };
  }
  if (control[`${to}_stall`] || control[`${from}_stall`]) {
    return { kind: 'held', label: 'held', title: `${fromKey} keeps its instruction for another cycle (${from}_stall).` };
  }
  return { kind: 'advance', label: '', title: `The instruction moves from ${fromKey} to ${toKey} at the next clock edge.` };
}
