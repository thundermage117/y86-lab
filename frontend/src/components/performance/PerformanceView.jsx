import { useMemo, useState } from 'react';
import Panel from '../common/Panel.jsx';
import { DEFAULT_STAGE_DELAYS, pipelineMetrics, sequentialMetrics, timingModel } from '../../utils/metrics.js';
import { STAGE_LABELS, plural } from '../../utils/format.js';

/** Horizontal bar list: one hue, value labels as text (doubles as the table view). */
function BarList({ items, unit, label }) {
  const max = Math.max(1, ...items.map((i) => i.value));
  return (
    <table className="bar-list" aria-label={label}>
      <tbody>
        {items.map((item) => (
          <tr key={item.key} title={item.hint}>
            <th scope="row">{item.label}</th>
            <td className="bar-cell">
              <span className="bar-track">
                <span className="bar-fill" style={{ width: `${(item.value / max) * 100}%` }} />
              </span>
            </td>
            <td className="bar-value">{unit ? plural(item.value, unit) : item.value}{item.extra ? <span className="muted"> {item.extra}</span> : null}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function Stat({ label, value, note }) {
  return (
    <div className="stat">
      <span className="stat-label">{label}</span>
      <span className="stat-value">{value}</span>
      {note && <span className="stat-note">{note}</span>}
    </div>
  );
}

const fmt2 = (v) => (Number.isFinite(v) ? v.toFixed(2) : '—');
const fmtTime = (ps) => (ps >= 1e6 ? `${(ps / 1e6).toFixed(2)} µs` : ps >= 1e3 ? `${(ps / 1e3).toFixed(1)} ns` : `${ps} ps`);

export default function PerformanceView({ result }) {
  const pipe = useMemo(() => pipelineMetrics(result.modes.pipelined), [result]);
  const seq = useMemo(() => sequentialMetrics(result.modes.sequential), [result]);
  const [delays, setDelays] = useState(DEFAULT_STAGE_DELAYS);
  const timing = timingModel(delays, pipe.total, seq.total);

  const share = (n) => (pipe.total ? `(${Math.round((n / pipe.total) * 100)}%)` : '');
  const cycleItems = [
    { key: 'retired', label: 'Useful (one instruction completes)', value: pipe.retired, extra: share(pipe.retired) },
    { key: 'fill', label: 'Pipeline fill / drain', value: pipe.fill, extra: share(pipe.fill), hint: 'Cycles before the first instruction reaches Write-back' },
    { key: 'loadUse', label: 'Load/use stalls', value: pipe.penalties.loadUse, extra: share(pipe.penalties.loadUse), hint: `${pipe.counts.loadUse} hazards × 1 cycle` },
    { key: 'mispredict', label: 'Branch mispredictions', value: pipe.penalties.mispredict, extra: share(pipe.penalties.mispredict), hint: `${pipe.counts.mispredict} mispredictions × 2 cycles` },
    { key: 'ret', label: 'Return stalls', value: pipe.penalties.ret, extra: share(pipe.penalties.ret), hint: '3 cycles per ret' },
  ];
  const fwdItems = Object.entries(pipe.forwards).map(([src, n]) => ({ key: src, label: src, value: n }));

  return (
    <div className="performance-layout">
      <Panel title="Pipelined vs sequential" subtitle="Same program, same results, run on both Verilog CPUs." className="perf-compare">
        <div className="stat-row">
          <Stat label="Pipelined cycles" value={pipe.total} note={`CPI ${fmt2(pipe.cpi)}`} />
          <Stat label="Sequential cycles" value={seq.total} note={`CPI ${fmt2(seq.cpi)}`} />
          <Stat label="Instructions" value={pipe.retired} note="including halt" />
          <Stat label="Estimated speedup" value={timing.speedup ? `${timing.speedup.toFixed(2)}×` : '—'} note="with the stage delays below" />
        </div>
        <p className="hint">
          The pipeline needs <strong>more</strong> cycles than SEQ ({pipe.total} vs {seq.total}) because of fill time and
          hazards, but each cycle is much shorter, since a cycle only has to fit the slowest stage rather than all five.
        </p>
      </Panel>

      <Panel
        title="Where the pipelined cycles go"
        subtitle={pipe.cpiParts
          ? `CPI = 1 + ${fmt2(pipe.cpiParts.loadUse)} (load/use) + ${fmt2(pipe.cpiParts.mispredict)} (mispredict) + ${fmt2(pipe.cpiParts.ret)} (ret) + ${fmt2(pipe.cpiParts.fill)} (fill) = ${fmt2(pipe.cpi)}`
          : undefined}
      >
        <BarList items={cycleItems} unit="cycle" label="Pipelined cycle breakdown" />
      </Panel>

      <Panel title="Forwarding" subtitle={`${pipe.forwardTotal} operands were bypassed instead of waiting for Write-back.`}>
        <BarList items={fwdItems} label="Forwarded operands by source" />
      </Panel>

      <Panel title="Timing model" subtitle="Clock period from stage delays (picoseconds). Edit them to see how the slowest stage limits the pipeline." className="timing-panel">
        <div className="delay-grid">
          {['fetch', 'decode', 'execute', 'memory', 'writeback'].map((k) => (
            <label key={k} className={`delay-input${timing.bottleneck === k ? ' is-bottleneck' : ''}`}>
              <span>{STAGE_LABELS[k]}</span>
              <input
                type="number"
                min="0"
                step="10"
                value={delays[k]}
                onChange={(e) => setDelays({ ...delays, [k]: e.target.value })}
              />
            </label>
          ))}
          <label className="delay-input">
            <span>Pipeline register</span>
            <input
              type="number"
              min="0"
              step="5"
              value={delays.register}
              onChange={(e) => setDelays({ ...delays, register: e.target.value })}
            />
          </label>
        </div>
        <div className="stat-row">
          <Stat label="SEQ clock period" value={fmtTime(timing.seqPeriod)} note="sum of all stages" />
          <Stat label="PIPE clock period" value={fmtTime(timing.pipePeriod)} note={`slowest stage (${STAGE_LABELS[timing.bottleneck]}) + register`} />
          <Stat label="SEQ run time" value={fmtTime(timing.seqTime)} note={`${seq.total} cycles`} />
          <Stat label="PIPE run time" value={fmtTime(timing.pipeTime)} note={`${pipe.total} cycles`} />
        </div>
      </Panel>
    </div>
  );
}
