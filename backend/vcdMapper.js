'use strict';
const fs = require('fs');

const ICODE_NAMES = {
  0x0: 'HALT',
  0x1: 'NOP',
  0x2: 'CMOVXX',
  0x3: 'IRMOVQ',
  0x4: 'RMMOVQ',
  0x5: 'MRMOVQ',
  0x6: 'OPQ',
  0x7: 'JXX',
  0x8: 'CALL',
  0x9: 'RET',
  0xA: 'PUSHQ',
  0xB: 'POPQ',
};

// Signals we care about from proc.vcd
const SIGNALS_OF_INTEREST = new Set([
  'f_icode', 'D_icode', 'E_icode', 'M_icode', 'W_icode',
  'clock',
  'rax', 'rcx', 'rdx', 'rbx', 'rsp', 'rbp', 'rsi', 'rdi',
  'r8', 'r9', 'r10', 'r11', 'r12', 'r13', 'r14',
]);

/**
 * Parse a VCD file and return an array of cycle snapshots.
 * Each snapshot is captured on the rising edge of the clock.
 */
function parseVCD(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split('\n');

  // --- Phase 1: Build symbol → signal name map ---
  const symbolToName = {}; // e.g. { '!': 'f_icode', '&': 'clock', ... }
  for (const line of lines) {
    // $var wire 4 ! f_icode [3:0] $end
    const m = line.match(/^\s*\$var\s+\S+\s+\d+\s+(\S+)\s+(\S+)/);
    if (m) {
      const sym = m[1];
      const name = m[2].replace(/\[\d+:\d+\]/, ''); // strip bit range
      if (SIGNALS_OF_INTEREST.has(name)) {
        symbolToName[sym] = name;
      }
    }
  }

  // Find the clock symbol
  const clockSym = Object.keys(symbolToName).find(s => symbolToName[s] === 'clock');

  // --- Phase 2: Parse value changes and capture cycles ---
  const current = {}; // sym → numeric value (null = unknown/x/z)
  for (const sym of Object.keys(symbolToName)) current[sym] = null;

  const cycles = [];
  let pendingChanges = {};
  let prevClock = null;
  let seenFirstTimestamp = false;

  function applyAndCapture() {
    // Apply pending changes
    for (const [sym, val] of Object.entries(pendingChanges)) {
      current[sym] = val;
    }
    // Capture on rising clock edge
    const newClock = clockSym in pendingChanges ? pendingChanges[clockSym] : current[clockSym];
    if (clockSym && newClock === 1 && prevClock !== 1) {
      cycles.push(buildSnapshot(current, symbolToName));
    }
    if (clockSym && clockSym in pendingChanges) {
      prevClock = pendingChanges[clockSym];
    }
    pendingChanges = {};
  }

  for (const rawLine of lines) {
    const line = rawLine.trim();

    // Skip VCD keyword directives (but not the value-change data inside $dumpvars)
    if (line.startsWith('$enddefinitions')) continue;
    if (line.startsWith('$dumpvars')) continue;
    if (line.startsWith('$end')) continue;
    if (line.startsWith('$date') || line.startsWith('$version') ||
        line.startsWith('$timescale') || line.startsWith('$scope') ||
        line.startsWith('$upscope') || line.startsWith('$var')) continue;
    if (line === '') continue;

    // Timestamp marker: flush pending changes from previous timestamp
    if (line.startsWith('#')) {
      if (seenFirstTimestamp && Object.keys(pendingChanges).length > 0) {
        applyAndCapture();
      }
      seenFirstTimestamp = true;
      continue;
    }

    // Single-bit value change: e.g. "1&" or "0&" or "x!"
    if (line.length >= 2 && /^[01xXzZ]$/.test(line[0]) && !line.startsWith('b')) {
      const val = line[0];
      const sym = line.slice(1);
      if (sym in symbolToName) {
        const numVal = (val === 'x' || val === 'X' || val === 'z' || val === 'Z')
          ? null : parseInt(val, 10);
        pendingChanges[sym] = numVal;
      }
      continue;
    }

    // Multi-bit value change: e.g. "b11 !" or "bx 5"
    if (line.startsWith('b')) {
      const m = line.match(/^b([^\s]+)\s+(\S+)$/);
      if (m) {
        const binStr = m[1];
        const sym = m[2];
        if (sym in symbolToName) {
          const hasUnknown = /[xXzZ]/.test(binStr);
          pendingChanges[sym] = hasUnknown ? null : parseInt(binStr, 2);
        }
      }
      continue;
    }
  }

  // Flush any remaining changes
  if (Object.keys(pendingChanges).length > 0) {
    applyAndCapture();
  }

  return cycles;
}

function buildSnapshot(current, symbolToName) {
  // Reverse map: name → sym
  const nameToSym = {};
  for (const [sym, name] of Object.entries(symbolToName)) {
    nameToSym[name] = sym;
  }

  function getVal(name) {
    const sym = nameToSym[name];
    return sym !== undefined ? current[sym] : null;
  }

  function makeStage(signalName) {
    const icode = getVal(signalName);
    return {
      icode,
      icode_name: icode !== null ? (ICODE_NAMES[icode] ?? `0x${icode.toString(16)}`) : 'x',
    };
  }

  function fmtReg(name) {
    const val = getVal(name);
    if (val === null) return 'x';
    return '0x' + val.toString(16).padStart(16, '0');
  }

  const REG_NAMES = ['rax', 'rcx', 'rdx', 'rbx', 'rsp', 'rbp', 'rsi', 'rdi',
                     'r8', 'r9', 'r10', 'r11', 'r12', 'r13', 'r14'];
  const registers = {};
  for (const r of REG_NAMES) registers[r] = fmtReg(r);

  return {
    fetch:     makeStage('f_icode'),
    decode:    makeStage('D_icode'),
    execute:   makeStage('E_icode'),
    memory:    makeStage('M_icode'),
    writeback: makeStage('W_icode'),
    registers,
  };
}

module.exports = { parseVCD };
