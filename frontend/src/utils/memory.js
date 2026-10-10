// Data-memory model: initial image plus the writes the CPU performed.

import { hexToBytes } from './format.js';

/** Memory accesses per cycle for either CPU. */
export function memoryAccess(cycle, mode) {
  if (!cycle) return null;
  if (mode === 'sequential') {
    const m = cycle.memory;
    return { read: m.read, write: m.write, addr: m.addr, data: m.data, value: m.write ? m.data : cycle.valM, error: m.error, text: cycle.text };
  }
  const m = cycle.stages.memory;
  if (m.bubble) return null;
  return { read: m.read, write: m.write, addr: m.addr, data: m.data, value: m.write ? m.data : m.valM, error: m.error, text: m.text };
}

/** All successful writes, in order. A write in cycle i is visible from cycle i+1. */
export function collectWrites(cycles, mode) {
  const writes = [];
  cycles.forEach((cycle, i) => {
    const a = memoryAccess(cycle, mode);
    if (a?.write && !a.error && a.addr !== null) {
      writes.push({ cycle: i, addr: Number(BigInt(a.addr)), data: a.data, text: a.text });
    }
  });
  return writes;
}

function writeWord(mem, addr, hex) {
  let v = BigInt(hex);
  for (let k = 0; k < 8; k += 1) {
    mem[addr + k] = Number(v & 0xffn);
    v >>= 8n;
  }
}

export function readWord(mem, addr) {
  let v = 0n;
  for (let k = 7; k >= 0; k -= 1) v = (v << 8n) | BigInt(mem[addr + k] ?? 0);
  return '0x' + v.toString(16).padStart(16, '0');
}

/** Memory contents at the start of cycle `cycleIdx`. */
export function memoryAt(imageHex, writes, cycleIdx, size = 8192) {
  const mem = new Uint8Array(size);
  mem.set(hexToBytes(imageHex ?? '').subarray(0, size));
  for (const w of writes) {
    if (w.cycle >= cycleIdx) break;
    writeWord(mem, w.addr, w.data);
  }
  return mem;
}

/**
 * Words worth showing: data directives from the program plus every word the
 * program ever writes, each with its label (if any).
 */
export function interestingWords(program, writes) {
  const addrs = new Set();
  for (const item of program?.listing ?? []) {
    if (item.kind === 'data' && item.bytes.length === 8) addrs.add(item.addr);
  }
  for (const w of writes) addrs.add(w.addr);
  const labels = new Map(Object.entries(program?.symbols ?? {}).map(([name, a]) => [a, name]));
  return [...addrs].sort((a, b) => a - b).map((addr) => ({ addr, label: labels.get(addr) ?? null }));
}
