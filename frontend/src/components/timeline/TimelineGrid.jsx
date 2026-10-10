import { useEffect, useRef, useState } from 'react';
import { rowsInWindow } from '../../utils/timeline.js';
import { cycleKinds, EVENT_KINDS } from '../../utils/hazards.js';
import { STAGE_LABELS } from '../../utils/format.js';

const EVENT_GLYPH = { loadUse: 'L', mispredict: 'B', ret: 'R', exception: '!' };

/**
 * Sparse staircase grid shared by the Timeline tab and the Step view's
 * mini-timeline. Only occupied cells are rendered, placed by grid column.
 */
export default function TimelineGrid({
  cycles, rows, start, end, cycleIndex, onSeek, compact = false, autoScroll = false,
  focusUid = null, onFocusUid,
}) {
  const scroller = useRef(null);
  const [hoverCol, setHoverCol] = useState(null);
  const span = end - start + 1;
  const visible = rowsInWindow(rows, start, end);
  const columns = Array.from({ length: span }, (_, i) => start + i);

  useEffect(() => {
    if (!autoScroll || !scroller.current) return;
    // Center the instructions in flight at the current cycle, both axes.
    const box = scroller.current;
    const cell = box.querySelector('.tl-cell.is-current') ?? box.querySelector('.tl-head .is-current');
    if (!cell) return;
    const b = box.getBoundingClientRect();
    const r = cell.getBoundingClientRect();
    const left = r.left - b.left - box.clientWidth / 2;
    const top = r.top - b.top - box.clientHeight / 2;
    const far = Math.abs(left) > box.clientWidth * 2 || Math.abs(top) > box.clientHeight * 2;
    box.scrollBy?.({ left, top, behavior: far ? 'auto' : 'smooth' });
  }, [autoScroll, cycleIndex]);

  const colClass = (c) => `${c === cycleIndex ? ' is-current' : ''}${c === hoverCol ? ' is-hover-col' : ''}`;

  return (
    <div
      className={`tl-scroller${compact ? ' is-compact' : ''}`}
      ref={scroller}
      style={{ '--tl-cols': span }}
      onMouseLeave={() => setHoverCol(null)}
    >
      <div className="tl-grid" aria-label={`Pipeline timeline, cycles ${start + 1} to ${end + 1}`}>
        <div className="tl-row tl-head">
          <span className="tl-label">{compact ? 'In flight' : 'Instruction'}</span>
          {columns.map((c) => {
            const kinds = cycleKinds(cycles[c]);
            const glyph = [...kinds].map((k) => EVENT_GLYPH[k]).filter(Boolean).join('');
            return (
              <span key={c} className="tl-slot">
                <button
                  type="button"
                  className={`tl-cycle${colClass(c)}`}
                  onClick={() => onSeek(c)}
                  onMouseEnter={() => setHoverCol(c)}
                  aria-label={`Cycle ${c + 1}`}
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
          <div
            key={row.uid}
            className={`tl-row${row.squashed ? ' is-squashed' : ''}${row.uid === focusUid ? ' is-focused' : ''}`}
            onMouseEnter={() => onFocusUid?.(row.uid)}
            onMouseLeave={() => onFocusUid?.(null)}
          >
            <span className="tl-label" title={row.squashed ? 'Squashed: never completed' : row.text}>
              <code>{row.text}</code>
            </span>
            {hoverCol !== null && hoverCol !== cycleIndex && hoverCol >= start && hoverCol <= end && !row.cells[hoverCol] && (
              <span className="tl-empty is-hover-col" style={{ gridColumn: hoverCol - start + 2 }} aria-hidden="true" />
            )}
            {cycleIndex >= start && cycleIndex <= end && !row.cells[cycleIndex] && (
              <span className="tl-empty is-current" style={{ gridColumn: cycleIndex - start + 2 }} aria-hidden="true" />
            )}
            {Object.entries(row.cells).map(([key, cell]) => {
              const c = Number(key);
              if (c < start || c > end) return null;
              return (
                <button
                  key={c}
                  type="button"
                  style={{ gridColumn: c - start + 2 }}
                  className={`tl-cell stage-${cell.stage}${cell.repeat ? ' is-repeat' : ''}${colClass(c)}`}
                  onClick={() => onSeek(c)}
                  onMouseEnter={() => setHoverCol(c)}
                  onFocus={() => onFocusUid?.(row.uid)}
                  onBlur={() => onFocusUid?.(null)}
                  aria-label={`${row.text}: ${STAGE_LABELS[cell.stage]}${cell.repeat ? ' (stalled)' : ''} in cycle ${c + 1}`}
                >
                  {cell.letter}
                </button>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

export function TimelineLegend() {
  return (
    <ul className="tl-legend" aria-label="Legend">
      {Object.entries(STAGE_LABELS).map(([k, label]) => (
        <li key={k}><span className={`tl-cell stage-${k}`} aria-hidden="true">{label[0]}</span>{label}</li>
      ))}
      <li><span className="tl-cell stage-decode is-repeat" aria-hidden="true">D</span>stalled (held)</li>
      <li><span className="tl-glyph">L</span> load/use · <span className="tl-glyph">B</span> mispredict · <span className="tl-glyph">R</span> ret · <span className="tl-glyph">!</span> exception</li>
    </ul>
  );
}
