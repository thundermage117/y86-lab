import { Fragment, useLayoutEffect, useRef, useState } from 'react';
import { RNONE } from '@y86/isa.js';
import StageCard from '../pipeline/StageCard.jsx';
import { STAGE_KEYS, regLabel } from '../../utils/format.js';
import { FORWARD_ORIGIN } from '../../utils/hazards.js';
import { connectorState } from './stepModel.js';

const ARC_BAND = 46;

/** Forwarding arcs for this cycle: producer stage -> Decode, grouped by source. */
function forwardArcs(cycle) {
  const { decode, execute } = cycle.stages;
  if (decode.bubble) return [];
  if (cycle.control.loadUse && !execute.bubble) {
    return [{ from: 'execute', blocked: true, label: `${regLabel(execute.dstM)} not loaded yet: stall` }];
  }
  const bySource = new Map();
  for (const [operand, src, fwd] of [['valA', decode.srcA, decode.fwdA], ['valB', decode.srcB, decode.fwdB]]) {
    if (src === RNONE || !FORWARD_ORIGIN[fwd]) continue;
    if (!bySource.has(fwd)) bySource.set(fwd, { from: FORWARD_ORIGIN[fwd].stage, source: fwd, operands: [] });
    bySource.get(fwd).operands.push(`${operand} ${regLabel(src)}`);
  }
  return [...bySource.values()].map((a) => ({ ...a, label: `${a.source} → ${a.operands.join(', ')}` }));
}

/** Measures card centers so arcs line up with the cards at any width. */
function useCardCenters(container, deps) {
  const [centers, setCenters] = useState(null);
  useLayoutEffect(() => {
    const el = container.current;
    if (!el) return undefined;
    const measure = () => {
      const box = el.getBoundingClientRect();
      const next = {};
      for (const card of el.querySelectorAll('[data-stage]')) {
        const r = card.getBoundingClientRect();
        next[card.dataset.stage] = r.left - box.left + r.width / 2;
      }
      setCenters({ width: box.width, ...next });
    };
    measure();
    const ro = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(measure);
    ro?.observe(el);
    return () => ro?.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  return centers;
}

export default function StageFlow({ cycle, numberFormat, highlighted, focusUid, onFocusUid }) {
  const container = useRef(null);
  const centers = useCardCenters(container, []);
  const arcs = forwardArcs(cycle);

  return (
    <div className="stage-flow" ref={container}>
      <div className="arc-band" style={{ height: ARC_BAND }} aria-hidden={arcs.length === 0}>
        {centers?.width > 0 && (
          <svg width={centers.width} height={ARC_BAND} className="arc-svg" aria-hidden="true">
            <defs>
              <marker id="arc-head" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="7" markerHeight="7" orient="auto">
                <path d="M0,0 L8,4 L0,8 z" fill="var(--tone-forward)" />
              </marker>
              <marker id="arc-head-blocked" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="7" markerHeight="7" orient="auto">
                <path d="M0,0 L8,4 L0,8 z" fill="var(--tone-stall)" />
              </marker>
            </defs>
            {arcs.map((arc, i) => {
              const x1 = centers[arc.from];
              const x2 = centers.decode + (i - (arcs.length - 1) / 2) * 14;
              const top = 6 + i * 12;
              return (
                <path
                  key={arc.label}
                  className={`arc${arc.blocked ? ' is-blocked' : ''}`}
                  d={`M ${x1} ${ARC_BAND} C ${x1} ${top}, ${x2} ${top}, ${x2} ${ARC_BAND - 2}`}
                  markerEnd={`url(#${arc.blocked ? 'arc-head-blocked' : 'arc-head'})`}
                />
              );
            })}
          </svg>
        )}
        {centers?.width > 0 && arcs.map((arc, i) => (
          <span
            key={arc.label}
            className={`arc-label${arc.blocked ? ' is-blocked' : ''}`}
            style={{ left: (centers[arc.from] + centers.decode) / 2, top: i * 12 }}
          >
            {arc.label}
          </span>
        ))}
      </div>

      <div className="stage-strip" aria-label="Pipeline stages">
        {STAGE_KEYS.map((key, i) => {
          const stage = cycle.stages[key];
          const next = STAGE_KEYS[i + 1];
          const conn = next ? connectorState(cycle.control, key, next) : null;
          return (
            <Fragment key={key}>
              <div
                className="stage-cell"
                data-stage={key}
                onMouseEnter={() => onFocusUid(stage.bubble ? null : stage.uid)}
                onMouseLeave={() => onFocusUid(null)}
              >
                <StageCard
                  stageKey={key}
                  stage={stage}
                  control={cycle.control}
                  numberFormat={numberFormat}
                  highlight={highlighted.includes(key)}
                  focused={!stage.bubble && stage.uid !== null && stage.uid === focusUid}
                />
              </div>
              {conn && (
                <div className={`connector is-${conn.kind}`} title={conn.title}>
                  <span className="connector-icon" aria-hidden="true">
                    {conn.kind === 'advance' ? '→' : conn.kind === 'held' ? '⏸' : '○'}
                  </span>
                  {conn.label && <span className="connector-label">{conn.label}</span>}
                  <span className="sr-only">{conn.title}</span>
                </div>
              )}
            </Fragment>
          );
        })}
      </div>
    </div>
  );
}
