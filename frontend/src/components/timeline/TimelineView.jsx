import { useEffect, useMemo, useRef, useState } from 'react';
import Panel from '../common/Panel.jsx';
import Segmented from '../common/Segmented.jsx';
import { buildTimeline, rowsInWindow } from '../../utils/timeline.js';
import { cycleKinds, EVENT_KINDS } from '../../utils/hazards.js';
import { STAGE_LABELS } from '../../utils/format.js';

const WINDOWS = [
  { value: 16, label: '16' },
  { value: 32, label: '32' },
  { value: 64, label: '64' },
  { value: 0, label: 'All' },
];

const EVENT_GLYPH = { loadUse: 'L', mispredict: 'B', ret: 'R', exception: '!' };

export default function TimelineView({ result, cycleIndex, onSeek, mode }) {
  const [width, setWidth] = useState(32);
  const scroller = useRef(null);
  const cycles = result.modes.pipelined.cycles;
  const rows = useMemo(() => buildTimeline(cycles), [cycles]);

  const total = cycles.length;
  const span = width === 0 ? total : Math.min(width, total);
  const start = width === 0 ? 0 : Math.max(0, Math.min(cycleIndex - Math.floor(span / 2), total - span));
  const end = start + span - 1;
  const visible = useMemo(() => rowsInWindow(rows, start, end), [rows, start, end]);

  useEffect(() => {
    if (width !== 0 || !scroller.current) return;
    const cell = scroller.current.querySelector('.tl-head .is-current');
    cell?.scrollIntoView({ block: 'nearest', inline: 'center', behavior: 'smooth' });
  }, [width, cycleIndex]);

  const columns = Array.from({ length: span }, (_, i) => start + i);

  return (
    <Panel
      title="Pipeline timeline"
      subtitle="Each row is one fetched instruction; each column a clock cycle. Repeated letters are stalls, struck-through rows were squashed. Click any cell to jump there."
      className="timeline-panel"
      actions={<Segmented label="Cycles shown" size="sm" value={width} onChange={setWidth} options={WINDOWS} />}
    >
      {mode === 'sequential' && (
        <p className="hint">
          This chart shows the pipelined CPU. The sequential CPU would be a single diagonal: one instruction
          per (much longer) cycle, {result.modes.sequential.total} cycles in total.
        </p>
      )}
      <div className="tl-scroller" ref={scroller} style={{ '--tl-cols': span }}>
        <div className="tl-grid" role="table" aria-label={`Pipeline timeline, cycles ${start + 1} to ${end + 1}`}>
          <div className="tl-row tl-head" role="row">
            <span className="tl-label" role="columnheader">Instruction</span>
            {columns.map((c) => {
              const kinds = cycleKinds(cycles[c]);
              const glyph = [...kinds].map((k) => EVENT_GLYPH[k]).filter(Boolean).join('');
              return (
                <span key={c} role="columnheader" className="tl-slot">
                  <button
                    type="button"
                    className={`tl-cycle${c === cycleIndex ? ' is-current' : ''}`}
                    onClick={() => onSeek(c)}
                    title={`Cycle ${c + 1}${kinds.size ? ': ' + [...kinds].map((k) => EVENT_KINDS[k].label).join(', ') : ''}`}
                  >
                    {c + 1}
                    {glyph && <span className="tl-glyph">{glyph}</span>}
                  </button>
                </span>
              );
            })}
          </div>
          {visible.map((row) => (
            <div key={row.uid} className={`tl-row${row.squashed ? ' is-squashed' : ''}`} role="row">
              <span className="tl-label" role="rowheader" title={row.squashed ? 'Squashed: never completed' : undefined}>
                <code>{row.text}</code>
              </span>
              {columns.map((c) => {
                const cell = row.cells[c];
                if (!cell) return <span key={c} className={`tl-empty${c === cycleIndex ? ' is-current' : ''}`} role="cell" />;
                return (
                  <span key={c} role="cell" className="tl-slot">
                    <button
                      type="button"
                      className={`tl-cell stage-${cell.stage}${cell.repeat ? ' is-repeat' : ''}${c === cycleIndex ? ' is-current' : ''}`}
                      onClick={() => onSeek(c)}
                      aria-label={`${row.text}: ${STAGE_LABELS[cell.stage]}${cell.repeat ? ' (stalled)' : ''} in cycle ${c + 1}`}
                    >
                      {cell.letter}
                    </button>
                  </span>
                );
              })}
            </div>
          ))}
        </div>
      </div>
      <ul className="tl-legend" aria-label="Legend">
        {Object.entries(STAGE_LABELS).map(([k, label]) => (
          <li key={k}><span className={`tl-cell stage-${k}`} aria-hidden="true">{label[0]}</span>{label}</li>
        ))}
        <li><span className="tl-cell stage-decode is-repeat" aria-hidden="true">D</span>stalled (held)</li>
        <li><span className="tl-glyph">L</span> load/use · <span className="tl-glyph">B</span> mispredict · <span className="tl-glyph">R</span> ret · <span className="tl-glyph">!</span> exception</li>
      </ul>
    </Panel>
  );
}
