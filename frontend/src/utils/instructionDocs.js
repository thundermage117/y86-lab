// Stage-by-stage computations (after CS:APP Figs. 4.18–4.21).
export const INSTRUCTIONS = [
  {
    name: 'OPq rA, rB', encoding: '6 fn rA rB',
    fetch: 'icode:ifun ← M1[PC]; rA:rB ← M1[PC+1]; valP ← PC+2',
    decode: 'valA ← R[rA]; valB ← R[rB]',
    execute: 'valE ← valB OP valA; set CC',
    memory: '—',
    writeback: 'R[rB] ← valE',
    pc: 'PC ← valP',
  },
  {
    name: 'rrmovq / cmovXX rA, rB', encoding: '2 fn rA rB',
    fetch: 'icode:ifun ← M1[PC]; rA:rB ← M1[PC+1]; valP ← PC+2',
    decode: 'valA ← R[rA]',
    execute: 'valE ← 0 + valA; Cnd ← Cond(CC, ifun)',
    memory: '—',
    writeback: 'if Cnd: R[rB] ← valE',
    pc: 'PC ← valP',
  },
  {
    name: 'irmovq V, rB', encoding: '3 0 F rB V',
    fetch: 'icode:ifun ← M1[PC]; rA:rB ← M1[PC+1]; valC ← M8[PC+2]; valP ← PC+10',
    decode: '—',
    execute: 'valE ← 0 + valC',
    memory: '—',
    writeback: 'R[rB] ← valE',
    pc: 'PC ← valP',
  },
  {
    name: 'rmmovq rA, D(rB)', encoding: '4 0 rA rB D',
    fetch: 'icode:ifun ← M1[PC]; rA:rB ← M1[PC+1]; valC ← M8[PC+2]; valP ← PC+10',
    decode: 'valA ← R[rA]; valB ← R[rB]',
    execute: 'valE ← valB + valC',
    memory: 'M8[valE] ← valA',
    writeback: '—',
    pc: 'PC ← valP',
  },
  {
    name: 'mrmovq D(rB), rA', encoding: '5 0 rA rB D',
    fetch: 'icode:ifun ← M1[PC]; rA:rB ← M1[PC+1]; valC ← M8[PC+2]; valP ← PC+10',
    decode: 'valB ← R[rB]',
    execute: 'valE ← valB + valC',
    memory: 'valM ← M8[valE]',
    writeback: 'R[rA] ← valM',
    pc: 'PC ← valP',
  },
  {
    name: 'jXX Dest', encoding: '7 fn Dest',
    fetch: 'icode:ifun ← M1[PC]; valC ← M8[PC+1]; valP ← PC+9',
    decode: '—',
    execute: 'Cnd ← Cond(CC, ifun)',
    memory: '—',
    writeback: '—',
    pc: 'PC ← Cnd ? valC : valP',
  },
  {
    name: 'call Dest', encoding: '8 0 Dest',
    fetch: 'icode:ifun ← M1[PC]; valC ← M8[PC+1]; valP ← PC+9',
    decode: 'valB ← R[%rsp]',
    execute: 'valE ← valB + (−8)',
    memory: 'M8[valE] ← valP',
    writeback: 'R[%rsp] ← valE',
    pc: 'PC ← valC',
  },
  {
    name: 'ret', encoding: '9 0',
    fetch: 'icode:ifun ← M1[PC]; valP ← PC+1',
    decode: 'valA ← R[%rsp]; valB ← R[%rsp]',
    execute: 'valE ← valB + 8',
    memory: 'valM ← M8[valA]',
    writeback: 'R[%rsp] ← valE',
    pc: 'PC ← valM',
  },
  {
    name: 'pushq rA', encoding: 'A 0 rA F',
    fetch: 'icode:ifun ← M1[PC]; rA:rB ← M1[PC+1]; valP ← PC+2',
    decode: 'valA ← R[rA]; valB ← R[%rsp]',
    execute: 'valE ← valB + (−8)',
    memory: 'M8[valE] ← valA',
    writeback: 'R[%rsp] ← valE',
    pc: 'PC ← valP',
  },
  {
    name: 'popq rA', encoding: 'B 0 rA F',
    fetch: 'icode:ifun ← M1[PC]; rA:rB ← M1[PC+1]; valP ← PC+2',
    decode: 'valA ← R[%rsp]; valB ← R[%rsp]',
    execute: 'valE ← valB + 8',
    memory: 'valM ← M8[valA]',
    writeback: 'R[%rsp] ← valE; R[rA] ← valM',
    pc: 'PC ← valP',
  },
  {
    name: 'halt / nop', encoding: '0 0 / 1 0',
    fetch: 'icode:ifun ← M1[PC]; valP ← PC+1',
    decode: '—', execute: '—', memory: '—', writeback: '—',
    pc: 'halt: stop with status HLT; nop: PC ← valP',
  },
];

const SUMMARY = {
  'OPq rA, rB': 'Integer operation on two registers: rB ← rB op rA. Sets ZF, SF and OF.',
  'rrmovq / cmovXX rA, rB': 'Copy register rA into rB (cmovXX only if the condition holds).',
  'irmovq V, rB': 'Load the 64-bit constant V into rB.',
  'rmmovq rA, D(rB)': 'Store rA to memory at address rB + D.',
  'mrmovq D(rB), rA': 'Load the word at address rB + D into rA.',
  'jXX Dest': 'Jump to Dest (jXX only if the condition holds). The pipeline predicts taken.',
  'call Dest': 'Push the return address and jump to Dest.',
  ret: 'Pop the return address and jump to it. Stalls the pipeline for 3 cycles.',
  'pushq rA': 'Decrement %rsp by 8 and store rA at the new top of stack.',
  'popq rA': 'Load the top of stack into rA and increment %rsp by 8.',
  'halt / nop': 'halt stops the processor (status HLT); nop does nothing.',
};

const CONDITIONS = {
  le: 'less or equal (signed)', l: 'less (signed)', e: 'equal / zero', ne: 'not equal / not zero',
  ge: 'greater or equal (signed)', g: 'greater (signed)',
};

const ENTRY_FOR = {
  addq: 'OPq rA, rB', subq: 'OPq rA, rB', andq: 'OPq rA, rB', xorq: 'OPq rA, rB',
  rrmovq: 'rrmovq / cmovXX rA, rB',
  irmovq: 'irmovq V, rB', rmmovq: 'rmmovq rA, D(rB)', mrmovq: 'mrmovq D(rB), rA',
  jmp: 'jXX Dest', call: 'call Dest', ret: 'ret', pushq: 'pushq rA', popq: 'popq rA',
  halt: 'halt / nop', nop: 'halt / nop',
};
for (const c of Object.keys(CONDITIONS)) {
  ENTRY_FOR[`cmov${c}`] = 'rrmovq / cmovXX rA, rB';
  ENTRY_FOR[`j${c}`] = 'jXX Dest';
}

const OP_SUMMARY = { addq: 'rB ← rB + rA', subq: 'rB ← rB − rA', andq: 'rB ← rB & rA', xorq: 'rB ← rB ^ rA' };

/** Documentation for one mnemonic, for editor hovers and completions. */
export function docForMnemonic(mnemonic) {
  const m = mnemonic.toLowerCase();
  const name = ENTRY_FOR[m];
  if (!name) return null;
  const entry = INSTRUCTIONS.find((i) => i.name === name);
  let summary = SUMMARY[name];
  const cond = /^(?:cmov|j)(le|l|e|ne|ge|g)$/.exec(m)?.[1];
  if (cond) summary = `${m.startsWith('j') ? 'Jump' : 'Move'} if ${CONDITIONS[cond]}. ${summary}`;
  if (OP_SUMMARY[m]) summary = `${OP_SUMMARY[m]}. Sets ZF, SF and OF.`;
  return { mnemonic: m, ...entry, summary };
}
