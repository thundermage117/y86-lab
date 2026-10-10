import { EVENT_KINDS } from '../../utils/hazards.js';
import Panel from '../common/Panel.jsx';

const NAV_KINDS = ['loadUse', 'mispredict', 'ret', 'forward', 'exception'];

/** Renders `code` spans written as backticks in the explanation text. */
export function RichText({ text }) {
  const parts = text.split('`');
  return parts.map((part, i) => (i % 2 ? <code key={i}>{part}</code> : <span key={i}>{part}</span>));
}

export default function HazardPanel({ events, onHover, navKinds, onNavKindsChange, onPrevHazard, onNextHazard, canNavigate, title = 'What is happening this cycle' }) {
  const toggleKind = (kind) => {
    const next = new Set(navKinds);
    if (next.has(kind)) next.delete(kind); else next.add(kind);
    if (next.size > 0) onNavKindsChange(next);
  };

  return (
    <Panel
      title={title}
      className="hazard-panel"
      actions={canNavigate ? (
        <div className="hazard-nav">
          <button type="button" className="btn btn-sm" onClick={onPrevHazard} title="Previous event ([)">← Prev</button>
          <button type="button" className="btn btn-sm" onClick={onNextHazard} title="Next event (])">Next →</button>
        </div>
      ) : null}
    >
      {canNavigate && (
        <fieldset className="hazard-filter">
          <legend className="sr-only">Jump between</legend>
          {NAV_KINDS.map((kind) => (
            <label key={kind} className={`filter-chip tone-${EVENT_KINDS[kind].tone}`}>
              <input type="checkbox" checked={navKinds.has(kind)} onChange={() => toggleKind(kind)} />
              {EVENT_KINDS[kind].label}
            </label>
          ))}
        </fieldset>
      )}
      {events.length === 0 ? (
        <p className="calm">
          Smooth sailing: every stage passes its instruction on to the next one. No stalls, bubbles or forwarding this cycle.
        </p>
      ) : (
        <ul className="event-list">
          {events.map((ev, i) => (
            <li
              key={`${ev.kind}-${i}`}
              className={`event tone-${EVENT_KINDS[ev.kind]?.tone ?? 'info'}`}
              onMouseEnter={() => onHover?.(ev.stages)}
              onMouseLeave={() => onHover?.([])}
            >
              <span className="event-kind">{EVENT_KINDS[ev.kind]?.label ?? 'Note'}</span>
              <strong className="event-title">{ev.title}</strong>
              <p className="event-detail"><RichText text={ev.detail} /></p>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}
