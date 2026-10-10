import { EVENT_KINDS } from '../utils/hazards.js';

/**
 * Marks eventful cycles along the cycle slider. Decorative for assistive tech:
 * the event Prev/Next buttons and [ / ] keys are the accessible route.
 */
export default function HazardTicks({ ticks, total, onSeek }) {
  if (!ticks?.length || total < 2) return null;
  return (
    <div className="hazard-ticks" aria-hidden="true">
      {ticks.map((t) => (
        <button
          key={t.index}
          type="button"
          tabIndex={-1}
          className={`hazard-tick tone-${EVENT_KINDS[t.kind].tone}`}
          style={{ '--p': t.index / (total - 1) }}
          title={`Cycle ${t.index + 1}: ${t.kinds.map((k) => EVENT_KINDS[k].label).join(', ')}`}
          onClick={() => onSeek(t.index)}
        />
      ))}
    </div>
  );
}
