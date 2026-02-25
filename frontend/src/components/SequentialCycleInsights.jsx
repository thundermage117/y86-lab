import { formatNumericString } from '../utils/numberFormat';

function fmt(value, numberFormat, options = {}) {
  return formatNumericString(value ?? 'x', numberFormat, options);
}

function booleanLabel(value, { trueLabel = '1', falseLabel = '0' } = {}) {
  if (value === null || value === undefined) return 'x';
  return value ? trueLabel : falseLabel;
}

export default function SequentialCycleInsights({
  currentCycle,
  previousCycle,
  cycleIdx = 0,
  numberFormat = 'dec',
}) {
  if (!currentCycle) {
    return <div className="empty-note">No cycle selected.</div>;
  }

  const seq = currentCycle.meta?.sequential ?? {};
  const prevSeq = previousCycle?.meta?.sequential ?? {};
  const valueRows = [
    ['PC', seq.pc_hex, prevSeq.pc_hex],
    ['Next PC', seq.next_pc_hex, prevSeq.next_pc_hex],
    ['valP', seq.valP_hex, prevSeq.valP_hex],
    ['valA', seq.valA_hex, prevSeq.valA_hex],
    ['valB', seq.valB_hex, prevSeq.valB_hex],
    ['valC', seq.valC_hex, prevSeq.valC_hex],
    ['valE', seq.valE_hex, prevSeq.valE_hex],
    ['valM', seq.valM_hex, prevSeq.valM_hex],
  ];
  const changedRows = valueRows.filter(([, value, prev]) => previousCycle && value !== prev);

  return (
    <>
      <div className="insight-block">
        <div className="insight-heading">Sequential Datapath Signals</div>
        <div className="control-panels">
          <div className="control-card">
            <div className="control-card-title">Instruction / Control</div>
            <div className="meta-list">
              <div className="meta-row">
                <span>Instruction</span>
                <code>{currentCycle.execute?.icode_name ?? 'x'}</code>
              </div>
              <div className="meta-row">
                <span>ifun</span>
                <code>{fmt(currentCycle.execute?.ifun_hex, numberFormat)}</code>
              </div>
              <div className="meta-row">
                <span>rA / rB</span>
                <code>{seq.rA_hex ?? 'x'} / {seq.rB_hex ?? 'x'}</code>
              </div>
              <div className="meta-row">
                <span>`instr_valid`</span>
                <code>{booleanLabel(seq.instr_valid)}</code>
              </div>
              <div className="meta-row">
                <span>`Cnd`</span>
                <code>{booleanLabel(seq.cnd, { trueLabel: 'taken', falseLabel: 'not taken' })}</code>
              </div>
              <div className="meta-row">
                <span>`imem_error` / `stat`</span>
                <code>{booleanLabel(seq.imem_error)} / {currentCycle.meta?.memory_stat?.name ?? 'x'}</code>
              </div>
            </div>
          </div>

          <div className="control-card">
            <div className="control-card-title">Register Visibility</div>
            <div className="empty-note">
              The Register File panel shows sequential register state for each cycle. Values come from dumped register-file signals when present, with a reconstruction fallback from `REG_MEM.txt` and sequential writeback behavior.
            </div>
          </div>
        </div>
      </div>

      <div className="insight-block">
        <div className="insight-heading">Datapath Value Changes</div>
        {changedRows.length > 0 ? (
          <div className="change-list">
            {changedRows.map(([label, value, prev]) => (
              <div key={label} className="change-row">
                <span className="change-reg">{label}</span>
                <span className="change-prev">{fmt(prev, numberFormat, { signed: true, bitWidth: 64 })}</span>
                <span className="change-arrow">→</span>
                <span className="change-next">{fmt(value, numberFormat, { signed: true, bitWidth: 64 })}</span>
              </div>
            ))}
          </div>
        ) : (
          <div className="empty-note">
            {cycleIdx === 0 ? 'Diffs begin at cycle 2 because cycle 1 has no prior state.' : 'No tracked sequential datapath values changed in this cycle.'}
          </div>
        )}
      </div>

      <details className="insight-advanced">
        <summary className="insight-advanced-summary">Advanced Details</summary>
        <div className="insight-advanced-body">
          <div className="insight-block">
            <div className="insight-heading">Sequential Datapath Snapshot</div>
            <table className="stage-detail-table">
              <thead>
                <tr>
                  <th>Signal</th>
                  <th>Value</th>
                  <th>Δ</th>
                </tr>
              </thead>
              <tbody>
                {valueRows.map(([label, value, prev]) => (
                  <tr key={label}>
                    <td className="stage-col-label">{label}</td>
                    <td className="mono-cell">{fmt(value, numberFormat, { signed: true, bitWidth: 64 })}</td>
                    <td className="mono-cell">{previousCycle ? (value !== prev ? `← ${fmt(prev, numberFormat, { signed: true, bitWidth: 64 })}` : '—') : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </details>
    </>
  );
}
