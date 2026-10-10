// Editor assistance for Y86 assembly: completions and hover documentation.
import { autocompletion } from '@codemirror/autocomplete';
import { hoverTooltip } from '@codemirror/view';
import { INSTRUCTION_MNEMONICS } from '@y86/assembler.js';
import { REG_NAMES } from '@y86/isa.js';
import { docForMnemonic } from '../../utils/instructionDocs.js';

const DIRECTIVE_DOCS = {
  '.pos': '.pos N: continue assembling at address N.',
  '.align': '.align N: advance to the next multiple of N (e.g. 8 before .quad data).',
  '.quad': '.quad V: an 8-byte little-endian value (number or label).',
  '.byte': '.byte V: a single byte.',
};

const REG_HINTS = { rsp: 'stack pointer (used by pushq, popq, call, ret)' };

const LABEL_DEF_RE = /^\s*([A-Za-z_.][\w.]*)\s*:/gm;

function labelsInDoc(doc) {
  const text = doc.toString();
  const labels = new Map();
  for (const m of text.matchAll(LABEL_DEF_RE)) {
    labels.set(m[1], doc.lineAt(m.index + m[0].indexOf(m[1])).number);
  }
  return labels;
}

/** True when the cursor is where an instruction mnemonic belongs. */
function atInstructionStart(lineText) {
  return /^\s*(?:[A-Za-z_.][\w.]*\s*:\s*)*$/.test(lineText);
}

function completionSource(context) {
  const word = context.matchBefore(/[%.$]?[\w.]*/);
  if (!word || (word.from === word.to && !context.explicit)) return null;
  const line = context.state.doc.lineAt(context.pos);
  const before = line.text.slice(0, word.from - line.from);
  if (before.includes('#')) return null;

  if (word.text.startsWith('%')) {
    return {
      from: word.from,
      options: REG_NAMES.map((r, id) => ({ label: `%${r}`, type: 'variable', detail: REG_HINTS[r] ?? `register ${id}` })),
    };
  }
  if (word.text.startsWith('.') && atInstructionStart(before)) {
    return {
      from: word.from,
      options: Object.entries(DIRECTIVE_DOCS).map(([label, info]) => ({ label, type: 'keyword', info })),
    };
  }
  if (atInstructionStart(before)) {
    return {
      from: word.from,
      validFor: /^\w*$/,
      options: INSTRUCTION_MNEMONICS.map((m) => {
        const doc = docForMnemonic(m);
        return { label: m, type: 'keyword', detail: doc?.encoding, info: doc?.summary };
      }),
    };
  }
  // Operand position: suggest labels (jump targets, addresses).
  const from = word.text.startsWith('$') ? word.from + 1 : word.from;
  const labels = [...labelsInDoc(context.state.doc).keys()];
  if (labels.length === 0) return null;
  return { from, options: labels.map((l) => ({ label: l, type: 'constant', detail: 'label' })) };
}

function tooltipDom(title, lines) {
  const dom = document.createElement('div');
  dom.className = 'cm-y86-doc';
  const head = document.createElement('div');
  head.className = 'cm-y86-doc-title';
  head.textContent = title;
  dom.append(head);
  for (const [cls, text] of lines) {
    const p = document.createElement('div');
    p.className = cls;
    p.textContent = text;
    dom.append(p);
  }
  return dom;
}

function hoverSource(getSymbols) {
  return hoverTooltip((view, pos) => {
    const line = view.state.doc.lineAt(pos);
    const text = line.text;
    const offset = pos - line.from;
    const hashAt = text.indexOf('#');
    if (hashAt >= 0 && offset >= hashAt) return null;
    let start = offset;
    let end = offset;
    while (start > 0 && /[%.\w]/.test(text[start - 1])) start -= 1;
    while (end < text.length && /[%.\w]/.test(text[end])) end += 1;
    const word = text.slice(start, end);
    if (!word) return null;

    let dom = null;
    const lower = word.toLowerCase();
    const doc = docForMnemonic(lower);
    if (doc) {
      dom = tooltipDom(`${lower}  ·  ${doc.encoding}`, [
        ['cm-y86-doc-summary', doc.summary],
        ['cm-y86-doc-stage', `Execute: ${doc.execute}`],
        ['cm-y86-doc-stage', `Memory: ${doc.memory}`],
        ['cm-y86-doc-stage', `Write-back: ${doc.writeback}`],
      ]);
    } else if (lower.startsWith('%') && REG_NAMES.includes(lower.slice(1))) {
      const id = REG_NAMES.indexOf(lower.slice(1));
      dom = tooltipDom(lower, [['cm-y86-doc-summary', `Register ID ${id.toString(16).toUpperCase()}${REG_HINTS[lower.slice(1)] ? ` · ${REG_HINTS[lower.slice(1)]}` : ''}`]]);
    } else if (DIRECTIVE_DOCS[lower]) {
      dom = tooltipDom(lower, [['cm-y86-doc-summary', DIRECTIVE_DOCS[lower]]]);
    } else {
      const labels = labelsInDoc(view.state.doc);
      if (labels.has(word)) {
        const addr = getSymbols()?.[word];
        dom = tooltipDom(`${word}:`, [
          ['cm-y86-doc-summary', addr === undefined
            ? `Label defined on line ${labels.get(word)}. Run the program to see its address.`
            : `Address 0x${addr.toString(16)} (${addr}), defined on line ${labels.get(word)}.`],
        ]);
      }
    }
    if (!dom) return null;
    return { pos: line.from + start, end: line.from + end, above: true, create: () => ({ dom }) };
  });
}

/** Editor extensions; `getSymbols` returns the last assembled symbol table. */
export function y86Assist(getSymbols) {
  return [
    autocompletion({ override: [completionSource], icons: false }),
    hoverSource(getSymbols),
  ];
}
