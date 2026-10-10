import { StreamLanguage, HighlightStyle, syntaxHighlighting } from '@codemirror/language';
import { tags } from '@lezer/highlight';
import { INSTRUCTION_MNEMONICS, DIRECTIVES } from '@y86/assembler.js';
import { REG_NAMES } from '@y86/isa.js';

const MNEMONICS = new Set(INSTRUCTION_MNEMONICS);
const DIRS = new Set(DIRECTIVES);
const REGS = new Set(REG_NAMES.map((r) => `%${r}`));

/** Tokenizer for yas-style Y86-64 assembly. */
const y86Stream = {
  name: 'y86',
  token(stream) {
    if (stream.eatSpace()) return null;
    if (stream.match(/^#.*/)) return 'comment';
    if (stream.match(/^[A-Za-z_.][\w.]*(?=\s*:)/)) return 'labelName';
    if (stream.match(/^:/)) return 'punctuation';
    if (stream.match(/^\$-?(0x[0-9a-f]+|\d+)/i)) return 'number';
    if (stream.match(/^\$[A-Za-z_.][\w.]*/)) return 'labelName';
    if (stream.match(/^-?(0x[0-9a-f]+|\d+)/i)) return 'number';
    if (stream.match(/^%\w+/)) {
      return REGS.has(stream.current().toLowerCase()) ? 'variableName' : 'invalid';
    }
    if (stream.match(/^\.[a-z]+/i)) {
      return DIRS.has(stream.current().toLowerCase()) ? 'meta' : 'invalid';
    }
    if (stream.match(/^[A-Za-z_][\w.]*/)) {
      const word = stream.current().toLowerCase();
      if (MNEMONICS.has(word)) return 'keyword';
      return 'labelName';
    }
    if (stream.match(/^[(),]/)) return 'punctuation';
    stream.next();
    return null;
  },
  languageData: { commentTokens: { line: '#' } },
};

export const y86Language = StreamLanguage.define(y86Stream);

const highlight = HighlightStyle.define([
  { tag: tags.comment, color: 'var(--code-comment)', fontStyle: 'italic' },
  { tag: tags.keyword, color: 'var(--code-keyword)', fontWeight: '600' },
  { tag: tags.variableName, color: 'var(--code-register)' },
  { tag: tags.number, color: 'var(--code-number)' },
  { tag: tags.labelName, color: 'var(--code-label)' },
  { tag: tags.meta, color: 'var(--code-directive)' },
  { tag: tags.invalid, color: 'var(--danger)', textDecoration: 'underline wavy' },
  { tag: tags.punctuation, color: 'var(--muted)' },
]);

export const y86Highlighting = syntaxHighlighting(highlight);
