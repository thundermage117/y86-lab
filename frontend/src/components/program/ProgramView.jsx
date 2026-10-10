import { useMemo } from 'react';
import Panel from '../common/Panel.jsx';
import Y86Editor from './Y86Editor.jsx';
import Listing from './Listing.jsx';

export default function ProgramView({ sim, onRun, onOpenPipeline }) {
  const { examples, exampleId, example, selectExample, source, setSource, diagnostics, status, result, dirty } = sim;
  const errorsByLine = useMemo(() => new Map(diagnostics.map((d) => [d.line, d.message])), [diagnostics]);
  const running = status === 'running';
  const program = result?.program;

  return (
    <div className="program-layout">
      <Panel
        title="Program"
        subtitle="Write Y86-64 assembly or start from an example. Ctrl/⌘ + Enter assembles and runs it on both Verilog CPUs."
        className="editor-panel"
        actions={(
          <>
            <label className="example-select">
              <span className="sr-only">Load example program</span>
              <select
                value={exampleId ?? ''}
                onChange={(e) => selectExample(e.target.value)}
                disabled={examples.length === 0}
              >
                <option value="" disabled>Examples…</option>
                {examples.map((ex) => <option key={ex.id} value={ex.id}>{ex.title}</option>)}
              </select>
            </label>
            <button type="button" className="btn btn-primary" onClick={onRun} disabled={running}>
              {running ? 'Running…' : 'Assemble & Run'}
            </button>
          </>
        )}
      >
        <div className="editor-frame">
          <Y86Editor value={source} onChange={setSource} errors={diagnostics} onRun={onRun} symbols={result?.program?.symbols} />
        </div>
        {diagnostics.length > 0 && (
          <ul className="diagnostics" aria-label="Assembler errors">
            {diagnostics.map((d) => (
              <li key={`${d.line}-${d.message}`}><span className="diag-line">Line {d.line}</span> {d.message}</li>
            ))}
          </ul>
        )}
        {dirty && diagnostics.length === 0 && (
          <p className="hint">The program has changed since the last run. Run it again to update the visualization.</p>
        )}
      </Panel>

      <div className="program-side">
        {example && (
          <Panel title={example.title} className="example-card">
            <p>{example.summary}</p>
            <ul className="concept-tags" aria-label="Concepts">
              {example.concepts.map((c) => <li key={c}>{c}</li>)}
            </ul>
          </Panel>
        )}
        <Panel
          title="Assembled listing"
          subtitle={program ? `${program.size} bytes · ${Object.keys(program.symbols).length} labels` : undefined}
          actions={program && !dirty ? (
            <button type="button" className="btn" onClick={onOpenPipeline}>Step through it →</button>
          ) : null}
          className="listing-panel"
        >
          <Listing listing={program?.listing} errorsByLine={errorsByLine} />
        </Panel>
      </div>
    </div>
  );
}
