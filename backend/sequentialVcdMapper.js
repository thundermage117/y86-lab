'use strict';

const fs = require('fs');
const { REG_NAMES } = require('./registerFileMemory');

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

const SIGNALS_OF_INTEREST = new Set([
  'PC', 'PC_in',
  'icode', 'ifun', 'rA', 'rB',
  'valC', 'valP', 'valA', 'valB', 'valM', 'valE',
  'instr_valid', 'Cnd', 'imem_error', 'stat',
  'clk', 'clock',
  ...REG_NAMES.map((_, index) => `reg_store[${index}]`),
]);

function parseSequentialVCD(filePath, options = {}) {
  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split('\n');

  const symbolToName = {};
  for (const line of lines) {
    const m = line.match(/^\s*\$var\s+\S+\s+\d+\s+(\S+)\s+(\S+)/);
    if (!m) continue;
    const sym = m[1];
    const name = m[2].replace(/\[\d+:\d+\]/, '');
    if (SIGNALS_OF_INTEREST.has(name)) {
      symbolToName[sym] = name;
    }
  }

  const clockSym = Object.keys(symbolToName).find((sym) => {
    const name = symbolToName[sym];
    return name === 'clk' || name === 'clock';
  });

  const current = {};
  for (const sym of Object.keys(symbolToName)) current[sym] = null;

  const cycles = [];
  let pendingChanges = {};
  let prevClock = null;
  let seenFirstTimestamp = false;

  function applyAndCapture() {
    for (const [sym, val] of Object.entries(pendingChanges)) {
      current[sym] = val;
    }

    const newClock = clockSym && (clockSym in pendingChanges ? pendingChanges[clockSym] : current[clockSym]);
    if (clockSym && newClock === 1 && prevClock !== 1) {
      cycles.push(buildSequentialSnapshot(current, symbolToName));
    }
    if (clockSym && clockSym in pendingChanges) {
      prevClock = pendingChanges[clockSym];
    }
    pendingChanges = {};
  }

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;

    if (line.startsWith('$enddefinitions')) continue;
    if (line.startsWith('$dumpvars')) continue;
    if (line.startsWith('$end')) continue;
    if (line.startsWith('$date') || line.startsWith('$version') ||
        line.startsWith('$timescale') || line.startsWith('$scope') ||
        line.startsWith('$upscope') || line.startsWith('$var')) continue;

    if (line.startsWith('#')) {
      if (seenFirstTimestamp && Object.keys(pendingChanges).length > 0) {
        applyAndCapture();
      }
      seenFirstTimestamp = true;
      continue;
    }

    if (line.length >= 2 && /^[01xXzZ]$/.test(line[0]) && !line.startsWith('b')) {
      const sym = line.slice(1);
      if (!(sym in symbolToName)) continue;
      const bit = line[0];
      pendingChanges[sym] = /[xXzZ]/.test(bit) ? null : Number.parseInt(bit, 10);
      continue;
    }

    if (line.startsWith('b')) {
      const m = line.match(/^b([^\s]+)\s+(\S+)$/);
      if (!m) continue;
      const binStr = m[1];
      const sym = m[2];
      if (!(sym in symbolToName)) continue;
      pendingChanges[sym] = /[xXzZ]/.test(binStr) ? null : Number.parseInt(binStr, 2);
    }
  }

  if (Object.keys(pendingChanges).length > 0) {
    applyAndCapture();
  }

  const trimmed = trimSequentialCycles(cycles);
  hydrateRegisterSnapshots(trimmed, options.initialRegisters ?? null);
  return trimmed;
}

function trimSequentialCycles(cycles) {
  if (!Array.isArray(cycles) || cycles.length === 0) return [];

  let start = 0;
  while (start < cycles.length && (cycles[start]?.fetch?.icode_name ?? 'x') === 'x') {
    start += 1;
  }

  let end = cycles.length - 1;
  for (let i = start; i < cycles.length; i += 1) {
    const cycle = cycles[i];
    const hitHalt = cycle?.execute?.icode_name === 'HALT' || cycle?.meta?.memory_stat?.name === 'HLT';
    if (hitHalt) {
      end = i;
      break;
    }
  }

  return cycles.slice(start, end + 1);
}

function buildSequentialSnapshot(current, symbolToName) {
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
    return `0x${val.toString(16).padStart(widthNibbles, '0')}`;
  }

  function fmtSmallHex(val) {
    if (val === null) return 'x';
    return `0x${val.toString(16).toUpperCase()}`;
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

  function stage(stageKey, pcVal, icodeVal, ifunVal, statVal) {
    const stat = fmtStat(statVal);
    return {
      icode: icodeVal,
      icode_name: icodeVal !== null ? (ICODE_NAMES[icodeVal] ?? `0x${icodeVal.toString(16)}`) : 'x',
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

  const icode = getVal('icode');
  const ifun = getVal('ifun');
  const pcIn = getVal('PC_in');
  const nextPc = getVal('PC');
  const statVal = getVal('stat');
  const cnd = fmtBoolean('Cnd');
  const instrValid = fmtBoolean('instr_valid');
  const imemError = fmtBoolean('imem_error');

  const valA = getVal('valA');
  const valB = getVal('valB');
  const valC = getVal('valC');
  const valE = getVal('valE');
  const valM = getVal('valM');
  const valP = getVal('valP');
  const rA = getVal('rA');
  const rB = getVal('rB');

  let memRead = false;
  let memWrite = false;
  let memAddr = null;
  let memWriteData = null;

  if (icode !== null) {
    if (icode === 0x4 || icode === 0x8 || icode === 0xA) {
      memWrite = true;
      memAddr = valE;
      memWriteData = valA;
    } else if (icode === 0x5) {
      memRead = true;
      memAddr = valE;
    } else if (icode === 0x9 || icode === 0xB) {
      memRead = true;
      memAddr = valA;
    }
  }

  const memAddrInRange = Number.isInteger(memAddr) && memAddr >= 0 && memAddr < 128;

  const stat = fmtStat(statVal);
  const currentPc = pcIn;
  const dumpedRegisters = {};
  let hasDumpedRegisters = false;
  for (let i = 0; i < REG_NAMES.length; i += 1) {
    const hex = fmtHex(getVal(`reg_store[${i}]`));
    dumpedRegisters[REG_NAMES[i]] = hex;
    if (hex !== 'x') hasDumpedRegisters = true;
  }

  return {
    mode: 'sequential',
    fetch: stage('fetch', currentPc, icode, ifun, statVal),
    decode: stage('decode', currentPc, icode, ifun, statVal),
    execute: stage('execute', currentPc, icode, ifun, statVal),
    memory: stage('memory', currentPc, icode, ifun, statVal),
    writeback: stage('writeback', currentPc, icode, ifun, statVal),
    registers: hasDumpedRegisters ? dumpedRegisters : null,
    control: {
      F_stall: false,
      F_bubble: false,
      D_stall: false,
      D_bubble: false,
      E_stall: false,
      E_bubble: false,
      M_stall: false,
      M_bubble: false,
      W_stall: false,
      W_bubble: false,
      instr_valid: instrValid,
      imem_error: imemError,
    },
    flags: {
      cc: null,
      cc_hex: 'x',
      zf: null,
      sf: null,
      of: null,
      new_cc: null,
      new_cc_hex: 'x',
      new_zf: null,
      new_sf: null,
      new_of: null,
      set_cc: null,
      e_Cnd: cnd,
      M_Cnd: null,
    },
    meta: {
      predPC: fmtHex(nextPc),
      fetchRegPredPC: fmtHex(currentPc),
      memory_stat: stat,
      sequential: {
        pc_hex: fmtHex(currentPc),
        next_pc_hex: fmtHex(nextPc),
        valA_hex: fmtHex(valA),
        valB_hex: fmtHex(valB),
        valC_hex: fmtHex(valC),
        valE_hex: fmtHex(valE),
        valM_hex: fmtHex(valM),
        valP_hex: fmtHex(valP),
        rA_hex: fmtSmallHex(rA),
        rB_hex: fmtSmallHex(rB),
        cnd,
        instr_valid: instrValid,
        imem_error: imemError,
      },
    },
    dataMemory: {
      read: memRead,
      write: memWrite,
      address: memAddr,
      address_hex: fmtHex(memAddr),
      wordIndex: memAddrInRange ? memAddr : null,
      byteAddress_hex: memAddr === null ? 'x' : fmtHex(memAddr * 8),
      inRange: memAddrInRange,
      writeData: memWriteData,
      writeData_hex: fmtHex(memWriteData),
      readData: valM,
      readData_hex: fmtHex(valM),
      signals: {
        read: null,
        write: null,
        address_hex: 'x',
        writeData_hex: 'x',
      },
    },
    forwarding: {
      decode: {
        srcA: { raw: rA, hex: fmtSmallHex(rA), name: 'x', label: 'x', isNone: null },
        srcB: { raw: rB, hex: fmtSmallHex(rB), name: 'x', label: 'x', isNone: null },
      },
      execute: {
        dstE: { raw: null, hex: 'x', name: 'x', label: 'x', isNone: null },
        dstM: { raw: null, hex: 'x', name: 'x', label: 'x', isNone: null },
      },
      memory: {
        dstE: { raw: null, hex: 'x', name: 'x', label: 'x', isNone: null },
        dstM: { raw: null, hex: 'x', name: 'x', label: 'x', isNone: null },
      },
      writeback: {
        dstE: { raw: null, hex: 'x', name: 'x', label: 'x', isNone: null },
        dstM: { raw: null, hex: 'x', name: 'x', label: 'x', isNone: null },
      },
    },
  };
}

function parseHexRegisterId(value) {
  if (typeof value !== 'string' || !/^0x[0-9a-f]+$/i.test(value)) return null;
  const parsed = Number.parseInt(value, 16);
  return Number.isInteger(parsed) ? parsed : null;
}

function isHexWord(value) {
  return typeof value === 'string' && /^0x[0-9a-f]+$/i.test(value);
}

function normalizeHexWord(value) {
  if (!isHexWord(value)) return null;
  return `0x${value.slice(2).toLowerCase().padStart(16, '0').slice(-16)}`;
}

function computeSequentialDestinations(cycle) {
  const icode = cycle?.execute?.icode;
  const cnd = cycle?.meta?.sequential?.cnd;
  const rA = parseHexRegisterId(cycle?.meta?.sequential?.rA_hex);
  const rB = parseHexRegisterId(cycle?.meta?.sequential?.rB_hex);

  let destE = 0xF;
  let destM = 0xF;

  if (icode === null || icode === undefined) {
    return { destE, destM };
  }

  switch (icode) {
    case 0x2: // RRMOVQ / CMOVXX
      if (cnd === true) destE = rB ?? 0xF;
      break;
    case 0x3: // IRMOVQ
      destE = rB ?? 0xF;
      break;
    case 0x5: // MRMOVQ
      destM = rA ?? 0xF;
      break;
    case 0x6: // OPQ
      destE = rB ?? 0xF;
      break;
    case 0x8: // CALL
    case 0x9: // RET
    case 0xA: // PUSHQ
    case 0xB: // POPQ
      destE = 0x4;
      if (icode === 0xB) destM = rA ?? 0xF;
      break;
    default:
      break;
  }

  return { destE, destM };
}

function hydrateRegisterSnapshots(cycles, initialRegisters) {
  if (!Array.isArray(cycles) || cycles.length === 0) return;

  const hasAnyDumped = cycles.some((cycle) => cycle && cycle.registers && Object.values(cycle.registers).some((value) => value !== 'x'));
  if (hasAnyDumped) return;
  if (!initialRegisters || typeof initialRegisters !== 'object') return;

  const state = {};
  for (const regName of REG_NAMES) {
    state[regName] = normalizeHexWord(initialRegisters[regName]) ?? '0x0000000000000000';
  }

  for (const cycle of cycles) {
    const nextState = { ...state };
    const { destE, destM } = computeSequentialDestinations(cycle);

    if (destE >= 0 && destE < REG_NAMES.length) {
      const value = normalizeHexWord(cycle?.meta?.sequential?.valE_hex);
      if (value) nextState[REG_NAMES[destE]] = value;
    }

    if (destM >= 0 && destM < REG_NAMES.length) {
      const value = normalizeHexWord(cycle?.meta?.sequential?.valM_hex);
      if (value) nextState[REG_NAMES[destM]] = value;
    }

    cycle.registers = nextState;
    Object.assign(state, nextState);
  }
}

module.exports = { parseSequentialVCD };
