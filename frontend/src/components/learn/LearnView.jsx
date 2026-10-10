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
          <li><strong>Step:</strong> everything about one cycle on one screen. The five cards show what each stage holds and computes; arrows between them show whether each instruction advances, is held, or is replaced by a bubble, and curved arcs show values forwarded into Decode. Below: the cycles around this one, a plain-language explanation (dotted words have definitions), the source, and registers or data memory. Hover an instruction anywhere to highlight it everywhere.</li>
          <li><strong>Finding events:</strong> colored ticks under the cycle slider mark stalls, mispredictions, ret stalls and exceptions; <em>Prev/Next</em> or <kbd>[</kbd> <kbd>]</kbd> jumps between them.</li>
          <li><strong>Timeline:</strong> the classic staircase diagram for the whole run. Click any cell to jump there.</li>
          <li><strong>Editor help:</strong> start typing for completions (instructions, <code>%</code> registers, <code>.</code> directives, labels); hover an instruction or label for its meaning or address.</li>
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
