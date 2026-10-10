// Builds the classic pipeline "staircase" diagram from the per-stage
// instruction uids that the backend tracks.

import { STAGE_KEYS, STAGE_LETTERS } from './format.js';

/**
 * @returns {{uid:number, text:string, line:number|null, pc:string, first:number, last:number,
 *   squashed:boolean, cells: Record<number, {stage:string, letter:string, repeat:boolean}>}[]}
 */
export function buildTimeline(cycles) {
  const rows = new Map();
  cycles.forEach((cycle, i) => {
    for (const key of STAGE_KEYS) {
      const stage = cycle.stages[key];
      if (stage.bubble || stage.uid === null || stage.uid === undefined) continue;
      let row = rows.get(stage.uid);
      if (!row) {
        row = {
          uid: stage.uid, text: stage.text, line: stage.line, pc: stage.pc,
          first: i, last: i, squashed: true, cells: {},
        };
        rows.set(stage.uid, row);
      }
      const prev = row.cells[i - 1];
      row.cells[i] = { stage: key, letter: STAGE_LETTERS[key], repeat: prev?.stage === key };
      row.last = i;
      if (key === 'writeback') row.squashed = false;
    }
  });
  const list = [...rows.values()].sort((a, b) => a.uid - b.uid);
  // An instruction still in flight when the run ends was not squashed.
  const end = cycles.length - 1;
  for (const row of list) if (row.last === end) row.squashed = false;
  return list;
}

/** Rows with at least one cell inside [start, end]. */
export function rowsInWindow(rows, start, end) {
  return rows.filter((r) => r.last >= start && r.first <= end);
}
