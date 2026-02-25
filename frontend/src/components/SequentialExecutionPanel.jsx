import { formatNumericString } from '../utils/numberFormat';

function formatValue(value, numberFormat, options = {}) {
  return formatNumericString(value ?? 'x', numberFormat, options);
}

function getMemoryActivityLabel(access) {
  const isRead = Boolean(access?.read);
  const isWrite = Boolean(access?.write);
  if (isRead && isWrite) return 'Read + Write';
  if (isRead) return 'Read';
  if (isWrite) return 'Write';
  return 'Idle';
}

export default function SequentialExecutionPanel({
  currentCycle,
  cycles = [],
  cycleIdx = 0,
  numberFormat = 'dec',
}) {
  if (!currentCycle) {
    return <div className="empty-note">Load a simulation to view the sequential datapath trace.</div>;
  }

  const seq = currentCycle.meta?.sequential ?? null;
  const windowStart = Math.max(0, cycleIdx - 5);
  const windowEnd = Math.min(cycles.length - 1, cycleIdx + 5);
  const visibleCycles = [];
  for (let i = windowStart; i <= windowEnd; i += 1) visibleCycles.push(i);

  return (
    <div className="cycle-details">
      <div className="empty-note">
        Sequential mode replaces the pipeline diagram/timeline with a single-cycle datapath view. Use the same cycle controls to step through the sequential trace.
      </div>

      <div className="control-panels">
        <div className="control-card">
          <div className="control-card-title">Current Instruction</div>
          <div className="meta-list">
            <div className="meta-row">
              <span>PC</span>
              <code>{formatValue(seq?.pc_hex, numberFormat)}</code>
            </div>
            <div className="meta-row">
              <span>Next PC</span>
              <code>{formatValue(seq?.next_pc_hex, numberFormat)}</code>
            </div>
            <div className="meta-row">
              <span>Opcode</span>
              <code>{currentCycle.execute?.icode_name ?? 'x'}</code>
            </div>
            <div className="meta-row">
              <span>ifun</span>
              <code>{formatValue(currentCycle.execute?.ifun_hex, numberFormat)}</code>
            </div>
            <div className="meta-row">
              <span>Status</span>
              <code>{currentCycle.meta?.memory_stat?.name ?? 'x'}</code>
            </div>
            <div className="meta-row">
              <span>Branch condition</span>
              <code>{seq?.cnd === null || seq?.cnd === undefined ? 'x' : (seq.cnd ? 'taken' : 'not taken')}</code>
            </div>
          </div>
        </div>

        <div className="control-card">
          <div className="control-card-title">Datapath / Memory</div>
          <div className="meta-list">
            <div className="meta-row">
              <span>valA</span>
              <code>{formatValue(seq?.valA_hex, numberFormat, { signed: true, bitWidth: 64 })}</code>
            </div>
            <div className="meta-row">
              <span>valB</span>
              <code>{formatValue(seq?.valB_hex, numberFormat, { signed: true, bitWidth: 64 })}</code>
            </div>
            <div className="meta-row">
              <span>valC</span>
              <code>{formatValue(seq?.valC_hex, numberFormat, { signed: true, bitWidth: 64 })}</code>
            </div>
            <div className="meta-row">
              <span>valE</span>
              <code>{formatValue(seq?.valE_hex, numberFormat, { signed: true, bitWidth: 64 })}</code>
            </div>
            <div className="meta-row">
              <span>valM</span>
              <code>{formatValue(seq?.valM_hex, numberFormat, { signed: true, bitWidth: 64 })}</code>
            </div>
            <div className="meta-row">
              <span>Memory activity</span>
              <code>{getMemoryActivityLabel(currentCycle.dataMemory)}</code>
            </div>
          </div>
        </div>
      </div>

      <div className="insight-block">
        <div className="insight-heading">Sequential Trace Window</div>
        <table className="stage-detail-table">
          <thead>
            <tr>
              <th>Cycle</th>
              <th>PC</th>
              <th>Instruction</th>
              <th>Next PC</th>
              <th>Mem</th>
              <th>stat</th>
            </tr>
          </thead>
          <tbody>
            {visibleCycles.map((index) => {
              const cycle = cycles[index];
              const s = cycle?.meta?.sequential ?? null;
              const mem = getMemoryActivityLabel(cycle?.dataMemory);
              return (
                <tr key={index} className={index === cycleIdx ? 'stage-row-changed' : ''}>
                  <td className="mono-cell">{index + 1}</td>
                  <td className="mono-cell">{formatValue(s?.pc_hex, numberFormat)}</td>
                  <td>
                    <span className="stage-detail-icode">{cycle?.execute?.icode_name ?? 'x'}</span>
                    <span className="stage-detail-hex"> {formatValue(cycle?.execute?.ifun_hex, numberFormat)}</span>
                  </td>
                  <td className="mono-cell">{formatValue(s?.next_pc_hex, numberFormat)}</td>
                  <td className="mono-cell">{mem}</td>
                  <td className="mono-cell">{cycle?.meta?.memory_stat?.name ?? 'x'}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
