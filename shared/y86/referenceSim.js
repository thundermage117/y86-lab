// ISA-level Y86-64 simulator used as the golden model for the Verilog CPUs.
// Semantics match hardware/common: byte-addressed 8KB memory, CC reset to
// ZF=1, an instruction that raises an exception changes no state.

import {
  ICODE, MEM_SIZE, RNONE, RSP, STAT, evalCondition, isValidInstruction, toU64,
} from './isa.js';
import { decodeInstruction } from './disassembler.js';

function readWord(mem, addr) {
  let v = 0n;
  for (let i = 7; i >= 0; i -= 1) v = (v << 8n) | BigInt(mem[addr + i]);
  return v;
}

function writeWord(mem, addr, value) {
  let v = toU64(value);
  for (let i = 0; i < 8; i += 1) {
    mem[addr + i] = Number(v & 0xffn);
    v >>= 8n;
  }
}

function validDataAddr(addr) {
  return addr >= 0n && addr <= BigInt(MEM_SIZE - 8);
}

export function createState(memoryImage) {
  const mem = new Uint8Array(MEM_SIZE);
  mem.set(memoryImage.subarray(0, MEM_SIZE));
  return {
    pc: 0n,
    regs: Array(15).fill(0n),
    cc: { zf: true, sf: false, of: false },
    mem,
    stat: STAT.AOK,
  };
}

function alu(ifun, a, b) {
  // Returns [result, overflow]; SUB computes b - a.
  const sa = BigInt.asIntN(64, a);
  const sb = BigInt.asIntN(64, b);
  switch (ifun) {
    case 0: {
      const r = toU64(a + b);
      const sr = BigInt.asIntN(64, r);
      return [r, (sa < 0n) === (sb < 0n) && (sr < 0n) !== (sa < 0n)];
    }
    case 1: {
      const r = toU64(b - a);
      const sr = BigInt.asIntN(64, r);
      return [r, (sa < 0n) !== (sb < 0n) && (sr < 0n) !== (sb < 0n)];
    }
    case 2: return [a & b, false];
    default: return [a ^ b, false];
  }
}

/**
 * Execute one instruction. Returns a record of what it did, or null if the
 * machine was already stopped.
 */
export function step(state) {
  if (state.stat !== STAT.AOK) return null;
  const { mem, regs } = state;
  const pc = state.pc;

  if (pc >= BigInt(MEM_SIZE)) {
    state.stat = STAT.ADR;
    return { pc, stat: state.stat };
  }
  const ins = decodeInstruction(mem, Number(pc));
  const { icode, ifun, rA, rB } = ins;
  const valC = ins.valC ?? 0n;
  const record = { pc, icode, ifun, text: ins.text };

  if (!isValidInstruction(icode, ifun)) {
    state.stat = STAT.INS;
    return { ...record, stat: state.stat };
  }
  if (pc + BigInt(ins.length) > BigInt(MEM_SIZE)) {
    state.stat = STAT.ADR;
    return { ...record, stat: state.stat };
  }

  const valP = pc + BigInt(ins.length);
  const get = (r) => (r === RNONE ? 0n : regs[r]);
  let nextPc = valP;
  const writes = [];
  const memWrites = [];

  switch (icode) {
    case ICODE.HALT:
      state.stat = STAT.HLT;
      return { ...record, stat: state.stat };
    case ICODE.NOP:
      break;
    case ICODE.RRMOVQ:
      if (evalCondition(ifun, state.cc)) writes.push([rB, get(rA)]);
      break;
    case ICODE.IRMOVQ:
      writes.push([rB, toU64(valC)]);
      break;
    case ICODE.RMMOVQ: {
      const addr = toU64(valC + get(rB));
      if (!validDataAddr(addr)) { state.stat = STAT.ADR; return { ...record, stat: state.stat }; }
      memWrites.push([addr, get(rA)]);
      break;
    }
    case ICODE.MRMOVQ: {
      const addr = toU64(valC + get(rB));
      if (!validDataAddr(addr)) { state.stat = STAT.ADR; return { ...record, stat: state.stat }; }
      writes.push([rA, readWord(mem, Number(addr))]);
      break;
    }
    case ICODE.OPQ: {
      const [r, of] = alu(ifun, get(rA), get(rB));
      writes.push([rB, r]);
      state.cc = { zf: r === 0n, sf: BigInt.asIntN(64, r) < 0n, of };
      break;
    }
    case ICODE.JXX:
      if (evalCondition(ifun, state.cc)) nextPc = toU64(valC);
      break;
    case ICODE.CALL: {
      const sp = toU64(regs[RSP] - 8n);
      if (!validDataAddr(sp)) { state.stat = STAT.ADR; return { ...record, stat: state.stat }; }
      memWrites.push([sp, valP]);
      writes.push([RSP, sp]);
      nextPc = toU64(valC);
      break;
    }
    case ICODE.RET: {
      const sp = regs[RSP];
      if (!validDataAddr(sp)) { state.stat = STAT.ADR; return { ...record, stat: state.stat }; }
      nextPc = readWord(mem, Number(sp));
      writes.push([RSP, toU64(sp + 8n)]);
      break;
    }
    case ICODE.PUSHQ: {
      const sp = toU64(regs[RSP] - 8n);
      if (!validDataAddr(sp)) { state.stat = STAT.ADR; return { ...record, stat: state.stat }; }
      memWrites.push([sp, get(rA)]);
      writes.push([RSP, sp]);
      break;
    }
    case ICODE.POPQ: {
      const sp = regs[RSP];
      if (!validDataAddr(sp)) { state.stat = STAT.ADR; return { ...record, stat: state.stat }; }
      const value = readWord(mem, Number(sp));
      // %rsp increment first, then the loaded value (popq %rsp loads the value).
      writes.push([RSP, toU64(sp + 8n)]);
      writes.push([rA, value]);
      break;
    }
    default:
      state.stat = STAT.INS;
      return { ...record, stat: state.stat };
  }

  for (const [addr, value] of memWrites) writeWord(mem, Number(addr), value);
  for (const [r, value] of writes) if (r !== RNONE) regs[r] = value;
  state.pc = nextPc;
  return { ...record, stat: state.stat, writes, memWrites };
}

/**
 * Run a program to completion.
 * @param {Uint8Array} memoryImage
 * @param {{maxSteps?: number}} options
 * @returns {{state, steps:number, trace:object[], timedOut:boolean}}
 */
export function run(memoryImage, { maxSteps = 10000 } = {}) {
  const state = createState(memoryImage);
  const trace = [];
  while (state.stat === STAT.AOK && trace.length < maxSteps) {
    trace.push(step(state));
  }
  return { state, steps: trace.length, trace, timedOut: state.stat === STAT.AOK };
}
