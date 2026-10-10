import { useState } from 'react';
import Panel from '../common/Panel.jsx';
import { INSTRUCTIONS } from '../../utils/instructionDocs.js';
import { GLOSSARY } from '../../utils/glossary.js';

const SHORTCUTS = [
  ['← / →', 'Previous / next cycle'],
  ['Space', 'Play / pause'],
  ['Home / End', 'First / last cycle'],
  ['[ / ]', 'Previous / next event'],
  ['Ctrl/⌘ + Enter', 'Assemble and run'],
];

export default function LearnView() {
  const [selected, setSelected] = useState(INSTRUCTIONS[0].name);
  const ins = INSTRUCTIONS.find((i) => i.name === selected);

  return (
    <div className="learn-layout">
      <Panel title="Getting started" className="howto">
        <ol className="howto-steps">
          <li><strong>Program:</strong> pick an example or write Y86-64 assembly, then <em>Assemble &amp; Run</em>. Start typing for completions; hover an instruction or label for its meaning or address.</li>
          <li><strong>Step:</strong> one cycle on one screen. Each card shows what a stage holds; the arrows between cards show whether an instruction advances, is held or is replaced by a bubble, and arcs show values forwarded into Decode. Hover an instruction anywhere to highlight it everywhere; dotted words have definitions.</li>
          <li><strong>Moving through cycles:</strong> the bar under the tabs (on Step and Timeline) plays, steps and scrubs. Colored ticks mark events; the event chips choose which kinds are marked and which <kbd>[</kbd> <kbd>]</kbd> jump to.</li>
          <li><strong>Timeline:</strong> the staircase diagram for the whole run. Click any cell to jump there.</li>
          <li><strong>Performance:</strong> where the cycles went, and why the pipeline wins despite needing more of them.</li>
          <li>The <em>Pipelined</em> / <em>Sequential</em> switch in the header compares the two CPUs on the same program.</li>
        </ol>
      </Panel>

      <div className="learn-side">
        <Panel title="Keyboard shortcuts">
          <table className="data-table shortcuts">
            <tbody>
              {SHORTCUTS.map(([k, v]) => <tr key={k}><th scope="row"><kbd>{k}</kbd></th><td>{v}</td></tr>)}
            </tbody>
          </table>
        </Panel>
        <Panel title="About">
          <p className="about">
            Y86-64 is the teaching ISA from <em>Computer Systems: A Programmer&apos;s Perspective</em> (Bryant &amp;
            O&apos;Hallaron). Both CPUs here are Verilog designs simulated with Icarus Verilog; every value on the
            Step and Timeline tabs is a recorded hardware signal.
          </p>
        </Panel>
      </div>

      <Panel
        title="What each instruction does in each stage"
        subtitle="SEQ computations; PIPE does the same work spread over five cycles."
        className="instr-stages"
        actions={(
          <label className="labelled-control">
            <span>Instruction</span>
            <select value={selected} onChange={(e) => setSelected(e.target.value)}>
              {INSTRUCTIONS.map((i) => <option key={i.name} value={i.name}>{i.name}</option>)}
            </select>
          </label>
        )}
      >
        <p className="panel-note">Encoding: <code>{ins.encoding}</code></p>
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
