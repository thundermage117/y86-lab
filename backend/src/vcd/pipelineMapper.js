// Maps pipelined-CPU waveform samples (hardware/pipeline/proc.v) to cycles.

import { STAT } from '../../../shared/y86/index.js';
import {
  FORWARD_SOURCES, decodeCC, makeAnnotator, readRegisters, sampleReader, statName,
} from './common.js';

const SCOPE = 'proc';
export const STAGES = Object.freeze(['fetch', 'decode', 'execute', 'memory', 'writeback']);
const PREFIX = { decode: 'D', execute: 'E', memory: 'M', writeback: 'W' };

function readStages(r, annotate) {
  const base = (pc, icode, ifun, stat) => ({
    pc, icode, ifun, stat, statName: statName(stat), ...annotate(pc),
  });

  const fetch = {
    ...base(r.hex('f_pc'), r.num('f_icode'), r.num('f_ifun'), r.num('f_stat')),
    rA: r.num('f_rA'), rB: r.num('f_rB'),
    valC: r.hex('f_valC'), valP: r.hex('f_valP'),
    predPC: r.hex('f_predPC'),
    instrValid: r.bool('instr_valid'), imemError: r.bool('imem_error'),
  };

  const fwdA = r.num('d_fwdA');
  const fwdB = r.num('d_fwdB');
  const decode = {
    ...base(r.hex('D_pc'), r.num('D_icode'), r.num('D_ifun'), r.num('D_stat')),
    rA: r.num('D_rA'), rB: r.num('D_rB'),
    valC: r.hex('D_valC'), valP: r.hex('D_valP'),
    srcA: r.num('d_srcA'), srcB: r.num('d_srcB'),
    dstE: r.num('d_dstE'), dstM: r.num('d_dstM'),
    valA: r.hex('d_valA'), valB: r.hex('d_valB'),
    regValA: r.hex('d_rvalA'), regValB: r.hex('d_rvalB'),
    fwdA: fwdA === null ? null : FORWARD_SOURCES[fwdA],
    fwdB: fwdB === null ? null : FORWARD_SOURCES[fwdB],
  };

  const execute = {
    ...base(r.hex('E_pc'), r.num('E_icode'), r.num('E_ifun'), r.num('E_stat')),
    valA: r.hex('E_valA'), valB: r.hex('E_valB'), valC: r.hex('E_valC'),
    valE: r.hex('e_valE'), Cnd: r.bool('e_Cnd'),
    srcA: r.num('E_srcA'), srcB: r.num('E_srcB'),
    dstE: r.num('E_dstE'), dstM: r.num('E_dstM'), finalDstE: r.num('e_dstE'),
    setCC: r.bool('set_cc'),
  };

  const memory = {
    ...base(r.hex('M_pc'), r.num('M_icode'), r.num('M_ifun'), r.num('M_stat')),
    valE: r.hex('M_valE'), valA: r.hex('M_valA'), valM: r.hex('m_valM'), Cnd: r.bool('M_Cnd'),
    dstE: r.num('M_dstE'), dstM: r.num('M_dstM'),
    read: r.bool('mem_read'), write: r.bool('mem_write'),
    addr: r.hex('mem_addr'), data: r.hex('mem_data'),
    error: r.bool('dmem_error'), outStat: r.num('m_stat'),
  };

  const writeback = {
    ...base(r.hex('W_pc'), r.num('W_icode'), null, r.num('W_stat')),
    valE: r.hex('W_valE'), valM: r.hex('W_valM'),
    dstE: r.num('W_dstE'), dstM: r.num('W_dstM'),
    writeE: r.num('w_dstE'), writeM: r.num('w_dstM'),
  };

  return { fetch, decode, execute, memory, writeback };
}

function readControl(r) {
  const control = {};
  for (const s of ['F', 'D', 'E', 'M', 'W']) {
    control[`${s}_stall`] = r.bool(`${s}_stall`);
    control[`${s}_bubble`] = r.bool(`${s}_bubble`);
  }
  control.loadUse = r.bool('load_use');
  control.retHazard = r.bool('ret_hazard');
  control.mispredict = r.bool('mispredict');
  control.exception = Boolean(r.bool('m_exc') || r.bool('w_exc'));
  return control;
}

/**
 * Give every fetched instruction a uid and follow it through the pipeline,
 * marking stages that hold bubbles. Uses the control signals of cycle n to
 * work out stage contents in cycle n+1 (the registers update at the edge
 * between them).
 */
function trackInstructions(cycles) {
  let nextUid = 1;
  let prev = null;
  for (const cyc of cycles) {
    const { stages } = cyc;
    if (!prev) {
      stages.fetch.uid = nextUid++;
      stages.fetch.bubble = false;
      for (const s of STAGES.slice(1)) { stages[s].uid = null; stages[s].bubble = true; }
    } else {
      const c = prev.control;
      const ps = prev.stages;
      stages.fetch.uid = c.F_stall && ps.fetch.pc === stages.fetch.pc ? ps.fetch.uid : nextUid++;
      stages.fetch.bubble = false;
      for (let i = 1; i < STAGES.length; i += 1) {
        const s = STAGES[i];
        const p = PREFIX[s];
        let src;
        if (c[`${p}_bubble`]) src = { uid: null, bubble: true };
        else if (c[`${p}_stall`]) src = ps[s];
        else src = ps[STAGES[i - 1]];
        stages[s].uid = src.uid;
        stages[s].bubble = src.bubble;
      }
    }
    prev = cyc;
  }
}

export function mapPipeline(samples, program) {
  const annotate = makeAnnotator(program);
  const cycles = samples.map((sample, i) => {
    const r = sampleReader(sample, SCOPE);
    return {
      cycle: i + 1,
      stages: readStages(r, annotate),
      control: readControl(r),
      cc: decodeCC(r.num('cc')),
      newCC: decodeCC(r.num('new_cc')),
      setCC: r.bool('set_cc'),
      registers: readRegisters(r),
    };
  });
  trackInstructions(cycles);

  const retired = cycles.filter((c) => !c.stages.writeback.bubble &&
    (c.stages.writeback.stat === STAT.AOK || c.stages.writeback.stat === STAT.HLT)).length;
  return { cycles, retired };
}
