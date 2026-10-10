// Y86-64 disassembler: decodes instructions from a byte array.

import {
  ICODE, MEM_SIZE, RNONE, instructionLayout, instructionLength, isValidInstruction,
  mnemonic, regName, toS64,
} from './isa.js';

function readLE64(bytes, offset) {
  let v = 0n;
  for (let i = 7; i >= 0; i -= 1) v = (v << 8n) | BigInt(bytes[offset + i] ?? 0);
  return v;
}

function reg(id) {
  const name = regName(id);
  return name ? `%${name}` : '%?';
}

function formatValue(v) {
  // Small values (including small negatives like -1 or -8) read best in decimal.
  const s = toS64(v);
  return s >= -4096n && s <= 9n ? s.toString() : `0x${BigInt.asUintN(64, v).toString(16)}`;
}

/**
 * Decode one instruction at `addr`.
 * @returns {{addr:number, icode:number, ifun:number, rA:number, rB:number,
 *   valC:bigint|null, length:number, valid:boolean, text:string, bytes:number[]}}
 */
export function decodeInstruction(bytes, addr) {
  const b0 = bytes[addr] ?? 0;
  const icode = b0 >> 4;
  const ifun = b0 & 0xf;
  const valid = isValidInstruction(icode, ifun);
  const layout = instructionLayout(icode) ?? { regids: false, valC: false };
  const length = valid ? instructionLength(icode) : 1;
  let rA = RNONE;
  let rB = RNONE;
  let valC = null;
  if (valid && layout.regids) {
    const b1 = bytes[addr + 1] ?? 0;
    rA = b1 >> 4;
    rB = b1 & 0xf;
  }
  if (valid && layout.valC) valC = readLE64(bytes, addr + (layout.regids ? 2 : 1));

  let text;
  if (!valid || addr + length > Math.max(bytes.length, MEM_SIZE)) {
    text = `.byte 0x${b0.toString(16).padStart(2, '0')}`;
  } else {
    const name = mnemonic(icode, ifun);
    switch (icode) {
      case ICODE.RRMOVQ:
      case ICODE.OPQ:
        text = `${name} ${reg(rA)}, ${reg(rB)}`; break;
      case ICODE.IRMOVQ:
        text = `${name} $${formatValue(valC)}, ${reg(rB)}`; break;
      case ICODE.RMMOVQ:
        text = `${name} ${reg(rA)}, ${formatValue(valC)}(${reg(rB)})`; break;
      case ICODE.MRMOVQ:
        text = `${name} ${formatValue(valC)}(${reg(rB)}), ${reg(rA)}`; break;
      case ICODE.JXX:
      case ICODE.CALL:
        text = `${name} 0x${valC.toString(16)}`; break;
      case ICODE.PUSHQ:
      case ICODE.POPQ:
        text = `${name} ${reg(rA)}`; break;
      default:
        text = name;
    }
  }

  return {
    addr, icode, ifun, rA, rB, valC, length, valid, text,
    bytes: Array.from({ length }, (_, i) => bytes[addr + i] ?? 0),
  };
}

/** Linear-sweep disassembly of [start, end). */
export function disassemble(bytes, start = 0, end = bytes.length) {
  const out = [];
  let addr = start;
  while (addr < end) {
    const ins = decodeInstruction(bytes, addr);
    out.push(ins);
    addr += ins.length;
  }
  return out;
}
