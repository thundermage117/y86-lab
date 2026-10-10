import { REG_NAMES, STAT_NAMES, MEM_SIZE, decodeInstruction } from '../../../shared/y86/index.js';
import { toBool, toHex64, toNumber } from './parser.js';

export const FORWARD_SOURCES = Object.freeze(['regfile', 'valP', 'e_valE', 'm_valM', 'M_valE', 'W_valM', 'W_valE']);

/** Accessor bound to one sample; looks up "<scope>.<name>". */
export function sampleReader(sample, scope) {
  const raw = (name) => sample[`${scope}.${name}`];
  return {
    num: (name) => toNumber(raw(name)),
    bool: (name) => toBool(raw(name)),
    hex: (name) => toHex64(raw(name)),
  };
}

export function readRegisters(r) {
  const regs = {};
  for (const name of REG_NAMES) regs[name] = r.hex(name);
  return regs;
}

export function decodeCC(bits) {
  if (bits === null) return null;
  return { zf: Boolean(bits & 1), sf: Boolean(bits & 2), of: Boolean(bits & 4) };
}

export function statName(stat) {
  return stat === null ? null : STAT_NAMES[stat];
}

/** Builds instruction annotations (assembly text + source line) from the program. */
export function makeAnnotator(program) {
  const cache = new Map();
  return (pcHex) => {
    if (pcHex === null) return { text: null, line: null };
    if (cache.has(pcHex)) return cache.get(pcHex);
    const pc = Number(BigInt(pcHex));
    let result = { text: null, line: null };
    if (pc < MEM_SIZE) {
      result = { text: decodeInstruction(program.memory, pc).text, line: program.pcToLine[pc] ?? null };
    }
    cache.set(pcHex, result);
    return result;
  };
}
