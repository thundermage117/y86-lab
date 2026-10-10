import { useState } from 'react';
import Panel from '../common/Panel.jsx';

// Stage-by-stage computations (after CS:APP Figs. 4.18–4.21).
const INSTRUCTIONS = [
  {
    name: 'OPq rA, rB', encoding: '6 fn rA rB',
    fetch: 'icode:ifun ← M1[PC]; rA:rB ← M1[PC+1]; valP ← PC+2',
    decode: 'valA ← R[rA]; valB ← R[rB]',
    execute: 'valE ← valB OP valA; set CC',
    memory: '—',
    writeback: 'R[rB] ← valE',
    pc: 'PC ← valP',
  },
  {
    name: 'rrmovq / cmovXX rA, rB', encoding: '2 fn rA rB',
    fetch: 'icode:ifun ← M1[PC]; rA:rB ← M1[PC+1]; valP ← PC+2',
    decode: 'valA ← R[rA]',
    execute: 'valE ← 0 + valA; Cnd ← Cond(CC, ifun)',
    memory: '—',
    writeback: 'if Cnd: R[rB] ← valE',
    pc: 'PC ← valP',
  },
  {
    name: 'irmovq V, rB', encoding: '3 0 F rB V',
    fetch: 'icode:ifun ← M1[PC]; rA:rB ← M1[PC+1]; valC ← M8[PC+2]; valP ← PC+10',
    decode: '—',
    execute: 'valE ← 0 + valC',
    memory: '—',
    writeback: 'R[rB] ← valE',
    pc: 'PC ← valP',
  },
  {
    name: 'rmmovq rA, D(rB)', encoding: '4 0 rA rB D',
    fetch: 'icode:ifun ← M1[PC]; rA:rB ← M1[PC+1]; valC ← M8[PC+2]; valP ← PC+10',
    decode: 'valA ← R[rA]; valB ← R[rB]',
    execute: 'valE ← valB + valC',
    memory: 'M8[valE] ← valA',
    writeback: '—',
    pc: 'PC ← valP',
  },
  {
    name: 'mrmovq D(rB), rA', encoding: '5 0 rA rB D',
    fetch: 'icode:ifun ← M1[PC]; rA:rB ← M1[PC+1]; valC ← M8[PC+2]; valP ← PC+10',
    decode: 'valB ← R[rB]',
    execute: 'valE ← valB + valC',
    memory: 'valM ← M8[valE]',
    writeback: 'R[rA] ← valM',
    pc: 'PC ← valP',
  },
  {
    name: 'jXX Dest', encoding: '7 fn Dest',
    fetch: 'icode:ifun ← M1[PC]; valC ← M8[PC+1]; valP ← PC+9',
    decode: '—',
    execute: 'Cnd ← Cond(CC, ifun)',
    memory: '—',
    writeback: '—',
    pc: 'PC ← Cnd ? valC : valP',
  },
  {
    name: 'call Dest', encoding: '8 0 Dest',
    fetch: 'icode:ifun ← M1[PC]; valC ← M8[PC+1]; valP ← PC+9',
    decode: 'valB ← R[%rsp]',
    execute: 'valE ← valB + (−8)',
    memory: 'M8[valE] ← valP',
    writeback: 'R[%rsp] ← valE',
    pc: 'PC ← valC',
  },
  {
    name: 'ret', encoding: '9 0',
    fetch: 'icode:ifun ← M1[PC]; valP ← PC+1',
    decode: 'valA ← R[%rsp]; valB ← R[%rsp]',
    execute: 'valE ← valB + 8',
    memory: 'valM ← M8[valA]',
    writeback: 'R[%rsp] ← valE',
    pc: 'PC ← valM',
  },
  {
    name: 'pushq rA', encoding: 'A 0 rA F',
    fetch: 'icode:ifun ← M1[PC]; rA:rB ← M1[PC+1]; valP ← PC+2',
    decode: 'valA ← R[rA]; valB ← R[%rsp]',
    execute: 'valE ← valB + (−8)',
    memory: 'M8[valE] ← valA',
    writeback: 'R[%rsp] ← valE',
    pc: 'PC ← valP',
  },
  {
    name: 'popq rA', encoding: 'B 0 rA F',
    fetch: 'icode:ifun ← M1[PC]; rA:rB ← M1[PC+1]; valP ← PC+2',
    decode: 'valA ← R[%rsp]; valB ← R[%rsp]',
    execute: 'valE ← valB + 8',
    memory: 'valM ← M8[valA]',
    writeback: 'R[%rsp] ← valE; R[rA] ← valM',
    pc: 'PC ← valP',
  },
  {
    name: 'halt / nop', encoding: '0 0 / 1 0',
    fetch: 'icode:ifun ← M1[PC]; valP ← PC+1',
    decode: '—', execute: '—', memory: '—', writeback: '—',
    pc: 'halt: stop with status HLT; nop: PC ← valP',
  },
];

const GLOSSARY = [
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
