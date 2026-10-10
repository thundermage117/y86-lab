// Y86-64 instruction set tables (CS:APP encoding). Single source of truth for
// the assembler, disassembler, reference simulator, backend and frontend.

export const MEM_SIZE = 8192;

export const ICODE = Object.freeze({
  HALT: 0x0,
  NOP: 0x1,
  RRMOVQ: 0x2, // rrmovq and cmovXX
  IRMOVQ: 0x3,
  RMMOVQ: 0x4,
  MRMOVQ: 0x5,
  OPQ: 0x6,
  JXX: 0x7,
  CALL: 0x8,
  RET: 0x9,
  PUSHQ: 0xa,
  POPQ: 0xb,
});

export const ICODE_NAMES = Object.freeze([
  'HALT', 'NOP', 'RRMOVQ', 'IRMOVQ', 'RMMOVQ', 'MRMOVQ', 'OPQ', 'JXX',
  'CALL', 'RET', 'PUSHQ', 'POPQ',
]);

export const REG_NAMES = Object.freeze([
  'rax', 'rcx', 'rdx', 'rbx', 'rsp', 'rbp', 'rsi', 'rdi',
  'r8', 'r9', 'r10', 'r11', 'r12', 'r13', 'r14',
]);

export const RSP = 4;
export const RNONE = 0xf;

export const STAT = Object.freeze({ AOK: 0, HLT: 1, ADR: 2, INS: 3 });
export const STAT_NAMES = Object.freeze(['AOK', 'HLT', 'ADR', 'INS']);
export const STAT_DESCRIPTIONS = Object.freeze({
  AOK: 'Normal operation',
  HLT: 'Halt instruction executed',
  ADR: 'Invalid memory address',
  INS: 'Invalid instruction',
});

export const OP_NAMES = Object.freeze(['addq', 'subq', 'andq', 'xorq']);
export const JUMP_NAMES = Object.freeze(['jmp', 'jle', 'jl', 'je', 'jne', 'jge', 'jg']);
export const CMOV_NAMES = Object.freeze(['rrmovq', 'cmovle', 'cmovl', 'cmove', 'cmovne', 'cmovge', 'cmovg']);

/** Encoding layout of an instruction class: [needsRegids, needsValC]. */
export function instructionLayout(icode) {
  switch (icode) {
    case ICODE.HALT:
    case ICODE.NOP:
    case ICODE.RET:
      return { regids: false, valC: false };
    case ICODE.RRMOVQ:
    case ICODE.OPQ:
    case ICODE.PUSHQ:
    case ICODE.POPQ:
      return { regids: true, valC: false };
    case ICODE.IRMOVQ:
    case ICODE.RMMOVQ:
    case ICODE.MRMOVQ:
      return { regids: true, valC: true };
    case ICODE.JXX:
    case ICODE.CALL:
      return { regids: false, valC: true };
    default:
      return null;
  }
}

export function instructionLength(icode) {
  const layout = instructionLayout(icode);
  if (!layout) return 1;
  return 1 + (layout.regids ? 1 : 0) + (layout.valC ? 8 : 0);
}

/** Mirrors fetch.v instr_valid: icode in range and ifun legal for that class. */
export function isValidInstruction(icode, ifun) {
  switch (icode) {
    case ICODE.RRMOVQ:
    case ICODE.JXX:
      return ifun <= 6;
    case ICODE.OPQ:
      return ifun <= 3;
    default:
      return icode <= ICODE.POPQ && ifun === 0;
  }
}

/** Assembly mnemonic for an (icode, ifun) pair, or null if invalid. */
export function mnemonic(icode, ifun) {
  if (!isValidInstruction(icode, ifun)) return null;
  switch (icode) {
    case ICODE.RRMOVQ: return CMOV_NAMES[ifun];
    case ICODE.OPQ: return OP_NAMES[ifun];
    case ICODE.JXX: return JUMP_NAMES[ifun];
    default: return ICODE_NAMES[icode].toLowerCase();
  }
}

export function regName(id) {
  if (id === RNONE || id === undefined || id === null) return null;
  return REG_NAMES[id] ?? null;
}

/** Evaluate a jXX / cmovXX condition. cc = { zf, sf, of } booleans. */
export function evalCondition(ifun, { zf, sf, of }) {
  switch (ifun) {
    case 0: return true;
    case 1: return (sf !== of) || zf;
    case 2: return sf !== of;
    case 3: return zf;
    case 4: return !zf;
    case 5: return sf === of;
    case 6: return sf === of && !zf;
    default: return false;
  }
}

const MASK64 = (1n << 64n) - 1n;

export function toU64(value) {
  return BigInt.asUintN(64, BigInt(value));
}

export function toS64(value) {
  return BigInt.asIntN(64, BigInt(value));
}

export function hex64(value) {
  return '0x' + (BigInt(value) & MASK64).toString(16).padStart(16, '0');
}
