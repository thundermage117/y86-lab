import { useEffect, useRef, useState } from 'react';
import { rowsInWindow } from '../../utils/timeline.js';
import { cycleKinds, EVENT_KINDS, primaryKind } from '../../utils/hazards.js';
import { STAGE_LABELS } from '../../utils/format.js';

/**
 * Sparse staircase grid shared by the Timeline tab and the Step view's
 * mini-timeline. Only occupied cells are rendered, placed by grid column.
 * It keeps the current cycle's instructions in view as the cycle changes.
 */
export default function TimelineGrid({
  cycles, rows, start, end, cycleIndex, onSeek, compact = false,
  focusUid = null, onFocusUid,
}) {
  const scroller = useRef(null);
  const [hoverCol, setHoverCol] = useState(null);
  const span = end - start + 1;
  const visible = rowsInWindow(rows, start, end);
  const columns = Array.from({ length: span }, (_, i) => start + i);

  useEffect(() => {
    const box = scroller.current;
    if (!box) return;
    // Center the instructions in flight at the current cycle, both axes.
    const cells = [...box.querySelectorAll('.tl-cell.is-current')];
    const head = box.querySelector('.tl-head .is-current');
    if (!head) return;
    const b = box.getBoundingClientRect();
    const h = head.getBoundingClientRect();
    const tops = cells.map((c) => c.getBoundingClientRect().top);
    const mid = tops.length ? (Math.min(...tops) + Math.max(...tops)) / 2 : b.top;
    const left = h.left - b.left - box.clientWidth / 2;
    const top = tops.length ? mid - b.top - box.clientHeight / 2 : 0;
    const far = Math.abs(left) > box.clientWidth * 2 || Math.abs(top) > box.clientHeight * 2;
    box.scrollBy?.({ left, top, behavior: far ? 'auto' : 'smooth' });
  }, [cycleIndex, start, end]);

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
            const mark = primaryKind(kinds);
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
                  {mark && <span className={`tl-mark tone-${EVENT_KINDS[mark].tone}`} aria-hidden="true" />}
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
      <li><span className="tl-mark-sample" aria-hidden="true" />event cycle (colors as in the event filter)</li>
    </ul>
  );
}
