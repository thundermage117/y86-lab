'use strict';

const fs = require('fs');

const WORD_HEX_RE = /^[0-9a-fA-F]+$/;
const WORD_NIBBLES = 16;

function parseDataMemory(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split(/\r?\n/);

  const words = [];

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line || line.startsWith('//')) continue;
    if (!WORD_HEX_RE.test(line)) continue;

    const normalized = line.toLowerCase().padStart(WORD_NIBBLES, '0').slice(-WORD_NIBBLES);
    const wordIndex = words.length;

    words.push({
      index: wordIndex,
      byteAddress: wordIndex * 8,
      bitAddress: wordIndex * 64,
      hex: normalized,
      valueHex: `0x${normalized}`,
    });
  }

  return {
    wordBitWidth: 64,
    wordCount: words.length,
    words,
  };
}

module.exports = { parseDataMemory };
