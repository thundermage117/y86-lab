'use strict';

const fs = require('fs');

function parseInstructionMemory(fetchFilePath) {
  const content = fs.readFileSync(fetchFilePath, 'utf8');
  const match = content.match(/^\s*reg\s*\[\s*0\s*:\s*(\d+)\s*\]\s*Instruction_Mem\s*=\s*'h([0-9a-fA-F_]+)\s*;/m);

  if (!match) {
    throw new Error('Instruction_Mem hex literal not found in fetch.v');
  }

  const maxBitIndex = Number.parseInt(match[1], 10);
  const bitWidth = maxBitIndex + 1;
  const byteCount = Math.ceil(bitWidth / 8);
  const requiredHexDigits = Math.ceil(bitWidth / 4);

  let hexLiteral = match[2].replace(/_/g, '').toUpperCase();
  if (hexLiteral.length % 2 !== 0) hexLiteral = `0${hexLiteral}`;
  if (hexLiteral.length < requiredHexDigits) {
    hexLiteral = hexLiteral.padStart(requiredHexDigits, '0');
  }

  const bytes = [];
  for (let i = 0; i < hexLiteral.length; i += 2) {
    const hex = hexLiteral.slice(i, i + 2);
    const value = Number.parseInt(hex, 16);
    bytes.push({
      index: i / 2,
      bitAddress: (i / 2) * 8,
      hex,
      binary: value.toString(2).padStart(8, '0'),
    });
  }

  return {
    bitWidth,
    byteCount,
    bytes,
  };
}

module.exports = { parseInstructionMemory };
