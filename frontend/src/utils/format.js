import { REG_NAMES, RNONE, STAT_NAMES } from '@y86/isa.js';

export const STAGE_KEYS = Object.freeze(['fetch', 'decode', 'execute', 'memory', 'writeback']);
export const STAGE_LABELS = Object.freeze({
  fetch: 'Fetch', decode: 'Decode', execute: 'Execute', memory: 'Memory', writeback: 'Write-back',
});
export const STAGE_LETTERS = Object.freeze({
  fetch: 'F', decode: 'D', execute: 'E', memory: 'M', writeback: 'W',
});

const HEX_RE = /^0x[0-9a-f]+$/i;

/** 64-bit register/word value ('0x' + 16 digits) in the chosen format. */
export function formatWord(hex, numberFormat = 'dec', { signed = true } = {}) {
  if (hex === null || hex === undefined) return '—';
  if (typeof hex !== 'string' || !HEX_RE.test(hex)) return String(hex);
  const value = BigInt(hex);
  if (numberFormat === 'hex') return '0x' + value.toString(16);
  return (signed ? BigInt.asIntN(64, value) : value).toString(10);
}

/** Address in compact form: 0x1f / 31. */
export function formatAddr(value, numberFormat = 'hex') {
  if (value === null || value === undefined) return '—';
  const n = typeof value === 'string' ? BigInt(value) : BigInt(value);
  return numberFormat === 'hex' ? '0x' + n.toString(16) : n.toString(10);
}

/** Fixed-width hex address for tables. */
export function padAddr(value, digits = 4) {
  if (value === null || value === undefined) return '—';
  return '0x' + BigInt(value).toString(16).padStart(digits, '0');
}

export function regLabel(id) {
  if (id === null || id === undefined || id === RNONE) return '—';
  return `%${REG_NAMES[id] ?? '?'}`;
}

export function statLabel(stat) {
  return stat === null || stat === undefined ? '—' : STAT_NAMES[stat];
}

export function hexToBytes(hex) {
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i += 1) out[i] = parseInt(hex.slice(2 * i, 2 * i + 2), 16);
  return out;
}

export function flagsLabel(cc) {
  if (!cc) return '—';
  return `ZF=${+cc.zf} SF=${+cc.sf} OF=${+cc.of}`;
}

export function plural(n, word, pluralWord = `${word}s`) {
  return `${n} ${n === 1 ? word : pluralWord}`;
}
