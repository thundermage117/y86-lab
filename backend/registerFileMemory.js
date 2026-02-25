'use strict';

const fs = require('fs');

const REG_NAMES = [
  'rax', 'rcx', 'rdx', 'rbx',
  'rsp', 'rbp', 'rsi', 'rdi',
  'r8', 'r9', 'r10', 'r11',
  'r12', 'r13', 'r14',
];

const WORD_HEX_RE = /^[0-9a-fA-F]+$/;

function normalizeWord(line) {
  return `0x${line.trim().toLowerCase().padStart(16, '0').slice(-16)}`;
}

function parseRegisterFileMemory(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split(/\r?\n/);
  const values = [];

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line || line.startsWith('//')) continue;
    if (!WORD_HEX_RE.test(line)) continue;
    values.push(normalizeWord(line));
  }

  const registers = {};
  for (let i = 0; i < REG_NAMES.length; i += 1) {
    registers[REG_NAMES[i]] = values[i] ?? '0x0000000000000000';
  }

  return { registers };
}

module.exports = { parseRegisterFileMemory, REG_NAMES };
