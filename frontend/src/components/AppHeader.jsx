import Segmented from './common/Segmented.jsx';
import { SPEEDS } from '../hooks/usePlayback.js';
import HazardTicks from './HazardTicks.jsx';

function Icon({ name }) {
  const paths = {
    first: 'M6 5h2v14H6zM20 5v14L9 12z',
    prev: 'M15 5v14L6 12z',
    play: 'M8 5v14l11-7z',
    pause: 'M7 5h4v14H7zM13 5h4v14h-4z',
    next: 'M9 5v14l9-7z',
    last: 'M16 5h2v14h-2zM4 5v14l11-7z',
    sun: 'M12 7a5 5 0 1 0 0 10 5 5 0 0 0 0-10zm0-5 1 3h-2zm0 20-1-3h2zM2 12l3-1v2zm20 0-3 1v-2zM4.9 4.9l2.8 1.4-1.4 1.4zm14.2 14.2-2.8-1.4 1.4-1.4zM4.9 19.1l1.4-2.8 1.4 1.4zM19.1 4.9l-1.4 2.8-1.4-1.4z',
    moon: 'M20 15.5A8.5 8.5 0 0 1 8.5 4a8.5 8.5 0 1 0 11.5 11.5z',
  };
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" focusable="false">
      <path d={paths[name]} fill="currentColor" />
    </svg>
  );
}

function Playback({ playback, disabled, ticks }) {
  const { index, total, playing, speed, setSpeed, seek, step, toggle } = playback;
  return (
    <div className="playback" role="group" aria-label="Cycle playback">
      <button type="button" className="icon-btn" onClick={() => seek(0)} disabled={disabled || index === 0} aria-label="First cycle" title="First cycle (Home)">
        <Icon name="first" />
      </button>
      <button type="button" className="icon-btn" onClick={() => step(-1)} disabled={disabled || index === 0} aria-label="Previous cycle" title="Previous cycle (←)">
        <Icon name="prev" />
      </button>
      <button type="button" className="icon-btn icon-btn-primary" onClick={toggle} disabled={disabled} aria-label={playing ? 'Pause' : 'Play'} title="Play / pause (Space)">
        <Icon name={playing ? 'pause' : 'play'} />
      </button>
      <button type="button" className="icon-btn" onClick={() => step(1)} disabled={disabled || index >= total - 1} aria-label="Next cycle" title="Next cycle (→)">
        <Icon name="next" />
      </button>
      <button type="button" className="icon-btn" onClick={() => seek(total - 1)} disabled={disabled || index >= total - 1} aria-label="Last cycle" title="Last cycle (End)">
        <Icon name="last" />
      </button>
      <div className="cycle-scrub">
        <label className="cycle-label" htmlFor="cycle-slider">
          Cycle <strong>{disabled ? '–' : index + 1}</strong>
          <span className="muted"> / {disabled ? '–' : total}</span>
        </label>
        <input
          id="cycle-slider"
          type="range"
          min={0}
          max={Math.max(0, total - 1)}
          value={index}
          disabled={disabled}
          onChange={(e) => seek(Number(e.target.value))}
        />
        {!disabled && <HazardTicks ticks={ticks} total={total} onSeek={seek} />}
      </div>
      <label className="speed-select">
        <span className="sr-only">Playback speed</span>
        <select value={speed} onChange={(e) => setSpeed(Number(e.target.value))} disabled={disabled}>
          {SPEEDS.map((s, i) => <option key={s.label} value={i}>{s.label}</option>)}
        </select>
      </label>
    </div>
  );
}

export default function AppHeader({
  playback, hasData, ticks, mode, onModeChange, numberFormat, onNumberFormatChange, theme, onThemeToggle, status,
}) {
  return (
    <header className="app-header">
      <div className="brand">
        <span className="brand-mark" aria-hidden="true">
          <i /><i /><i /><i />
        </span>
        <div>
          <h1>Y86-64 Pipeline Visualizer</h1>
          <p className="brand-sub">Real Verilog CPUs, cycle by cycle</p>
        </div>
      </div>

      <div className="header-controls">
        <Segmented
          label="CPU"
          value={mode}
          onChange={onModeChange}
          options={[
            { value: 'pipelined', label: 'Pipelined', title: '5-stage PIPE processor' },
            { value: 'sequential', label: 'Sequential', title: 'Single-cycle SEQ processor' },
          ]}
        />
        <Playback playback={playback} disabled={!hasData} ticks={ticks} />
      </div>

      <div className="header-end">
        <Segmented
          label="Number format"
          size="sm"
          value={numberFormat}
          onChange={onNumberFormatChange}
          options={[{ value: 'dec', label: 'Dec' }, { value: 'hex', label: 'Hex' }]}
        />
        <button
          type="button"
          className="icon-btn"
          onClick={onThemeToggle}
          aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`}
          title="Toggle theme"
        >
          <Icon name={theme === 'dark' ? 'sun' : 'moon'} />
        </button>
        <span className={`status-pill status-${status.tone}`} role="status" aria-live="polite">
          {status.label}
        </span>
      </div>
    </header>
  );
}
