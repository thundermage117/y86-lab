// Minimal, scope-aware VCD parser.
//
// Samples the design once per clock cycle, using the values *just before* each
// rising clock edge: by then all combinational logic has settled, so a
// sample is the complete end-of-cycle state (pipeline registers, the values
// computed from them, and the control signals that the edge will act on).

const SCALAR_RE = /^([01xzXZ])(.+)$/;

/**
 * @param {string} text VCD file contents
 * @param {{clock: string}} options name of the clock signal (without scope)
 * @returns {{
 *   timescale: string|null,
 *   signals: string[],               // full names, e.g. "proc.F_stall"
 *   samples: Record<string, string>[], // signal -> raw value ('0','1','x' or bit string)
 *   sampleTimes: number[],
 * }}
 */
export function parseVcd(text, { clock }) {
  const idToNames = new Map();
  const scope = [];
  let timescale = null;
  let pos = 0;

  // ---- Header
  const headerEnd = text.indexOf('$enddefinitions');
  if (headerEnd < 0) throw new Error('VCD has no $enddefinitions');
  const header = text.slice(0, headerEnd);
  const tokens = header.split(/\s+/).filter(Boolean);
  for (let i = 0; i < tokens.length; i += 1) {
    const tok = tokens[i];
    if (tok === '$scope') {
      scope.push(tokens[i + 2]);
      i += 3;
    } else if (tok === '$upscope') {
      scope.pop();
      i += 1;
    } else if (tok === '$var') {
      // $var <type> <width> <id> <name> [<range>] $end
      const id = tokens[i + 3];
      const name = [...scope, tokens[i + 4]].join('.');
      if (!idToNames.has(id)) idToNames.set(id, []);
      idToNames.get(id).push(name);
      while (tokens[i] !== '$end') i += 1;
    } else if (tok === '$timescale') {
      const parts = [];
      for (i += 1; tokens[i] !== '$end'; i += 1) parts.push(tokens[i]);
      timescale = parts.join('');
    } else if (tok === '$comment' || tok === '$date' || tok === '$version') {
      while (tokens[i] !== '$end') i += 1;
    }
  }

  const signals = [...idToNames.values()].flat();
  const clockName = signals.find((s) => s === clock || s.endsWith(`.${clock}`));
  if (!clockName) throw new Error(`clock signal "${clock}" not found in VCD`);

  // ---- Value changes
  pos = text.indexOf('$end', headerEnd) + 4;
  const body = text.slice(pos);
  const state = Object.create(null);
  const samples = [];
  const sampleTimes = [];
  let pending = [];
  let time = 0;

  const flush = () => {
    const rising = pending.some(([name, v]) => name === clockName && v === '1') && state[clockName] === '0';
    if (rising) {
      samples.push({ ...state });
      sampleTimes.push(time);
    }
    for (const [name, v] of pending) state[name] = v;
    pending = [];
  };

  const set = (id, value) => {
    const names = idToNames.get(id);
    if (!names) return;
    for (const name of names) pending.push([name, value]);
  };

  const lines = body.split('\n');
  let inComment = false;
  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;
    if (inComment) {
      if (line.includes('$end')) inComment = false;
      continue;
    }
    const c = line[0];
    if (c === '#') {
      flush();
      time = Number(line.slice(1));
    } else if (c === 'b' || c === 'B' || c === 'r' || c === 'R') {
      const space = line.indexOf(' ');
      set(line.slice(space + 1).trim(), line.slice(1, space).toLowerCase());
    } else if (c === '$') {
      if (line.startsWith('$comment') && !line.includes('$end')) inComment = true;
      // $dumpvars / $dumpall / $end markers carry no values themselves
    } else {
      const m = SCALAR_RE.exec(line);
      if (m) set(m[2], m[1].toLowerCase());
    }
  }
  flush();

  return { timescale, signals, samples, sampleTimes };
}

/** Raw VCD value -> BigInt, or null if it contains x/z. */
export function toBigInt(raw) {
  if (raw === undefined || raw === null) return null;
  if (/[xz]/.test(raw)) return null;
  return BigInt('0b' + raw);
}

/** Raw VCD value -> Number (for narrow fields), or null. */
export function toNumber(raw) {
  const v = toBigInt(raw);
  return v === null ? null : Number(v);
}

export function toBool(raw) {
  const v = toBigInt(raw);
  return v === null ? null : v !== 0n;
}

/** Raw VCD value -> '0x' + 16 hex digits, or null. */
export function toHex64(raw) {
  const v = toBigInt(raw);
  return v === null ? null : '0x' + v.toString(16).padStart(16, '0');
}
