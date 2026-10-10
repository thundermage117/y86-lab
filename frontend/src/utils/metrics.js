// Performance metrics computed from the hardware traces.

const FORWARD_SOURCES = ['e_valE', 'm_valM', 'M_valE', 'W_valM', 'W_valE'];

/**
 * CPI decomposition for the pipeline (CS:APP §4.5.9: CPI = 1 + lp + mp + rp).
 * Every cycle in which W does not retire an instruction is charged to a cause.
 */
export function pipelineMetrics(mode) {
  const cycles = mode?.cycles ?? [];
  const total = cycles.length;
  const retired = mode?.retired ?? 0;
  const counts = { loadUse: 0, mispredict: 0, ret: 0 };
  const forwards = Object.fromEntries(FORWARD_SOURCES.map((s) => [s, 0]));
  let bubblesInjected = 0;

  for (const c of cycles) {
    const k = c.control;
    if (k.loadUse) counts.loadUse += 1;
    if (k.mispredict) counts.mispredict += 1;
    if (k.retHazard && !k.loadUse) counts.ret += 1;
    bubblesInjected += ['D', 'E', 'M'].filter((s) => k[`${s}_bubble`]).length;
    const d = c.stages.decode;
    if (!d.bubble && !k.loadUse) {
      if (d.srcA !== 15 && forwards[d.fwdA] !== undefined) forwards[d.fwdA] += 1;
      if (d.srcB !== 15 && forwards[d.fwdB] !== undefined) forwards[d.fwdB] += 1;
    }
  }

  // Penalty cycles: load/use costs 1, mispredict 2, each ret-stall cycle 1.
  const penalties = {
    loadUse: counts.loadUse,
    mispredict: counts.mispredict * 2,
    ret: counts.ret,
  };
  const penaltyTotal = penalties.loadUse + penalties.mispredict + penalties.ret;
  // Remaining overhead is pipeline fill/drain (4 cycles for a 5-stage pipe).
  const fill = Math.max(0, total - retired - penaltyTotal);

  return {
    total,
    retired,
    cpi: retired > 0 ? total / retired : null,
    ipc: total > 0 ? retired / total : null,
    counts,
    penalties,
    fill,
    bubblesInjected,
    forwards,
    forwardTotal: Object.values(forwards).reduce((a, b) => a + b, 0),
    cpiParts: retired > 0 ? {
      base: 1,
      loadUse: penalties.loadUse / retired,
      mispredict: penalties.mispredict / retired,
      ret: penalties.ret / retired,
      fill: fill / retired,
    } : null,
  };
}

export function sequentialMetrics(mode) {
  const total = mode?.cycles?.length ?? 0;
  const retired = mode?.retired ?? 0;
  return { total, retired, cpi: retired > 0 ? total / retired : null };
}

export const DEFAULT_STAGE_DELAYS = Object.freeze({
  fetch: 300, decode: 200, execute: 250, memory: 300, writeback: 100, register: 20,
});

/**
 * Wall-clock estimate from stage delays (picoseconds): SEQ's clock must cover
 * all five stages; PIPE's clock covers the slowest stage plus register overhead.
 */
export function timingModel(delays, pipeCycles, seqCycles) {
  const stage = ['fetch', 'decode', 'execute', 'memory', 'writeback'].map((k) => Math.max(0, Number(delays[k]) || 0));
  const seqPeriod = stage.reduce((a, b) => a + b, 0);
  const pipePeriod = Math.max(...stage) + Math.max(0, Number(delays.register) || 0);
  const seqTime = seqPeriod * seqCycles;
  const pipeTime = pipePeriod * pipeCycles;
  return {
    seqPeriod,
    pipePeriod,
    seqTime,
    pipeTime,
    speedup: pipeTime > 0 ? seqTime / pipeTime : null,
    bottleneck: ['fetch', 'decode', 'execute', 'memory', 'writeback'][stage.indexOf(Math.max(...stage))],
  };
}
