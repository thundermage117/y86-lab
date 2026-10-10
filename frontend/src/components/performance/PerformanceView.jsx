import { useMemo, useState } from 'react';
import Panel from '../common/Panel.jsx';
import { DEFAULT_STAGE_DELAYS, pipelineMetrics, sequentialMetrics, timingModel } from '../../utils/metrics.js';
import { STAGE_LABELS, plural } from '../../utils/format.js';

const fmt2 = (v) => (Number.isFinite(v) ? v.toFixed(2) : '—');
const fmtTime = (ps) => (ps >= 1e6 ? `${(ps / 1e6).toFixed(2)} µs` : ps >= 1e3 ? `${(ps / 1e3).toFixed(1)} ns` : `${ps} ps`);

/**
 * Horizontal bar list: one hue, value labels as text (doubles as the table view).
 * Items may carry `cpi`, shown in an extra column; `total` adds a footer row.
 */
function BarList({ items, unit, label, total }) {
  const max = Math.max(1, ...items.map((i) => i.value));
  const withCpi = items.some((i) => i.cpi !== undefined);
  return (
    <table className="bar-list" aria-label={label}>
      {withCpi && (
        <thead>
          <tr>
            <th scope="col"><span className="sr-only">Cause</span></th>
            <th scope="col"><span className="sr-only">Share</span></th>
            <th scope="col" className="bar-value">Cycles</th>
            <th scope="col" className="bar-cpi">CPI</th>
          </tr>
        </thead>
      )}
      <tbody>
        {items.map((item) => (
          <tr key={item.key} title={item.hint}>
            <th scope="row">{item.label}</th>
            <td className="bar-cell">
              <span className="bar-track">
                {item.value > 0 && <span className="bar-fill" style={{ width: `${(item.value / max) * 100}%` }} />}
              </span>
            </td>
            <td className="bar-value">{unit ? plural(item.value, unit) : item.value}{item.extra ? <span className="muted"> {item.extra}</span> : null}</td>
            {withCpi && <td className="bar-cpi">{item.cpi}</td>}
          </tr>
        ))}
      </tbody>
      {total && (
        <tfoot>
          <tr>
            <th scope="row">{total.label}</th>
            <td />
            <td className="bar-value">{unit ? plural(total.value, unit) : total.value}</td>
            {withCpi && <td className="bar-cpi">{total.cpi}</td>}
          </tr>
        </tfoot>
      )}
    </table>
  );
}

export default function PerformanceView({ result }) {
  const pipe = useMemo(() => pipelineMetrics(result.modes.pipelined), [result]);
  const seq = useMemo(() => sequentialMetrics(result.modes.sequential), [result]);
  const [delays, setDelays] = useState(DEFAULT_STAGE_DELAYS);
  const timing = timingModel(delays, pipe.total, seq.total);

  const share = (n) => (pipe.total ? `(${Math.round((n / pipe.total) * 100)}%)` : '');
  const parts = pipe.cpiParts;
  const plus = (v) => (parts ? `+${fmt2(v)}` : '—');
  const cycleItems = [
    { key: 'retired', label: 'Useful (one instruction completes)', value: pipe.retired, extra: share(pipe.retired), cpi: parts ? '1' : '—' },
    { key: 'fill', label: 'Pipeline fill / drain', value: pipe.fill, extra: share(pipe.fill), cpi: plus(parts?.fill), hint: 'Cycles before the first instruction reaches Write-back' },
    { key: 'loadUse', label: 'Load/use stalls', value: pipe.penalties.loadUse, extra: share(pipe.penalties.loadUse), cpi: plus(parts?.loadUse), hint: `${pipe.counts.loadUse} hazards × 1 cycle` },
    { key: 'mispredict', label: 'Branch mispredictions', value: pipe.penalties.mispredict, extra: share(pipe.penalties.mispredict), cpi: plus(parts?.mispredict), hint: `${pipe.counts.mispredict} mispredictions × 2 cycles` },
    { key: 'ret', label: 'Return stalls', value: pipe.penalties.ret, extra: share(pipe.penalties.ret), cpi: plus(parts?.ret), hint: '3 cycles per ret' },
  ];
  const fwdItems = Object.entries(pipe.forwards).map(([src, n]) => ({ key: src, label: src, value: n }));
  const setDelay = (k) => (e) => setDelays({ ...delays, [k]: e.target.value });

  return (
    <div className="performance-layout">
      <Panel title="Pipelined vs sequential" subtitle="Same program, same results, run on both Verilog CPUs." className="perf-compare">
        <p className="perf-headline">
          <strong>{timing.speedup ? `${timing.speedup.toFixed(2)}×` : '—'}</strong>
          <span>
            estimated speedup. The pipeline needs <em>more</em> cycles ({pipe.total} vs {seq.total}) because of fill time
            and hazards, but each cycle only has to fit the slowest stage, not all five.
          </span>
        </p>
        <div className="perf-compare-body">
          <div className="table-wrap">
            <table className="data-table compare-table">
              <thead>
                <tr>
                  <th scope="col"><span className="sr-only">Measure</span></th>
                  <th scope="col">Pipelined</th>
                  <th scope="col">Sequential</th>
                </tr>
              </thead>
              <tbody>
                <tr><th scope="row">Cycles</th><td>{pipe.total}</td><td>{seq.total}</td></tr>
                <tr><th scope="row">Instructions <span className="muted">incl. halt</span></th><td>{pipe.retired}</td><td>{seq.retired}</td></tr>
                <tr><th scope="row">CPI</th><td>{fmt2(pipe.cpi)}</td><td>{fmt2(seq.cpi)}</td></tr>
                <tr>
                  <th scope="row">Clock period</th>
                  <td>{fmtTime(timing.pipePeriod)} <span className="muted">slowest stage ({STAGE_LABELS[timing.bottleneck]}) + register</span></td>
                  <td>{fmtTime(timing.seqPeriod)} <span className="muted">sum of all stages</span></td>
                </tr>
                <tr><th scope="row">Run time</th><td>{fmtTime(timing.pipeTime)}</td><td>{fmtTime(timing.seqTime)}</td></tr>
              </tbody>
            </table>
          </div>
          <fieldset className="delay-grid">
            <legend>Stage delays <span className="muted">(ps, editable)</span></legend>
            {['fetch', 'decode', 'execute', 'memory', 'writeback'].map((k) => (
              <label key={k} className={`delay-input${timing.bottleneck === k ? ' is-bottleneck' : ''}`}>
                <span>{STAGE_LABELS[k]}{timing.bottleneck === k ? ' (slowest)' : ''}</span>
                <input type="number" min="0" step="10" value={delays[k]} onChange={setDelay(k)} />
              </label>
            ))}
            <label className="delay-input">
              <span>Pipeline register</span>
              <input type="number" min="0" step="5" value={delays.register} onChange={setDelay('register')} />
            </label>
          </fieldset>
        </div>
      </Panel>

      <Panel title="Where the pipelined cycles go" subtitle="Each cause's cycles, and what it adds to the CPI.">
        <BarList
          items={cycleItems}
          unit="cycle"
          label="Pipelined cycle breakdown"
          total={{ label: 'Total', value: pipe.total, cpi: fmt2(pipe.cpi) }}
        />
      </Panel>

      <Panel title="Forwarding" subtitle={`${pipe.forwardTotal} operands were bypassed instead of waiting for Write-back.`}>
        <BarList items={fwdItems} label="Forwarded operands by source" />
      </Panel>

    </div>
  );
}
