import { SPEEDS } from '../hooks/usePlayback.js';
import { EVENT_KINDS } from '../utils/hazards.js';
import HazardTicks from './HazardTicks.jsx';
import Chip from './common/Chip.jsx';
import { IconButton } from './common/Icon.jsx';

const NAV_KINDS = ['loadUse', 'mispredict', 'ret', 'forward', 'exception'];

/** Jump between eventful cycles; the chips filter the jumps and color-key the slider ticks. */
function EventNav({ navKinds, onNavKindsChange, onPrev, onNext }) {
  const toggleKind = (kind) => {
    const next = new Set(navKinds);
    if (next.has(kind)) next.delete(kind); else next.add(kind);
    if (next.size > 0) onNavKindsChange(next);
  };
  return (
    <div className="event-nav" role="group" aria-label="Jump between events">
      <IconButton icon="eventPrev" size="sm" label="Previous event" title="Previous event ([)" onClick={onPrev} />
      <IconButton icon="eventNext" size="sm" label="Next event" title="Next event (])" onClick={onNext} />
      <fieldset className="event-filter">
        <legend className="sr-only">Events to jump between</legend>
        {NAV_KINDS.map((kind) => (
          <Chip as="label" key={kind} variant="quiet" tone={EVENT_KINDS[kind].tone}>
            <input type="checkbox" checked={navKinds.has(kind)} onChange={() => toggleKind(kind)} />
            {EVENT_KINDS[kind].label}
          </Chip>
        ))}
      </fieldset>
    </div>
  );
}

/**
 * Cycle transport for the cycle-based views: playback, the cycle slider with
 * event ticks, speed, and (pipelined only) event navigation.
 */
export default function Transport({ playback, ticks, nav }) {
  const { index, total, playing, speed, setSpeed, seek, step, toggle } = playback;
  const atStart = index === 0;
  const atEnd = index >= total - 1;
  return (
    <div className="transport">
      <div className="playback" role="group" aria-label="Cycle playback">
        <IconButton icon="first" label="First cycle" title="First cycle (Home)" onClick={() => seek(0)} disabled={atStart} />
        <IconButton icon="prev" label="Previous cycle" title="Previous cycle (←)" onClick={() => step(-1)} disabled={atStart} />
        <IconButton icon={playing ? 'pause' : 'play'} primary label={playing ? 'Pause' : 'Play'} title="Play / pause (Space)" onClick={toggle} />
        <IconButton icon="next" label="Next cycle" title="Next cycle (→)" onClick={() => step(1)} disabled={atEnd} />
        <IconButton icon="last" label="Last cycle" title="Last cycle (End)" onClick={() => seek(total - 1)} disabled={atEnd} />
      </div>
      <div className="cycle-scrub">
        <label className="cycle-label" htmlFor="cycle-slider">
          Cycle <strong>{index + 1}</strong><span className="muted"> / {total}</span>
        </label>
        <div className="cycle-track">
          <input
            id="cycle-slider"
            type="range"
            min={0}
            max={Math.max(0, total - 1)}
            value={index}
            onChange={(e) => seek(Number(e.target.value))}
          />
          <HazardTicks ticks={ticks} total={total} onSeek={seek} />
        </div>
      </div>
      <label className="speed-select">
        <span className="sr-only">Playback speed</span>
        <select className="select-sm" value={speed} onChange={(e) => setSpeed(Number(e.target.value))}>
          {SPEEDS.map((s, i) => <option key={s.label} value={i}>{s.label}</option>)}
        </select>
      </label>
      {nav && <EventNav {...nav} />}
    </div>
  );
}
