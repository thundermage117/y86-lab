import { test } from 'node:test';
import assert from 'node:assert/strict';
import { assemble, disassemble, decodeInstruction } from '../y86/index.js';

const hex = (bytes) => Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');

test('encodes every instruction form like yas', () => {
  const cases = [
    ['halt', '00'],
    ['nop', '10'],
    ['rrmovq %rsp, %rbx', '2043'],
    ['cmovle %rax, %rcx', '2101'],
    ['cmovg %r14, %r8', '26e8'],
    ['irmovq $-1, %rdx', '30f2ffffffffffffffff'],
    ['irmovq $0x123, %r9', '30f92301000000000000'],
    ['rmmovq %rsi, 16(%rsp)', '40641000000000000000'],
    ['mrmovq -8(%rbp), %rdi', '5075f8ffffffffffffff'],
    ['mrmovq (%rdi), %r10', '50a70000000000000000'],
    ['addq %rcx, %rax', '6010'],
    ['subq %rcx, %rdx', '6112'],
    ['andq %rsi, %rsi', '6266'],
    ['xorq %rax, %rax', '6300'],
    ['jmp 0x40', '704000000000000000'],
    ['jge 20', '751400000000000000'],
    ['call 0x100', '800001000000000000'],
    ['ret', '90'],
    ['pushq %rbp', 'a05f'],
    ['popq %r12', 'b0cf'],
  ];
  for (const [src, want] of cases) {
    const out = assemble(src);
    assert.deepEqual(out.errors, [], src);
    assert.equal(hex(out.listing[0].bytes), want, src);
  }
});

test('assembles sum_1_to_100 to the same bytes as the hardware smoke test', () => {
  const src = `
    irmovq $0, %rax
    irmovq $1, %rcx
loop: addq %rcx, %rax
    irmovq $1, %rdx
    addq %rdx, %rcx
    irmovq $100, %rdx
    subq %rcx, %rdx
    jge loop
    halt`;
  const out = assemble(src);
  assert.ok(out.ok);
  assert.equal(out.symbols.loop, 0x14);
  assert.equal(out.size, 0x38);
  assert.equal(
    hex(out.memory.subarray(0, out.size)),
    '30f00000000000000000' + '30f10100000000000000' + '6010' + '30f20100000000000000' +
    '6021' + '30f26400000000000000' + '6112' + '751400000000000000' + '00',
  );
  assert.match(out.hex, /^@0\n30 f0 00/);
});

test('supports labels, forward references and data directives', () => {
  const out = assemble(`
    .pos 0
    irmovq stack, %rsp
    jmp main
    .align 8
array: .quad 0xdeadbeef
       .quad array
       .byte 7
main: halt
    .pos 0x200
stack:`);
  assert.deepEqual(out.errors, []);
  assert.equal(out.symbols.array, 0x18);
  assert.equal(out.symbols.main, 0x29);
  assert.equal(out.symbols.stack, 0x200);
  assert.equal(hex(out.memory.subarray(0x18, 0x20)), 'efbeadde00000000');
  assert.equal(hex(out.memory.subarray(0x20, 0x28)), '1800000000000000');
  assert.equal(out.memory[0x28], 7);
  assert.equal(out.pcToLine[0], 3);
});

test('reports errors with line numbers and keeps going', () => {
  const out = assemble(['irmovq $1, %rax', 'movq %rax, %rbx', 'addq %rax', 'jmp nowhere', 'pushq %rzz', 'halt'].join('\n'));
  assert.equal(out.ok, false);
  assert.deepEqual(out.errors.map((e) => e.line), [2, 3, 4, 5]);
  assert.match(out.errors[0].message, /unknown instruction/);
  assert.match(out.errors[1].message, /expected 2 operands/);
  assert.match(out.errors[2].message, /undefined label "nowhere"/);
  assert.match(out.errors[3].message, /unknown register/);
});

test('rejects duplicate labels and programs larger than memory', () => {
  assert.match(assemble('a: nop\na: nop').errors[0].message, /already defined/);
  assert.match(assemble('.pos 8190\nirmovq $1, %rax').errors[0].message, /exceeds/);
});

test('disassembler round-trips assembler output', () => {
  const src = ['irmovq $-1, %rdx', 'rmmovq %rsi, 16(%rsp)', 'cmovne %rax, %rbx', 'call 0x30', 'popq %rax', 'halt'];
  const out = assemble(src.join('\n'));
  const dis = disassemble(out.memory, 0, out.size).map((i) => i.text);
  assert.deepEqual(dis, ['irmovq $0xffffffffffffffff, %rdx', 'rmmovq %rsi, 0x10(%rsp)', 'cmovne %rax, %rbx', 'call 0x30', 'popq %rax', 'halt']);
  assert.equal(decodeInstruction(Uint8Array.of(0xf0), 0).valid, false);
});
