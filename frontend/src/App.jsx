import { useState, useEffect, useRef, useCallback } from 'react';
import PipelineDiagram from './components/PipelineDiagram';
import RegisterFile from './components/RegisterFile';
import InstructionMemoryViewer from './components/InstructionMemoryViewer';
import { formatNumericString, formatOpcodeValue } from './utils/numberFormat';
import './App.css';

const API_URL = 'http://localhost:3001/api/simulate';
const PLAY_INTERVAL_MS = 200;
const ZERO_REG = '0x0000000000000000';
const STAGE_KEYS = ['fetch', 'decode', 'execute', 'memory', 'writeback'];
const THEME_STORAGE_KEY = 'y86-pipeline-theme';

function getInitialTheme() {
  if (typeof window === 'undefined') return 'dark';

  const savedTheme = window.localStorage.getItem(THEME_STORAGE_KEY);
  if (savedTheme === 'light' || savedTheme === 'dark') return savedTheme;

  return window.matchMedia?.('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
}

function formatPercent(value) {
  return `${Math.round(value)}%`;
}

function formatPercentPrecise(value) {
  if (!Number.isFinite(value)) return '--';
  return `${value.toFixed(1)}%`;
}

function formatCpi(totalCycles, retiredInstructions) {
  if (!retiredInstructions) return '--';
  return (totalCycles / retiredInstructions).toFixed(2);
}

function computePerformanceMetrics(cycles) {
  if (!Array.isArray(cycles) || cycles.length === 0) {
    return {
      retiredInstructions: 0,
      mispredictions: 0,
      dataHazardStallCycles: 0,
      branchPenaltyCycles: 0,
      branchPenaltyPercent: 0,
    };
  }

  let retiredInstructions = 0;
  let mispredictions = 0;
  let dataHazardStallCycles = 0;

  for (const cycle of cycles) {
    const writebackIcode = cycle?.writeback?.icode_name;
    if (writebackIcode && writebackIcode !== 'x' && writebackIcode !== 'NOP') {
      retiredInstructions += 1;
    }

    const isBranchMispredict = cycle?.execute?.icode_name === 'JXX' && cycle?.flags?.e_Cnd === false;
    if (isBranchMispredict) {
      mispredictions += 1;
    }

    const control = cycle?.control;
    const isDataHazardStall = Boolean(control?.F_stall && control?.D_stall && control?.E_bubble) && !isBranchMispredict;
    if (isDataHazardStall) {
      dataHazardStallCycles += 1;
    }
  }

  const branchPenaltyCycles = mispredictions * 2;
  const branchPenaltyPercent = (branchPenaltyCycles / cycles.length) * 100;

  return {
    retiredInstructions,
    mispredictions,
    dataHazardStallCycles,
    branchPenaltyCycles,
    branchPenaltyPercent,
  };
}

function formatBool(value) {
  if (value === null || value === undefined) return 'x';
  return value ? '1' : '0';
}

function flagStateLabel(value) {
  if (value === null || value === undefined) return 'x';
  return value ? 'set' : 'clear';
}

function MetricTooltip({ label, description }) {
  return (
    <span className="metric-label">
      <span>{label}</span>
      <span className="metric-help">
        <button
          type="button"
          className="metric-help-trigger"
          aria-label={`${label}: measurement details`}
        >
          ?
        </button>
        <span role="tooltip" className="metric-tooltip">
          {description}
        </span>
      </span>
    </span>
  );
}

export default function App() {
  const [cycles, setCycles] = useState([]);
  const [cycleIdx, setCycleIdx] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [playing, setPlaying] = useState(false);
  const [numberFormat, setNumberFormat] = useState('dec');
  const [theme, setTheme] = useState(getInitialTheme);
  const [instructionMemory, setInstructionMemory] = useState(null);
  const playTimer = useRef(null);

  const currentCycle = cycles[cycleIdx] ?? null;
  const previousCycle = cycleIdx > 0 ? cycles[cycleIdx - 1] ?? null : null;
  const total = cycles.length;
  const hasData = total > 0;
  const control = currentCycle?.control ?? null;
  const flags = currentCycle?.flags ?? null;
  const meta = currentCycle?.meta ?? null;
  const performanceMetrics = computePerformanceMetrics(cycles);

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
        ifunHex: currentCycle[key]?.ifun_hex ?? 'x',
        pcHex: currentCycle[key]?.pc_hex ?? 'x',
        statName: currentCycle[key]?.stat_name ?? 'x',
        statHex: currentCycle[key]?.stat_hex ?? 'x',
      }))
    : [];

  const activeControlEvents = [];
  if (control?.F_stall) activeControlEvents.push('F_stall');
  if (control?.D_stall) activeControlEvents.push('D_stall');
  if (control?.D_bubble) activeControlEvents.push('D_bubble');
  if (control?.E_stall) activeControlEvents.push('E_stall');
  if (control?.E_bubble) activeControlEvents.push('E_bubble');
  if (control?.M_stall) activeControlEvents.push('M_stall');
  if (control?.M_bubble) activeControlEvents.push('M_bubble');
  if (control?.W_stall) activeControlEvents.push('W_stall');
  if (control?.W_bubble) activeControlEvents.push('W_bubble');
  if (flags?.set_cc) activeControlEvents.push('set_cc');
  if (flags?.e_Cnd === false && currentCycle?.execute?.icode_name === 'JXX') activeControlEvents.push('branch_not_taken');

  const hazardHeadline = !currentCycle
    ? 'No cycle selected'
    : activeControlEvents.length === 0
      ? 'No hazard controls active'
      : activeControlEvents.join(', ');

  const controlRows = control ? [
    ['F_stall', control.F_stall],
    ['D_stall', control.D_stall],
    ['D_bubble', control.D_bubble],
    ['E_bubble', control.E_bubble],
    ['instr_valid', control.instr_valid],
    ['imem_error', control.imem_error],
    ['set_cc', flags?.set_cc ?? null],
    ['e_Cnd', flags?.e_Cnd ?? null],
    ['M_Cnd', flags?.M_Cnd ?? null],
  ] : [];

  const ccRows = flags ? [
    ['ZF', flags.zf],
    ['SF', flags.sf],
    ['OF', flags.of],
  ] : [];

  const newCcRows = flags ? [
    ['new ZF', flags.new_zf],
    ['new SF', flags.new_sf],
    ['new OF', flags.new_of],
  ] : [];

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

  const formatRegisterValue = (value) => formatNumericString(value, numberFormat, { signed: true, bitWidth: 64 });
  const formatAddressValue = (value) => formatNumericString(value, numberFormat);
  const formatSmallValue = (value) => formatNumericString(value, numberFormat);

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
    setInstructionMemory(null);
    try {
      const res = await fetch(API_URL);
      if (!res.ok) throw new Error(`Server error: ${res.status}`);
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setCycles(data.cycles);
      setInstructionMemory(data.instructionMemory ?? null);
    } catch (err) {
      setError(err.message);
      setInstructionMemory(null);
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

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.documentElement.style.colorScheme = theme;
    window.localStorage.setItem(THEME_STORAGE_KEY, theme);
  }, [theme]);

  return (
    <div className="app">
      <header className="app-header">
        <div>
          <h1>Y86-64 Pipeline Visualizer</h1>
          <p className="subtitle">Cycle-by-cycle inspection of the 5-stage pipelined processor with register activity and stage occupancy insights.</p>
        </div>
        <div className="header-status">
          <button
            type="button"
            className="theme-toggle-btn"
            onClick={() => setTheme((prevTheme) => (prevTheme === 'dark' ? 'light' : 'dark'))}
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
            {hasData ? `${total} captured cycles` : 'No simulation loaded'}
          </div>
        </div>
      </header>

      <main className="app-main">
        <aside className="app-sidebar" aria-label="Playback tools and page navigation">
          <div className="sidebar-stack">
            <section className="controls-panel" id="viewer-controls">
              <div className="controls-bar controls-bar-top">
                <button
                  className="btn btn-primary"
                  onClick={loadSimulation}
                  disabled={loading}
                >
                  {loading ? 'Loading...' : hasData ? 'Reload Simulation' : 'Load Simulation'}
                </button>

                <div className="format-switch" role="group" aria-label="Number format">
                  <button
                    type="button"
                    className={`format-switch-btn${numberFormat === 'dec' ? ' is-active' : ''}`}
                    onClick={() => setNumberFormat('dec')}
                    aria-pressed={numberFormat === 'dec'}
                  >
                    Decimal
                  </button>
                  <button
                    type="button"
                    className={`format-switch-btn${numberFormat === 'hex' ? ' is-active' : ''}`}
                    onClick={() => setNumberFormat('hex')}
                    aria-pressed={numberFormat === 'hex'}
                  >
                    Hex
                  </button>
                </div>
              </div>

              <div className="controls-bar controls-bar-secondary">
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
                  <div className="progress-empty">Load the simulation, then use this slider to move cycle by cycle.</div>
                )}
              </div>

              <div className="shortcuts-row">
                <span><kbd>Space</kbd> Play/Pause</span>
                <span><kbd>&larr;</kbd>/<kbd>&rarr;</kbd> Step</span>
                <span><kbd>Home</kbd>/<kbd>End</kbd> Jump</span>
              </div>
            </section>

            <details className="section sidebar-panel">
              <summary className="section-title sidebar-summary">How To Read This</summary>
              <div className="sidebar-copy sidebar-collapsible-body">
                <p><strong>1.</strong> Start with <em>Pipeline Stages</em> to see which instruction sits in each stage.</p>
                <p><strong>2.</strong> Use <em>Cycle Insights</em> for the main hazard signals, flags, and register changes.</p>
                <p><strong>3.</strong> Check <em>Register Activity</em> and <em>Register File</em> to see what changed.</p>
                <p className="sidebar-note">Decimal is the default format for readability. Switch to hex when comparing with hardware traces.</p>
              </div>
            </details>

            <details className="section sidebar-panel" open>
              <summary className="section-title sidebar-summary">Current View</summary>
              <div className="sidebar-metric-list sidebar-collapsible-body">
                <div className="sidebar-metric">
                  <span>Numbers shown as</span>
                  <strong>{numberFormat === 'dec' ? 'Decimal' : 'Hex'}</strong>
                </div>
                <div className="sidebar-metric">
                  <span>Active stages</span>
                  <strong>{hasData ? `${activeStages}/${STAGE_KEYS.length}` : '--'}</strong>
                </div>
                <div className="sidebar-metric">
                  <span>Changed registers</span>
                  <strong>{hasData ? changedRegisters.length : '--'}</strong>
                </div>
                <div className="sidebar-metric">
                  <span>Hazard activity</span>
                  <strong>{hasData ? (activeControlEvents.length === 0 ? 'Stable' : `${activeControlEvents.length} events`) : '--'}</strong>
                </div>
              </div>
            </details>

            <details className="section sidebar-panel" open>
              <summary className="section-title sidebar-summary">Performance Metrics</summary>
              <div className="sidebar-metric-list sidebar-collapsible-body">
                <div className="sidebar-metric">
                  <MetricTooltip
                    label="Total CPI"
                    description="Total CPI = total captured cycles / retired instructions. Retired instructions are counted from non-NOP instructions observed in the writeback stage."
                  />
                  <strong>{hasData ? formatCpi(total, performanceMetrics.retiredInstructions) : '--'}</strong>
                </div>
                <div className="sidebar-metric">
                  <MetricTooltip
                    label="Branch mispredict penalty"
                    description="Estimated penalty % = (2 penalty cycles per mispredicted JXX branch / total captured cycles) × 100. A misprediction is counted when execute has JXX and e_Cnd = 0."
                  />
                  <strong>{hasData ? formatPercentPrecise(performanceMetrics.branchPenaltyPercent) : '--'}</strong>
                </div>
                <div className="sidebar-metric">
                  <MetricTooltip
                    label="Data hazard stall cycles"
                    description="Counts cycles matching the data-hazard stall pattern: F_stall=1, D_stall=1, and E_bubble=1, excluding branch-mispredict cycles."
                  />
                  <strong>{hasData ? performanceMetrics.dataHazardStallCycles : '--'}</strong>
                </div>
                <div className="sidebar-metric">
                  <MetricTooltip
                    label="Retired instructions"
                    description="Number of non-NOP instructions observed in the writeback stage across all captured cycles."
                  />
                  <strong>{hasData ? performanceMetrics.retiredInstructions : '--'}</strong>
                </div>
              </div>
            </details>
          </div>
        </aside>

        <div className="app-content">
          {error && <div className="error-banner">Error: {error}</div>}

          {hasData && currentCycle && (
            <section className="section summary-section" id="cycle-summary">
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
                  <div className="stat-label">Control Activity</div>
                  <div className="stat-value stat-value-compact">
                    {activeControlEvents.length === 0 ? 'stable' : activeControlEvents.slice(0, 4).join(' | ')}
                  </div>
                  <div className="stat-note">
                    {activeControlEvents.length > 4
                      ? `+${activeControlEvents.length - 4} more events this cycle`
                      : (meta?.predPC && meta.predPC !== 'x' ? `predPC ${formatAddressValue(meta.predPC)}` : 'No stalls/bubbles asserted')}
                  </div>
                </div>
              </div>
            </section>
          )}

          <section className="section" id="pipeline-stages">
            <h2 className="section-title">Pipeline Stages</h2>
            <PipelineDiagram cycleData={currentCycle} numberFormat={numberFormat} control={control} />
          </section>

          {hasData && (
            <InstructionMemoryViewer
              instructionMemory={instructionMemory}
              currentCycle={currentCycle}
              numberFormat={numberFormat}
            />
          )}

          {currentCycle ? (
            <div className="detail-grid">
              <section className="section cycle-details" id="cycle-insights">
                <h2 className="section-title">Cycle Insights</h2>

                <div className="insight-block">
                  <div className="insight-heading">At a Glance</div>
                  <div className="summary-grid summary-grid-compact">
                    <div className="stat-card">
                      <div className="stat-label">Hazard State</div>
                      <div className="stat-value stat-value-compact">{activeControlEvents.length === 0 ? 'Stable' : 'Active'}</div>
                      <div className="stat-note">{hazardHeadline}</div>
                    </div>
                    <div className="stat-card">
                      <div className="stat-label">Condition Codes</div>
                      <div className="stat-value stat-value-compact">{formatSmallValue(flags?.cc_hex ?? 'x')}</div>
                      <div className="stat-note">
                        ZF {flagStateLabel(flags?.zf)} | SF {flagStateLabel(flags?.sf)} | OF {flagStateLabel(flags?.of)}
                      </div>
                    </div>
                    <div className="stat-card">
                      <div className="stat-label">Pending new_cc</div>
                      <div className="stat-value stat-value-compact">{formatSmallValue(flags?.new_cc_hex ?? 'x')}</div>
                      <div className="stat-note">
                        ZF {flagStateLabel(flags?.new_zf)} | SF {flagStateLabel(flags?.new_sf)} | OF {flagStateLabel(flags?.new_of)}
                      </div>
                    </div>
                    <div className="stat-card">
                      <div className="stat-label">Registers Changed</div>
                      <div className="stat-value">{changedRegisters.length}</div>
                      <div className="stat-note">{cycleIdx === 0 ? 'Baseline cycle' : 'Compared to previous cycle'}</div>
                    </div>
                  </div>
                </div>

                <div className="insight-block">
                  <div className="insight-heading">Control & Flags</div>
                  <div className="control-panels">
                    <div className="control-card">
                      <div className="control-card-title">Hazard / Control Signals</div>
                      <div className="control-headline">{hazardHeadline}</div>
                      {activeControlEvents.length > 0 ? (
                        <div className="chip-list" aria-label="Active control events">
                          {activeControlEvents.map((event) => (
                            <span key={event} className="event-chip">{event}</span>
                          ))}
                        </div>
                      ) : (
                        <div className="empty-note">No stalls, bubbles, or branch redirects are active in this cycle.</div>
                      )}
                    </div>

                    <div className="control-card">
                      <div className="control-card-title">Condition Codes</div>
                      <div className="flag-row">
                        <span className="flag-caption">Current CC</span>
                        <span className="flag-hex">{formatSmallValue(flags?.cc_hex ?? 'x')}</span>
                      </div>
                      <div className="flag-grid">
                        {ccRows.map(([label, value]) => (
                          <div key={label} className="flag-chip">
                            <span>{label}</span>
                            <strong>{flagStateLabel(value)}</strong>
                          </div>
                        ))}
                      </div>

                      <div className="flag-row flag-row-secondary">
                        <span className="flag-caption">Pending `new_cc`</span>
                        <span className="flag-hex">{formatSmallValue(flags?.new_cc_hex ?? 'x')}</span>
                      </div>
                      <div className="flag-grid">
                        {newCcRows.map(([label, value]) => (
                          <div key={label} className="flag-chip">
                            <span>{label}</span>
                            <strong>{flagStateLabel(value)}</strong>
                          </div>
                        ))}
                      </div>

                    </div>
                  </div>
                </div>

                <div className="insight-block">
                  <div className="insight-heading">Register Activity</div>
                  {changedRegisters.length > 0 ? (
                    <div className="change-list">
                      {changedRegisters.map((entry) => (
                        <div key={entry.name} className="change-row">
                          <span className="change-reg">%{entry.name}</span>
                          <span className="change-prev">{formatRegisterValue(entry.prev)}</span>
                          <span className="change-arrow">→</span>
                          <span className="change-next">{formatRegisterValue(entry.value)}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="empty-note">
                      {cycleIdx === 0 ? 'Diffs begin at cycle 2 because cycle 1 has no prior state.' : 'No register value changes detected in this cycle.'}
                    </div>
                  )}
                </div>

                <details className="insight-advanced">
                  <summary className="insight-advanced-summary">Advanced Details</summary>
                  <div className="insight-advanced-body">
                    <div className="insight-block">
                      <div className="insight-heading">Raw Control Bits</div>
                      <div className="control-grid">
                        {controlRows.map(([label, value]) => (
                          <div key={label} className={`control-cell${value === true ? ' control-cell-active' : ''}`}>
                            <span className="control-cell-label">{label}</span>
                            <span className="control-cell-value">{formatBool(value)}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="insight-block">
                      <div className="insight-heading">Metadata</div>
                      <div className="meta-list">
                        <div className="meta-row">
                          <span>Fetch `f_predPC`</span>
                          <code>{formatAddressValue(meta?.predPC ?? 'x')}</code>
                        </div>
                        <div className="meta-row">
                          <span>F reg `F_predPC`</span>
                          <code>{formatAddressValue(meta?.fetchRegPredPC ?? 'x')}</code>
                        </div>
                        <div className="meta-row">
                          <span>Memory `m_stat`</span>
                          <code>{meta?.memory_stat?.name ?? 'x'} ({formatSmallValue(meta?.memory_stat?.hex ?? 'x')})</code>
                        </div>
                      </div>
                    </div>

                    <div className="insight-block">
                      <div className="insight-heading">Stage Details</div>
                      <table className="stage-detail-table">
                        <thead>
                          <tr>
                            <th>Stage</th>
                            <th>Instruction</th>
                            <th>PC</th>
                            <th>ifun</th>
                            <th>stat</th>
                            <th>Δ</th>
                          </tr>
                        </thead>
                        <tbody>
                          {stageDetails.map((stage) => {
                            const icodeDisplay = formatOpcodeValue(stage.icode, numberFormat);
                            const changed = previousCycle && stage.previousIcodeName !== stage.icodeName;
                            return (
                              <tr key={stage.key} className={changed ? 'stage-row-changed' : ''}>
                                <td className="stage-col-label">{stage.label}</td>
                                <td>
                                  <span className="stage-detail-icode">{stage.icodeName}</span>
                                  <span className="stage-detail-hex"> {icodeDisplay}</span>
                                </td>
                                <td className="mono-cell">{formatAddressValue(stage.pcHex)}</td>
                                <td className="mono-cell">{formatSmallValue(stage.ifunHex)}</td>
                                <td className="mono-cell">{stage.statName}</td>
                                <td className="stage-col-delta">
                                  {previousCycle
                                    ? (changed ? `← ${stage.previousIcodeName ?? 'x'}` : '—')
                                    : '—'}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </details>
              </section>

              <RegisterFile
                registers={currentCycle.registers}
                changedRegisters={new Set(changedRegisters.map((entry) => entry.name))}
                numberFormat={numberFormat}
              />
            </div>
          ) : (
            <section className="section empty-state" id="cycle-summary">
              <h2 className="section-title">Getting Started</h2>
              <p>Click <strong>Load Simulation</strong> in the left sidebar to fetch parsed pipeline cycles from the backend.</p>
              <p>Then use the slider or play controls to move through execution. The page is organized from summary to details, so you can learn it step by step.</p>
              <p>Keep <strong>Decimal</strong> selected for easier reading, then switch to <strong>Hex</strong> when matching values with traces or RTL outputs.</p>
            </section>
          )}
        </div>
      </main>
    </div>
  );
}
