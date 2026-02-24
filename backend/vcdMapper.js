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

const STAT_NAMES = {
  0x0: 'AOK',
  0x1: 'HLT',
  0x2: 'ADR',
  0x3: 'INS',
};

const REG_NAMES = ['rax', 'rcx', 'rdx', 'rbx', 'rsp', 'rbp', 'rsi', 'rdi',
                   'r8', 'r9', 'r10', 'r11', 'r12', 'r13', 'r14'];

// Signals we care about from proc.vcd
const SIGNALS_OF_INTEREST = new Set([
  'f_icode', 'D_icode', 'E_icode', 'M_icode', 'W_icode',
  'f_ifun', 'D_ifun', 'E_ifun', 'M_ifun',
  'f_stat', 'D_stat', 'E_stat', 'M_stat', 'W_stat', 'm_stat',
  'f_pc', 'f_predPC', 'F_predPC', 'D_pc', 'E_pc', 'M_pc', 'W_pc',
  'cc', 'new_cc', 'set_cc', 'e_Cnd', 'M_Cnd',
  'instr_valid', 'imem_error',
  'F_stall', 'F_bubble', 'D_stall', 'D_bubble', 'E_stall', 'E_bubble', 'M_stall', 'M_bubble', 'W_stall', 'W_bubble',
  'clock',
  ...REG_NAMES,
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

  function fmtHex(val, widthNibbles = 16) {
    if (val === null) return 'x';
    return '0x' + val.toString(16).padStart(widthNibbles, '0');
  }

  function fmtSmallHex(val) {
    if (val === null) return 'x';
    return '0x' + val.toString(16).toUpperCase();
  }

  function fmtStat(val) {
    if (val === null) return { raw: null, hex: 'x', name: 'x' };
    return {
      raw: val,
      hex: fmtSmallHex(val),
      name: STAT_NAMES[val] ?? `0x${val.toString(16).toUpperCase()}`,
    };
  }

  function fmtBoolean(name) {
    const val = getVal(name);
    if (val === null) return null;
    return Boolean(val);
  }

  function makeStage(stageKey, signalName, opts = {}) {
    const icode = getVal(signalName);
    const statVal = opts.statSignal ? getVal(opts.statSignal) : null;
    const ifunVal = opts.ifunSignal ? getVal(opts.ifunSignal) : null;
    const pcVal = opts.pcSignal ? getVal(opts.pcSignal) : null;
    const stat = fmtStat(statVal);
    return {
      icode,
      icode_name: icode !== null ? (ICODE_NAMES[icode] ?? `0x${icode.toString(16)}`) : 'x',
      ifun: ifunVal,
      ifun_hex: fmtSmallHex(ifunVal),
      pc: pcVal,
      pc_hex: fmtHex(pcVal),
      stat: stat.raw,
      stat_hex: stat.hex,
      stat_name: stat.name,
      stage: stageKey,
    };
  }

  function fmtReg(name) {
    return fmtHex(getVal(name));
  }

  const registers = {};
  for (const r of REG_NAMES) registers[r] = fmtReg(r);

  const ccVal = getVal('cc');
  const newCcVal = getVal('new_cc');

  return {
    fetch: makeStage('fetch', 'f_icode', { ifunSignal: 'f_ifun', statSignal: 'f_stat', pcSignal: 'f_pc' }),
    decode: makeStage('decode', 'D_icode', { ifunSignal: 'D_ifun', statSignal: 'D_stat', pcSignal: 'D_pc' }),
    execute: makeStage('execute', 'E_icode', { ifunSignal: 'E_ifun', statSignal: 'E_stat', pcSignal: 'E_pc' }),
    memory: makeStage('memory', 'M_icode', { ifunSignal: 'M_ifun', statSignal: 'M_stat', pcSignal: 'M_pc' }),
    writeback: makeStage('writeback', 'W_icode', { statSignal: 'W_stat', pcSignal: 'W_pc' }),
    registers,
    control: {
      F_stall: fmtBoolean('F_stall'),
      F_bubble: fmtBoolean('F_bubble'),
      D_stall: fmtBoolean('D_stall'),
      D_bubble: fmtBoolean('D_bubble'),
      E_stall: fmtBoolean('E_stall'),
      E_bubble: fmtBoolean('E_bubble'),
      M_stall: fmtBoolean('M_stall'),
      M_bubble: fmtBoolean('M_bubble'),
      W_stall: fmtBoolean('W_stall'),
      W_bubble: fmtBoolean('W_bubble'),
      instr_valid: fmtBoolean('instr_valid'),
      imem_error: fmtBoolean('imem_error'),
    },
    flags: {
      cc: ccVal,
      cc_hex: fmtSmallHex(ccVal),
      zf: ccVal === null ? null : Boolean(ccVal & 0b001),
      sf: ccVal === null ? null : Boolean(ccVal & 0b010),
      of: ccVal === null ? null : Boolean(ccVal & 0b100),
      new_cc: newCcVal,
      new_cc_hex: fmtSmallHex(newCcVal),
      new_zf: newCcVal === null ? null : Boolean(newCcVal & 0b001),
      new_sf: newCcVal === null ? null : Boolean(newCcVal & 0b010),
      new_of: newCcVal === null ? null : Boolean(newCcVal & 0b100),
      set_cc: fmtBoolean('set_cc'),
      e_Cnd: fmtBoolean('e_Cnd'),
      M_Cnd: fmtBoolean('M_Cnd'),
    },
    meta: {
      predPC: fmtHex(getVal('f_predPC')),
      fetchRegPredPC: fmtHex(getVal('F_predPC')),
      memory_stat: fmtStat(getVal('m_stat')),
    },
  };
}

module.exports = { parseVCD };
