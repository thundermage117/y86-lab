// Two-pass Y86-64 assembler compatible with CS:APP `yas` source files.
//
// Supports all Y86-64 instructions, labels, `#` comments and the directives
// .pos, .align, .quad and .byte. Returns a memory image, a per-line listing,
// a symbol table and line-numbered errors (assembly continues past errors).

import {
  ICODE, MEM_SIZE, REG_NAMES, RNONE, OP_NAMES, JUMP_NAMES, CMOV_NAMES,
  instructionLength, toU64,
} from './isa.js';

const MNEMONICS = new Map();
MNEMONICS.set('halt', { icode: ICODE.HALT, ifun: 0, form: 'none' });
MNEMONICS.set('nop', { icode: ICODE.NOP, ifun: 0, form: 'none' });
MNEMONICS.set('ret', { icode: ICODE.RET, ifun: 0, form: 'none' });
CMOV_NAMES.forEach((name, ifun) => MNEMONICS.set(name, { icode: ICODE.RRMOVQ, ifun, form: 'rr' }));
MNEMONICS.set('irmovq', { icode: ICODE.IRMOVQ, ifun: 0, form: 'ir' });
MNEMONICS.set('rmmovq', { icode: ICODE.RMMOVQ, ifun: 0, form: 'rm' });
MNEMONICS.set('mrmovq', { icode: ICODE.MRMOVQ, ifun: 0, form: 'mr' });
OP_NAMES.forEach((name, ifun) => MNEMONICS.set(name, { icode: ICODE.OPQ, ifun, form: 'rr' }));
JUMP_NAMES.forEach((name, ifun) => MNEMONICS.set(name, { icode: ICODE.JXX, ifun, form: 'dest' }));
MNEMONICS.set('call', { icode: ICODE.CALL, ifun: 0, form: 'dest' });
MNEMONICS.set('pushq', { icode: ICODE.PUSHQ, ifun: 0, form: 'r' });
MNEMONICS.set('popq', { icode: ICODE.POPQ, ifun: 0, form: 'r' });

export const INSTRUCTION_MNEMONICS = Object.freeze([...MNEMONICS.keys()]);
export const DIRECTIVES = Object.freeze(['.pos', '.align', '.quad', '.byte']);

const LABEL_RE = /^([A-Za-z_.][\w.]*)\s*:/;
const NUMBER_RE = /^-?(0x[0-9a-f]+|\d+)$/i;
const IDENT_RE = /^[A-Za-z_.][\w.]*$/;
const MEM_RE = /^(.*?)\(\s*(%\w+)\s*\)$/;

class AsmError extends Error {}

function parseNumber(text) {
  const t = text.trim();
  if (!NUMBER_RE.test(t)) return null;
  const negative = t.startsWith('-');
  const magnitude = BigInt(negative ? t.slice(1) : t);
  return negative ? -magnitude : magnitude;
}

function parseRegister(text) {
  const t = text.trim().toLowerCase();
  if (!t.startsWith('%')) throw new AsmError(`expected a register like %rax, got "${text.trim()}"`);
  const id = REG_NAMES.indexOf(t.slice(1));
  if (id < 0) throw new AsmError(`unknown register "${text.trim()}"`);
  return id;
}

/** A value operand: number literal or label reference (resolved in pass 2). */
function parseValue(text, what) {
  const t = text.trim();
  if (t === '') throw new AsmError(`missing ${what}`);
  const n = parseNumber(t);
  if (n !== null) return { number: n };
  if (IDENT_RE.test(t)) return { label: t };
  throw new AsmError(`invalid ${what} "${t}"`);
}

function parseMemory(text) {
  const m = MEM_RE.exec(text.trim());
  if (!m) throw new AsmError(`expected a memory operand like 8(%rsp), got "${text.trim()}"`);
  const disp = m[1].trim() === '' ? { number: 0n } : parseValue(m[1], 'displacement');
  return { disp, base: parseRegister(m[2]) };
}

function splitOperands(text) {
  const t = text.trim();
  if (t === '') return [];
  return t.split(',').map((s) => s.trim());
}

function expectOperands(operands, count, usage) {
  if (operands.length !== count) {
    throw new AsmError(`expected ${count} operand${count === 1 ? '' : 's'}: ${usage}`);
  }
}

/** Parse one instruction into an encoding plan (values may still be labels). */
function parseInstruction(name, operandText) {
  const spec = MNEMONICS.get(name);
  const ops = splitOperands(operandText);
  const ins = { icode: spec.icode, ifun: spec.ifun, rA: RNONE, rB: RNONE, valC: null };
  switch (spec.form) {
    case 'none':
      expectOperands(ops, 0, name);
      break;
    case 'rr':
      expectOperands(ops, 2, `${name} %rA, %rB`);
      ins.rA = parseRegister(ops[0]);
      ins.rB = parseRegister(ops[1]);
      break;
    case 'ir': {
      expectOperands(ops, 2, `${name} $V, %rB`);
      const imm = ops[0].startsWith('$') ? ops[0].slice(1) : ops[0];
      ins.valC = parseValue(imm, 'immediate');
      ins.rB = parseRegister(ops[1]);
      break;
    }
    case 'rm': {
      expectOperands(ops, 2, `${name} %rA, D(%rB)`);
      ins.rA = parseRegister(ops[0]);
      const mem = parseMemory(ops[1]);
      ins.rB = mem.base;
      ins.valC = mem.disp;
      break;
    }
    case 'mr': {
      expectOperands(ops, 2, `${name} D(%rB), %rA`);
      const mem = parseMemory(ops[0]);
      ins.rB = mem.base;
      ins.valC = mem.disp;
      ins.rA = parseRegister(ops[1]);
      break;
    }
    case 'dest':
      expectOperands(ops, 1, `${name} Dest`);
      ins.valC = parseValue(ops[0], 'destination');
      break;
    case 'r':
      expectOperands(ops, 1, `${name} %rA`);
      ins.rA = parseRegister(ops[0]);
      break;
    default:
      throw new AsmError(`internal: unknown form ${spec.form}`);
  }
  ins.length = instructionLength(ins.icode);
  return ins;
}

function resolve(value, symbols) {
  if (value.number !== undefined) return value.number;
  if (!Object.hasOwn(symbols, value.label)) throw new AsmError(`undefined label "${value.label}"`);
  return BigInt(symbols[value.label]);
}

function le64(value) {
  let v = toU64(value);
  const bytes = [];
  for (let i = 0; i < 8; i += 1) {
    bytes.push(Number(v & 0xffn));
    v >>= 8n;
  }
  return bytes;
}

function encodeInstruction(ins, symbols) {
  const bytes = [(ins.icode << 4) | ins.ifun];
  if (ins.length === 2 || ins.length === 10) bytes.push((ins.rA << 4) | ins.rB);
  if (ins.valC) bytes.push(...le64(resolve(ins.valC, symbols)));
  return bytes;
}

/**
 * Assemble Y86-64 source.
 * @returns {{
 *   ok: boolean,
 *   errors: {line:number, message:string}[],
 *   listing: {line:number, text:string, addr:number|null, bytes:number[], kind:string}[],
 *   symbols: Record<string, number>,
 *   memory: Uint8Array,
 *   size: number,
 *   pcToLine: Record<number, number>,
 *   hex: string,
 * }}
 */
export function assemble(source) {
  const lines = String(source).replace(/\r\n?/g, '\n').split('\n');
  const errors = [];
  const symbols = Object.create(null);
  const items = [];
  let addr = 0;

  // Pass 1: parse, assign addresses, collect labels.
  lines.forEach((rawText, index) => {
    const line = index + 1;
    const item = { line, text: rawText, addr: null, bytes: [], kind: 'blank' };
    items.push(item);
    try {
      let rest = rawText.replace(/#.*$/, '').trim();
      let m;
      while ((m = LABEL_RE.exec(rest))) {
        const label = m[1];
        if (Object.hasOwn(symbols, label)) throw new AsmError(`label "${label}" is already defined`);
        symbols[label] = addr;
        item.addr = addr;
        item.kind = 'label';
        rest = rest.slice(m[0].length).trim();
      }
      if (rest === '') return;

      const [word] = rest.split(/\s+/, 1);
      const name = word.toLowerCase();
      const operandText = rest.slice(word.length);

      if (name.startsWith('.')) {
        item.kind = 'data';
        if (name === '.pos') {
          const n = parseNumber(operandText);
          if (n === null || n < 0n) throw new AsmError('.pos needs a non-negative number');
          addr = Number(n);
          item.addr = addr;
          item.kind = 'directive';
        } else if (name === '.align') {
          const n = parseNumber(operandText);
          if (n === null || n <= 0n) throw new AsmError('.align needs a positive number');
          const a = Number(n);
          addr = Math.ceil(addr / a) * a;
          item.addr = addr;
          item.kind = 'directive';
        } else if (name === '.quad') {
          item.value = parseValue(operandText, '.quad value');
          item.size = 8;
        } else if (name === '.byte') {
          item.value = parseValue(operandText, '.byte value');
          item.size = 1;
        } else {
          throw new AsmError(`unknown directive "${word}"`);
        }
        if (item.size) {
          item.addr = addr;
          addr += item.size;
        }
      } else if (MNEMONICS.has(name)) {
        item.kind = 'instruction';
        item.ins = parseInstruction(name, operandText);
        item.addr = addr;
        addr += item.ins.length;
      } else {
        throw new AsmError(`unknown instruction "${word}"`);
      }
      if (addr > MEM_SIZE) throw new AsmError(`program exceeds the ${MEM_SIZE}-byte memory`);
    } catch (err) {
      if (!(err instanceof AsmError)) throw err;
      errors.push({ line, message: err.message });
      item.kind = 'error';
    }
  });

  // Pass 2: encode.
  const memory = new Uint8Array(MEM_SIZE);
  const pcToLine = {};
  let size = 0;
  for (const item of items) {
    try {
      if (item.kind === 'instruction') {
        item.bytes = encodeInstruction(item.ins, symbols);
        pcToLine[item.addr] = item.line;
      } else if (item.kind === 'data') {
        const v = resolve(item.value, symbols);
        item.bytes = item.size === 8 ? le64(v) : [Number(toU64(v) & 0xffn)];
      }
    } catch (err) {
      if (!(err instanceof AsmError)) throw err;
      errors.push({ line: item.line, message: err.message });
      item.kind = 'error';
      item.bytes = [];
    }
    if (item.bytes.length > 0 && item.addr + item.bytes.length <= MEM_SIZE) {
      memory.set(item.bytes, item.addr);
      size = Math.max(size, item.addr + item.bytes.length);
    }
  }

  const listing = items.map(({ line, text, addr: a, bytes, kind }) => ({ line, text, addr: a, bytes, kind }));
  errors.sort((x, y) => x.line - y.line);

  return {
    ok: errors.length === 0,
    errors,
    listing,
    symbols: { ...symbols },
    memory,
    size,
    pcToLine,
    hex: toReadmemh(memory, size),
  };
}

/** Memory image in $readmemh format, one byte per line, 16 per row. */
export function toReadmemh(memory, size = memory.length) {
  const rows = ['@0'];
  for (let i = 0; i < size; i += 16) {
    const chunk = Array.from(memory.subarray(i, Math.min(i + 16, size)), (b) => b.toString(16).padStart(2, '0'));
    rows.push(chunk.join(' '));
  }
  return rows.join('\n') + '\n';
}
