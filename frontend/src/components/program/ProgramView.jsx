import Panel from '../common/Panel.jsx';
import Chip from '../common/Chip.jsx';
import Y86Editor from './Y86Editor.jsx';
import Listing from './Listing.jsx';
import { plural } from '../../utils/format.js';

export default function ProgramView({ sim, onRun, onOpenPipeline }) {
  const { examples, exampleId, example, selectExample, source, setSource, diagnostics, status, result, dirty } = sim;
  const running = status === 'running';
  const program = diagnostics.length ? null : result?.program;

  return (
    <div className="program-layout">
      <Panel
        title="Program"
        subtitle={example ? `${example.title}: ${example.summary}` : 'Write Y86-64 assembly or start from an example.'}
        className="editor-panel"
      >
        <div className="program-toolbar">
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
          <button type="button" className="btn btn-primary" onClick={onRun} disabled={running} title="Assemble and run on both CPUs (Ctrl/⌘ + Enter)">
            {running ? 'Running…' : 'Assemble & Run'}
          </button>
          {program && !dirty && (
            <button type="button" className="btn" onClick={onOpenPipeline}>Step through it →</button>
          )}
          {example && (
            <ul className="concept-tags" aria-label="Concepts">
              {example.concepts.map((c) => <Chip as="li" key={c} variant="quiet">{c}</Chip>)}
            </ul>
          )}
        </div>
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
          <p className="hint">Changed since the last run: press Assemble &amp; Run (Ctrl/⌘ + Enter) to update the other tabs.</p>
        )}
      </Panel>

      <Panel
        title="Assembled"
        subtitle={program ? `${plural(program.size, 'byte')} · ${plural(Object.keys(program.symbols).length, 'label')}` : undefined}
        className="listing-panel"
      >
        {diagnostics.length > 0
          ? <p className="empty">Fix the {plural(diagnostics.length, 'error')} in the editor to see the assembled bytes.</p>
          : <Listing listing={program?.listing} />}
      </Panel>
    </div>
  );
}
