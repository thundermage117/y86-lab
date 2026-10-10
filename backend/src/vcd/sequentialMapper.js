// Maps sequential-CPU waveform samples (hardware/sequential/seq.v) to cycles.
// SEQ executes exactly one instruction per cycle.

import { STAT } from '../../../shared/y86/index.js';
import { decodeCC, makeAnnotator, readRegisters, sampleReader, statName } from './common.js';

const SCOPE = 'seq';

export function mapSequential(samples, program) {
  const annotate = makeAnnotator(program);
  const cycles = samples.map((sample, i) => {
    const r = sampleReader(sample, SCOPE);
    const pc = r.hex('PC');
    const stat = r.num('stat');
    return {
      cycle: i + 1,
      uid: i + 1,
      pc,
      ...annotate(pc),
      icode: r.num('icode'), ifun: r.num('ifun'),
      stat, statName: statName(stat),
      rA: r.num('rA'), rB: r.num('rB'),
      valC: r.hex('valC'), valP: r.hex('valP'),
      srcA: r.num('srcA'), srcB: r.num('srcB'),
      dstE: r.num('dstE'), dstM: r.num('dstM'),
      valA: r.hex('valA'), valB: r.hex('valB'),
      valE: r.hex('valE'), valM: r.hex('valM'),
      Cnd: r.bool('Cnd'),
      newPC: r.hex('new_pc'),
      instrValid: r.bool('instr_valid'), imemError: r.bool('imem_error'),
      memory: {
        read: r.bool('mem_read'), write: r.bool('mem_write'),
        addr: r.hex('mem_addr'), data: r.hex('mem_data'),
        error: r.bool('dmem_error'),
      },
      cc: decodeCC(r.num('cc')),
      newCC: decodeCC(r.num('new_cc')),
      setCC: r.bool('set_cc'),
      registers: readRegisters(r),
    };
  });
  const retired = cycles.filter((c) => c.stat === STAT.AOK || c.stat === STAT.HLT).length;
  return { cycles, retired };
}
