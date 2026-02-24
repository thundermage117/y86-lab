import { useState, useEffect, useRef, useCallback } from 'react';
import PipelineDiagram from './components/PipelineDiagram';
import RegisterFile from './components/RegisterFile';
import './App.css';

const API_URL = 'http://localhost:3001/api/simulate';
const PLAY_INTERVAL_MS = 200;
const ZERO_REG = '0x0000000000000000';
const STAGE_KEYS = ['fetch', 'decode', 'execute', 'memory', 'writeback'];

function formatPercent(value) {
  return `${Math.round(value)}%`;
}

export default function App() {
  const [cycles, setCycles] = useState([]);
  const [cycleIdx, setCycleIdx] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [playing, setPlaying] = useState(false);
  const playTimer = useRef(null);

  const currentCycle = cycles[cycleIdx] ?? null;
  const previousCycle = cycleIdx > 0 ? cycles[cycleIdx - 1] ?? null : null;
  const total = cycles.length;
  const hasData = total > 0;

  const activeStages = currentCycle
    ? STAGE_KEYS.filter((key) => currentCycle[key]?.icode_name && currentCycle[key].icode_name !== 'x').length
    : 0;

  const nonZeroRegisterCount = currentCycle
    ? Object.values(currentCycle.registers ?? {}).filter((value) => value !== 'x' && value !== ZERO_REG).length
    : 0;

  const changedRegisters = currentCycle && previousCycle
    ? Object.entries(currentCycle.registers ?? {})
        .filter(([name, value]) => previousCycle.registers?.[name] !== value)
        .map(([name, value]) => ({ name, value, prev: previousCycle.registers?.[name] ?? 'x' }))
    : [];

  const stageDetails = currentCycle
    ? STAGE_KEYS.map((key) => ({
        key,
        label: key.toUpperCase(),
        icodeName: currentCycle[key]?.icode_name ?? 'x',
        icode: currentCycle[key]?.icode,
        previousIcodeName: previousCycle?.[key]?.icode_name ?? null,
      }))
    : [];

  const stageOccupancy = hasData ? (activeStages / STAGE_KEYS.length) * 100 : 0;
  const progressPercent = total > 1 ? (cycleIdx / (total - 1)) * 100 : hasData ? 100 : 0;

  const runStateLabel = loading
    ? 'Loading simulation'
    : error
      ? 'Load failed'
      : !hasData
        ? 'Idle'
        : playing
          ? 'Playing'
          : cycleIdx >= total - 1
            ? 'Paused (end)'
            : 'Paused';

  // Auto-play logic
  useEffect(() => {
    if (playing && total > 0) {
      playTimer.current = setInterval(() => {
        setCycleIdx(prev => {
          if (prev >= total - 1) {
            setPlaying(false);
            return prev;
          }
          return prev + 1;
        });
      }, PLAY_INTERVAL_MS);
    }
    return () => clearInterval(playTimer.current);
  }, [playing, total]);

  const loadSimulation = useCallback(async () => {
    setLoading(true);
    setError(null);
    setPlaying(false);
    setCycleIdx(0);
    try {
      const res = await fetch(API_URL);
      if (!res.ok) throw new Error(`Server error: ${res.status}`);
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setCycles(data.cycles);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  const prev = useCallback(() => setCycleIdx(i => Math.max(0, i - 1)), []);
  const next = useCallback(() => setCycleIdx(i => Math.min(total - 1, i + 1)), [total]);
  const togglePlay = useCallback(() => {
    if (!hasData) return;
    setPlaying(p => !p);
  }, [hasData]);

  useEffect(() => {
    const onKeyDown = (event) => {
      const targetTag = event.target?.tagName?.toLowerCase();
      const isFormField = targetTag === 'input' || targetTag === 'textarea' || targetTag === 'select';
      if (isFormField || event.target?.isContentEditable) return;
      if (!hasData) return;

      if (event.key === 'ArrowLeft') {
        event.preventDefault();
        setPlaying(false);
        prev();
      } else if (event.key === 'ArrowRight') {
        event.preventDefault();
        setPlaying(false);
        next();
      } else if (event.key === ' ') {
        event.preventDefault();
        togglePlay();
      } else if (event.key === 'Home') {
        event.preventDefault();
        setPlaying(false);
        setCycleIdx(0);
      } else if (event.key === 'End') {
        event.preventDefault();
        setPlaying(false);
        setCycleIdx(total - 1);
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [hasData, total, prev, next, togglePlay]);

  return (
    <div className="app">
      <header className="app-header">
        <div>
          <h1>Y86-64 Pipeline Visualizer</h1>
          <p className="subtitle">Cycle-by-cycle inspection of the 5-stage pipelined processor with register activity and stage occupancy insights.</p>
        </div>
        <div className="header-status">
          <div className={`status-pill status-${error ? 'error' : loading ? 'busy' : 'ok'}`}>
            {runStateLabel}
          </div>
          <div className="status-pill status-neutral">
            {hasData ? `${total} captured cycles` : 'No simulation loaded'}
          </div>
        </div>
      </header>

      <main className="app-main">
        <section className="controls-panel">
          <div className="controls-bar">
            <button
              className="btn btn-primary"
              onClick={loadSimulation}
              disabled={loading}
            >
              {loading ? 'Loading...' : hasData ? 'Reload Simulation' : 'Load Simulation'}
            </button>

            <div className="playback-controls" aria-label="Playback controls">
              <button className="btn btn-icon" onClick={prev} disabled={!hasData || cycleIdx === 0} title="Previous cycle (Left Arrow)">&#9664;</button>
              <button className="btn btn-icon btn-icon-primary" onClick={togglePlay} disabled={!hasData} title={playing ? 'Pause (Space)' : 'Play (Space)'}>
                {playing ? '\u23F8' : '\u25B6'}
              </button>
              <button className="btn btn-icon" onClick={next} disabled={!hasData || cycleIdx >= total - 1} title="Next cycle (Right Arrow)">&#9654;</button>
            </div>

            <div className="cycle-display">
              {hasData ? (
                <>
                  Cycle <strong>{cycleIdx + 1}</strong> / {total}
                </>
              ) : (
                'Cycle -- / --'
              )}
            </div>
          </div>

          <div className="progress-panel">
            <div className="progress-meta">
              <span>Timeline Progress</span>
              <strong>{formatPercent(progressPercent)}</strong>
            </div>
            <div className="progress-track" aria-hidden="true">
              <div className="progress-fill" style={{ width: `${progressPercent}%` }} />
            </div>
            {hasData ? (
              <input
                className="cycle-slider"
                type="range"
                min={0}
                max={total - 1}
                value={cycleIdx}
                onChange={e => {
                  setPlaying(false);
                  setCycleIdx(Number(e.target.value));
                }}
                aria-label="Cycle timeline slider"
              />
            ) : (
              <div className="progress-empty">Load the backend simulation to enable scrubbing and playback.</div>
            )}
          </div>

          <div className="shortcuts-row">
            <span><kbd>Space</kbd> Play/Pause</span>
            <span><kbd>&larr;</kbd>/<kbd>&rarr;</kbd> Step</span>
            <span><kbd>Home</kbd>/<kbd>End</kbd> Jump</span>
          </div>
        </section>

        {error && <div className="error-banner">Error: {error}</div>}

        {hasData && currentCycle && (
          <section className="section summary-section">
            <h2 className="section-title">Cycle Summary</h2>
            <div className="summary-grid">
              <div className="stat-card">
                <div className="stat-label">Stage Occupancy</div>
                <div className="stat-value">{activeStages} / {STAGE_KEYS.length}</div>
                <div className="mini-track" aria-hidden="true">
                  <div className="mini-fill" style={{ width: `${stageOccupancy}%` }} />
                </div>
              </div>
              <div className="stat-card">
                <div className="stat-label">Registers Changed</div>
                <div className="stat-value">{changedRegisters.length}</div>
                <div className="stat-note">{cycleIdx === 0 ? 'Baseline cycle (no previous diff)' : 'Compared to previous cycle'}</div>
              </div>
              <div className="stat-card">
                <div className="stat-label">Non-zero Registers</div>
                <div className="stat-value">{nonZeroRegisterCount}</div>
                <div className="stat-note">Out of 15 tracked architectural registers</div>
              </div>
              <div className="stat-card">
                <div className="stat-label">Pipeline Snapshot</div>
                <div className="stat-value stat-value-compact">
                  {stageDetails.map((stage) => stage.icodeName).join(' | ')}
                </div>
                <div className="stat-note">Fetch to Writeback</div>
              </div>
            </div>
          </section>
        )}

        <section className="section">
          <h2 className="section-title">Pipeline Stages</h2>
          <PipelineDiagram cycleData={currentCycle} />
        </section>

        {currentCycle ? (
          <div className="detail-grid">
            <section className="section cycle-details">
              <h2 className="section-title">Cycle Insights</h2>

              <div className="insight-block">
                <div className="insight-heading">Stage Details</div>
                <div className="stage-detail-list">
                  {stageDetails.map((stage) => {
                    const icodeHex = stage.icode === null || stage.icode === undefined
                      ? 'x'
                      : `0x${stage.icode.toString(16).toUpperCase()}`;
                    const changed = previousCycle && stage.previousIcodeName !== stage.icodeName;
                    return (
                      <div key={stage.key} className={`stage-detail-item${changed ? ' stage-detail-changed' : ''}`}>
                        <div className="stage-detail-label">{stage.label}</div>
                        <div className="stage-detail-main">
                          <span className="stage-detail-icode">{stage.icodeName}</span>
                          <span className="stage-detail-hex">{icodeHex}</span>
                        </div>
                        <div className="stage-detail-note">
                          {previousCycle
                            ? (changed ? `Changed from ${stage.previousIcodeName ?? 'x'}` : 'Unchanged from previous cycle')
                            : 'First captured cycle'}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="insight-block">
                <div className="insight-heading">Register Activity</div>
                {changedRegisters.length > 0 ? (
                  <div className="change-list">
                    {changedRegisters.map((entry) => (
                      <div key={entry.name} className="change-row">
                        <span className="change-reg">%{entry.name}</span>
                        <span className="change-prev">{entry.prev}</span>
                        <span className="change-arrow">→</span>
                        <span className="change-next">{entry.value}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="empty-note">
                    {cycleIdx === 0 ? 'Diffs begin at cycle 2 because cycle 1 has no prior state.' : 'No register value changes detected in this cycle.'}
                  </div>
                )}
              </div>
            </section>

            <RegisterFile
              registers={currentCycle.registers}
              changedRegisters={new Set(changedRegisters.map((entry) => entry.name))}
            />
          </div>
        ) : (
          <section className="section empty-state">
            <h2 className="section-title">Getting Started</h2>
            <p>Click <strong>Load Simulation</strong> to fetch parsed pipeline cycles from the backend.</p>
            <p>The UI will then show pipeline stages, cycle-by-cycle register diffs, and a scrubber to inspect execution over time.</p>
          </section>
        )}
      </main>
    </div>
  );
}
