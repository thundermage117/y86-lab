import { useEffect, useRef } from 'react';
import { EditorState, Compartment } from '@codemirror/state';
import {
  EditorView, keymap, lineNumbers, highlightActiveLine, highlightActiveLineGutter, drawSelection,
} from '@codemirror/view';
import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands';
import { setDiagnostics, lintGutter } from '@codemirror/lint';
import { y86Language, y86Highlighting } from './y86Language.js';
import { y86Assist } from './y86Assist.js';
import { closeBrackets } from '@codemirror/autocomplete';

const theme = EditorView.theme({
  '&': { height: '100%', fontSize: '13.5px', backgroundColor: 'transparent', color: 'var(--text)' },
  '.cm-scroller': { fontFamily: 'var(--mono)', lineHeight: '1.6' },
  '.cm-content': { caretColor: 'var(--accent)', padding: '10px 0' },
  '.cm-gutters': { backgroundColor: 'transparent', color: 'var(--muted)', border: 'none' },
  '.cm-activeLine': { backgroundColor: 'var(--surface-hover)' },
  '.cm-activeLineGutter': { backgroundColor: 'transparent', color: 'var(--text)' },
  '&.cm-focused .cm-cursor': { borderLeftColor: 'var(--accent)' },
  '&.cm-focused .cm-selectionBackground, .cm-selectionBackground': { backgroundColor: 'var(--selection)' },
  '&.cm-focused': { outline: 'none' },
  '.cm-tooltip': { background: 'var(--surface-strong)', border: '1px solid var(--border-strong)', color: 'var(--text)', borderRadius: '8px' },
  '.cm-tooltip-autocomplete > ul > li[aria-selected]': { background: 'var(--accent)', color: 'var(--accent-ink)' },
  '.cm-completionDetail': { marginLeft: '10px', color: 'var(--muted)', fontStyle: 'normal' },
  '.cm-completionInfo': { maxWidth: '320px', padding: '6px 10px', fontFamily: 'var(--sans)' },
  '.cm-y86-doc': { padding: '8px 12px', maxWidth: '420px', fontFamily: 'var(--sans)', fontSize: '12.5px' },
  '.cm-y86-doc-title': { fontFamily: 'var(--mono)', fontWeight: '600', marginBottom: '4px' },
  '.cm-y86-doc-summary': { marginBottom: '4px' },
  '.cm-y86-doc-stage': { fontFamily: 'var(--mono)', color: 'var(--muted)', fontSize: '11.5px' },
});

function toDiagnostics(doc, errors) {
  return errors
    .filter((e) => e.line >= 1 && e.line <= doc.lines)
    .map((e) => {
      const line = doc.line(e.line);
      return { from: line.from, to: Math.max(line.from, line.to), severity: 'error', message: e.message };
    });
}

/**
 * CodeMirror 6 editor for Y86 assembly. Uncontrolled internally: external
 * `value` changes (e.g. loading an example) replace the document.
 */
export default function Y86Editor({ value, onChange, errors, onRun, symbols, ariaLabel = 'Y86-64 assembly source' }) {
  const host = useRef(null);
  const view = useRef(null);
  const callbacks = useRef({ onChange, onRun });
  const symbolsRef = useRef(symbols);
  const editable = useRef(new Compartment());

  useEffect(() => {
    callbacks.current = { onChange, onRun };
    symbolsRef.current = symbols;
  });

  useEffect(() => {
    const state = EditorState.create({
      doc: value,
      extensions: [
        lineNumbers(),
        highlightActiveLineGutter(),
        highlightActiveLine(),
        drawSelection(),
        history(),
        lintGutter(),
        y86Language,
        y86Highlighting,
        y86Assist(() => symbolsRef.current),
        closeBrackets(),
        theme,
        editable.current.of(EditorView.contentAttributes.of({ 'aria-label': ariaLabel })),
        keymap.of([
          { key: 'Mod-Enter', run: () => { callbacks.current.onRun?.(); return true; } },
          indentWithTab,
          ...defaultKeymap,
          ...historyKeymap,
        ]),
        EditorView.updateListener.of((update) => {
          if (update.docChanged) callbacks.current.onChange?.(update.state.doc.toString());
        }),
      ],
    });
    view.current = new EditorView({ state, parent: host.current });
    return () => view.current.destroy();
    // The editor is created once; later prop changes are applied below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const v = view.current;
    if (!v) return;
    const current = v.state.doc.toString();
    if (value !== current) {
      v.dispatch({ changes: { from: 0, to: current.length, insert: value } });
    }
  }, [value]);

  useEffect(() => {
    const v = view.current;
    if (!v) return;
    v.dispatch(setDiagnostics(v.state, toDiagnostics(v.state.doc, errors ?? [])));
  }, [errors, value]);

  return <div className="editor-host" ref={host} />;
}
