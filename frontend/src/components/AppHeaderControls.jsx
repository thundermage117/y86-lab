export default function AppHeaderControls({
  loading,
  hasData,
  hasAnyData,
  cycleIdx,
  total,
  playing,
  numberFormat,
  theme,
  error,
  executionMode,
  runStateLabel,
  onLoadSimulation,
  onExecutionModeChange,
  onPrev,
  onNext,
  onTogglePlay,
  onCycleChange,
  onNumberFormatChange,
  onThemeToggle,
}) {
  return (
    <>
      <div className="header-controls">
        <button
          className="btn btn-primary"
          onClick={onLoadSimulation}
          disabled={loading}
        >
          {loading ? 'Loading…' : (hasAnyData || hasData) ? 'Reload' : 'Load Simulation'}
        </button>

        <div className="format-switch" role="group" aria-label="Processor mode">
          <button
            type="button"
            className={`format-switch-btn${executionMode === 'pipelined' ? ' is-active' : ''}`}
            onClick={() => onExecutionModeChange('pipelined')}
            aria-pressed={executionMode === 'pipelined'}
          >
            Pipeline
          </button>
          <button
            type="button"
            className={`format-switch-btn${executionMode === 'sequential' ? ' is-active' : ''}`}
            onClick={() => onExecutionModeChange('sequential')}
            aria-pressed={executionMode === 'sequential'}
          >
            Sequential
          </button>
        </div>

        <div className="playback-controls" aria-label="Playback controls">
          <button className="btn btn-icon" onClick={onPrev} disabled={!hasData || cycleIdx === 0} title="Previous cycle (Left Arrow)">&#9664;</button>
          <button className="btn btn-icon btn-icon-primary" onClick={onTogglePlay} disabled={!hasData} title={playing ? 'Pause (Space)' : 'Play (Space)'}>
            {playing ? '\u23F8' : '\u25B6'}
          </button>
          <button className="btn btn-icon" onClick={onNext} disabled={!hasData || cycleIdx >= total - 1} title="Next cycle (Right Arrow)">&#9654;</button>
        </div>

        <div className="cycle-display">
          {hasData ? (
            <>Cycle <strong>{cycleIdx + 1}</strong> / {total}</>
          ) : (
            'Cycle -- / --'
          )}
        </div>

        {hasData ? (
          <input
            className="cycle-slider header-slider"
            type="range"
            min={0}
            max={total - 1}
            value={cycleIdx}
            onChange={(e) => onCycleChange(Number(e.target.value))}
            aria-label="Cycle timeline slider"
          />
        ) : (
          <div className="header-slider-placeholder" aria-hidden="true" />
        )}

        <div className="format-switch" role="group" aria-label="Number format">
          <button
            type="button"
            className={`format-switch-btn${numberFormat === 'dec' ? ' is-active' : ''}`}
            onClick={() => onNumberFormatChange('dec')}
            aria-pressed={numberFormat === 'dec'}
          >
            Dec
          </button>
          <button
            type="button"
            className={`format-switch-btn${numberFormat === 'hex' ? ' is-active' : ''}`}
            onClick={() => onNumberFormatChange('hex')}
            aria-pressed={numberFormat === 'hex'}
          >
            Hex
          </button>
        </div>
      </div>

      <div className="header-status">
        <button
          type="button"
          className="theme-toggle-btn"
          onClick={onThemeToggle}
          aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`}
          title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`}
          aria-pressed={theme === 'light'}
        >
          <span className="theme-toggle-icon" aria-hidden="true">
            {theme === 'dark' ? '☾' : '☀'}
          </span>
        </button>
        <div className={`status-pill status-${error ? 'error' : loading ? 'busy' : 'ok'}`}>
          {runStateLabel}
        </div>
        <div className="status-pill status-neutral">
          {executionMode === 'sequential' ? 'Sequential CPU' : 'Pipelined CPU'}
        </div>
        <div className="status-pill status-neutral">
          {hasData ? `${total} cycles` : 'No data'}
        </div>
      </div>
    </>
  );
}
