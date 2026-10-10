export const GLOSSARY = [
  ['Pipeline register', 'The F, D, E, M and W registers between stages. On each clock edge every instruction moves one stage forward, unless its stage is stalled.'],
  ['Stall', 'A pipeline register keeps its value for a cycle, so the instruction in that stage stays put. Shown as a repeated letter in the timeline.'],
  ['Bubble', 'A nop that the control logic loads into a pipeline register instead of the instruction above it. Bubbles fill the gap left by a stall or replace squashed instructions.'],
  ['Data hazard', 'An instruction needs a register value that an earlier instruction still in the pipeline has not written yet.'],
  ['Forwarding (bypassing)', 'Routing a value straight from where it is computed (e_valE, m_valM, M_valE, W_valM, W_valE) into Decode, instead of waiting for Write-back. Resolves most data hazards with zero delay.'],
  ['Load/use hazard', 'A load (mrmovq/popq) is immediately followed by an instruction that uses the loaded register. The value only exists after Memory, so one stall cycle is unavoidable.'],
  ['Control hazard', 'The next PC is not known in time. The PIPE CPU predicts jumps as taken and cannot predict ret.'],
  ['Misprediction', 'A conditional jump predicted taken turns out not taken (found in Execute). The two wrong-path instructions are replaced by bubbles: a 2-cycle penalty.'],
  ['Return stall', 'ret gets its target from the stack in Memory, so Fetch waits until ret reaches Write-back: 3 bubbles.'],
  ['CPI', 'Cycles per instruction. An ideal pipeline approaches 1; SEQ is exactly 1 but with a much longer clock period.'],
  ['Status codes', 'AOK normal, HLT halt executed, ADR bad address, INS invalid instruction. An exception stops the CPU when the faulting instruction reaches Write-back, so no younger instruction changes state.'],
  ['Condition codes', 'ZF (zero), SF (sign) and OF (overflow) are set by OPq and tested by jXX and cmovXX.'],
];

// Words in explanations that link to a glossary entry.
const TERM_PATTERNS = [
  ['Load/use hazard', /\bload\/use\b/i],
  ['Forwarding (bypassing)', /\bforward(?:ing|ed|s)?\b/i],
  ['Misprediction', /\bmispredict(?:ed|ion|ions)?\b/i],
  ['Bubble', /\bbubbles?\b/i],
  ['Stall', /\bstall(?:s|ed)?\b/i],
  ['Condition codes', /\bcondition codes?\b/i],
  ['CPI', /\bCPI\b/],
];

const DEFINITIONS = new Map(GLOSSARY);

/**
 * Split text into plain and glossary-term segments. Only the first occurrence
 * of each term is linked; `seen` carries that across calls for one paragraph.
 * @returns {{text:string, term?:string, definition?:string}[]}
 */
export function linkTerms(text, seen = new Set()) {
  const segments = [];
  let rest = text;
  for (;;) {
    let best = null;
    for (const [term, re] of TERM_PATTERNS) {
      if (seen.has(term)) continue;
      const m = re.exec(rest);
      if (m && (!best || m.index < best.index)) best = { term, index: m.index, match: m[0] };
    }
    if (!best) break;
    if (best.index > 0) segments.push({ text: rest.slice(0, best.index) });
    segments.push({ text: best.match, term: best.term, definition: DEFINITIONS.get(best.term) });
    seen.add(best.term);
    rest = rest.slice(best.index + best.match.length);
  }
  if (rest) segments.push({ text: rest });
  return segments;
}
