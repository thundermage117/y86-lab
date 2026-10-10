import { useMemo } from 'react';
import { ICODE, REG_NAMES, STAT } from '@y86/isa.js';
import Panel from '../common/Panel.jsx';
import Listing from '../program/Listing.jsx';
import HazardPanel from '../pipeline/HazardPanel.jsx';
import RegisterPanel from '../pipeline/RegisterPanel.jsx';
import RunSummary from '../pipeline/RunSummary.jsx';
import { explainSequentialCycle } from '../../utils/hazards.js';
import { formatWord, formatAddr, regLabel } from '../../utils/format.js';

/** SEQ datapath: every stage's values for the single instruction in flight. */
function Datapath({ c, numberFormat }) {
  const fmt = (v) => formatWord(v, numberFormat);
  const addr = (v) => formatAddr(v, numberFormat === 'hex' ? 'hex' : 'dec');
  const reads = [
    c.srcA !== 15 ? `valA = R[${regLabel(c.srcA)}] = ${fmt(c.valA)}` : null,
    c.srcB !== 15 ? `valB = R[${regLabel(c.srcB)}] = ${fmt(c.valB)}` : null,
  ].filter(Boolean);
  const mem = c.memory.write
    ? `M[${addr(c.memory.addr)}] ← ${fmt(c.memory.data)}`
    : c.memory.read ? `valM = M[${addr(c.memory.addr)}] = ${fmt(c.valM)}` : 'no access';
  const writes = c.stat === STAT.AOK ? [
    c.dstE !== 15 ? `R[${regLabel(c.dstE)}] ← valE = ${fmt(c.valE)}` : null,
    c.dstM !== 15 ? `R[${regLabel(c.dstM)}] ← valM = ${fmt(c.valM)}` : null,
  ].filter(Boolean) : [];
  const conditional = c.icode === ICODE.JXX || (c.icode === ICODE.RRMOVQ && c.ifun !== 0);

  const rows = [
    ['fetch', 'Fetch', `icode:ifun = ${c.icode?.toString(16)}:${c.ifun?.toString(16)}`
      + (c.rA !== 15 || c.rB !== 15 ? `, rA = ${regLabel(c.rA)}, rB = ${regLabel(c.rB)}` : '')
      + (c.valC !== '0x0000000000000000' ? `, valC = ${fmt(c.valC)}` : '')
      + `, valP = ${addr(c.valP)}`],
    ['decode', 'Decode', reads.length ? reads.join(', ') : 'no register reads'],
    ['execute', 'Execute', `valE = ${fmt(c.valE)}` + (conditional ? `, Cnd = ${c.Cnd ? 1 : 0}` : '') + (c.setCC ? ', set CC' : '')],
    ['memory', 'Memory', mem],
    ['writeback', 'Write-back', writes.length ? writes.join(', ') : 'no register writes'],
    ['pc', 'PC update', c.stat === STAT.AOK ? `PC ← ${addr(c.newPC)}` : `stopped (${c.statName})`],
  ];

  return (
    <Panel title="SEQ datapath" subtitle={`PC ${addr(c.pc)}: all six steps happen within this one clock cycle.`} className="seq-datapath">
      <div className="stage-instr"><code>{c.text}</code>{c.line ? <span className="muted">line {c.line}</span> : null}</div>
      <ol className="seq-steps">
        {rows.map(([key, label, text]) => (
          <li key={key} className={`seq-step stage-${key}`}>
            <span className="seq-step-label">{label}</span>
            <code>{text}</code>
          </li>
        ))}
      </ol>
    </Panel>
  );
}

export default function SequentialView({ result, cycleIndex, numberFormat }) {
  const mode = result.modes.sequential;
  const c = mode.cycles[cycleIndex];
  const previous = cycleIndex > 0 ? mode.cycles[cycleIndex - 1] : null;
  const events = useMemo(() => explainSequentialCycle(c, numberFormat), [c, numberFormat]);
  const markers = useMemo(() => new Map(c.line ? [[c.line, ['execute']]] : []), [c]);
  const pending = new Map();
  if (c.stat === STAT.AOK) {
    if (c.dstE !== 15) pending.set(REG_NAMES[c.dstE], c.valE);
    if (c.dstM !== 15) pending.set(REG_NAMES[c.dstM], c.valM);
  }

  return (
    <div className="pipeline-layout">
      <Datapath c={c} numberFormat={numberFormat} />
      {cycleIndex === mode.cycles.length - 1 && <RunSummary mode="sequential" modeData={mode} numberFormat={numberFormat} />}
      <div className="pipeline-detail">
        <HazardPanel events={events} title="This cycle" />
        <Panel title="Source" className="source-panel">
          <Listing listing={result.program.listing} markers={markers} showBytes={false} follow />
        </Panel>
        <RegisterPanel
          registers={c.registers}
          previous={previous?.registers}
          pending={pending}
          cc={c.cc}
          newCC={c.setCC && c.stat === STAT.AOK ? c.newCC : null}
          numberFormat={numberFormat}
        />
      </div>
    </div>
  );
}
