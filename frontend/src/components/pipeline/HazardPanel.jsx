import { EVENT_KINDS } from '../../utils/hazards.js';
import Panel from '../common/Panel.jsx';
import GlossaryTerm from '../common/GlossaryTerm.jsx';
import { linkTerms } from '../../utils/glossary.js';

/** Renders `code` spans written as backticks in the explanation text. */
export function RichText({ text }) {
  const seen = new Set();
  const parts = text.split('`');
  return parts.map((part, i) => {
    if (i % 2) return <code key={i}>{part}</code>;
    return (
      <span key={i}>
        {linkTerms(part, seen).map((seg, j) => (seg.term
          ? <GlossaryTerm key={j} text={seg.text} term={seg.term} definition={seg.definition} />
          : seg.text))}
      </span>
    );
  });
}

/** Plain-language account of the current cycle; `children` (the run summary) goes first. */
export default function HazardPanel({ events, onHover, children }) {
  return (
    <Panel id="explanation" collapsible title="This cycle" className="hazard-panel">
      {children}
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
