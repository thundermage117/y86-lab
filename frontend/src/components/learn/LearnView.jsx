import { useState } from 'react';
import Panel from '../common/Panel.jsx';
import { INSTRUCTIONS } from '../../utils/instructionDocs.js';
import { GLOSSARY } from '../../utils/glossary.js';

const SHORTCUTS = [
  ['← / →', 'Previous / next cycle'],
  ['Space', 'Play / pause'],
  ['Home / End', 'First / last cycle'],
  ['[ / ]', 'Previous / next hazard event'],
  ['Ctrl/⌘ + Enter', 'Assemble and run'],
];

export default function LearnView() {
  const [selected, setSelected] = useState(INSTRUCTIONS[0].name);
  const ins = INSTRUCTIONS.find((i) => i.name === selected);

  return (
    <div className="learn-layout">
      <Panel title="How to use this" className="howto">
        <ol className="howto-steps">
          <li><strong>Program:</strong> pick an example or write your own Y86-64 assembly, then press <em>Assemble &amp; Run</em>. It runs on two real Verilog CPUs (5-stage PIPE and single-cycle SEQ) in Icarus Verilog.</li>
          <li><strong>Pipeline:</strong> step cycle by cycle. The five cards show which instruction each stage holds and what it computes. The panel below explains every stall, bubble and forward in plain language; <em>Prev/Next</em> jumps between events.</li>
          <li><strong>Timeline:</strong> the classic staircase diagram. Click any cell to jump there.</li>
          <li><strong>Memory:</strong> the program bytes with stage markers, and data memory as the program changes it.</li>
          <li><strong>Performance:</strong> where the cycles went, and why a pipeline wins despite needing more of them.</li>
          <li>Switch between <em>Pipelined</em> and <em>Sequential</em> in the header to compare the two CPUs on the same program.</li>
        </ol>
        <table className="data-table shortcuts">
          <caption>Keyboard shortcuts</caption>
          <tbody>
            {SHORTCUTS.map(([k, v]) => <tr key={k}><th scope="row"><kbd>{k}</kbd></th><td>{v}</td></tr>)}
          </tbody>
        </table>
      </Panel>

      <Panel title="What each instruction does in each stage" subtitle="SEQ computations; PIPE does the same work spread over five cycles.">
        <label className="example-select">
          <span>Instruction</span>
          <select value={selected} onChange={(e) => setSelected(e.target.value)}>
            {INSTRUCTIONS.map((i) => <option key={i.name} value={i.name}>{i.name}</option>)}
          </select>
        </label>
        <p className="muted">Encoding: <code>{ins.encoding}</code></p>
        <ol className="seq-steps">
          {[['fetch', 'Fetch'], ['decode', 'Decode'], ['execute', 'Execute'], ['memory', 'Memory'], ['writeback', 'Write-back'], ['pc', 'PC update']].map(([k, label]) => (
            <li key={k} className={`seq-step stage-${k}`}>
              <span className="seq-step-label">{label}</span>
              <code>{ins[k]}</code>
            </li>
          ))}
        </ol>
      </Panel>

      <Panel title="Glossary" className="glossary">
        <dl>
          {GLOSSARY.map(([term, def]) => (
            <div key={term}>
              <dt>{term}</dt>
              <dd>{def}</dd>
            </div>
          ))}
        </dl>
      </Panel>
    </div>
  );
}
