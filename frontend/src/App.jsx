import { useState, useEffect, useRef, useCallback } from 'react';
import PipelineDiagram from './components/PipelineDiagram';
import PipelineTimeline from './components/PipelineTimeline';
import RegisterFile from './components/RegisterFile';
import InstructionMemoryViewer from './components/InstructionMemoryViewer';
import DataMemoryViewer from './components/DataMemoryViewer';
import AppHeaderControls from './components/AppHeaderControls';
import PerformanceMetricsPanel from './components/PerformanceMetricsPanel';
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

function shortPcHex(pcHex) {
  if (!pcHex || pcHex === 'x') return 'x';
  if (pcHex.length <= 10) return pcHex;
  return `0x${pcHex.slice(-6)}`;
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

export default function App() {
  const [cycles, setCycles] = useState([]);
  const [cycleIdx, setCycleIdx] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [playing, setPlaying] = useState(false);
  const [numberFormat, setNumberFormat] = useState('dec');
  const [theme, setTheme] = useState(getInitialTheme);
  const [instructionMemory, setInstructionMemory] = useState(null);
  const [dataMemory, setDataMemory] = useState(null);
  const playTimer = useRef(null);

  const currentCycle = cycles[cycleIdx] ?? null;
  const previousCycle = cycleIdx > 0 ? cycles[cycleIdx - 1] ?? null : null;
  const total = cycles.length;
  const hasData = total > 0;
  const control = currentCycle?.control ?? null;
  const flags = currentCycle?.flags ?? null;
  const meta = currentCycle?.meta ?? null;
  const performanceMetrics = computePerformanceMetrics(cycles);

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
  const formatStagePcValue = (value) => (numberFormat === 'hex' ? shortPcHex(value) : formatAddressValue(value));

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
    setDataMemory(null);
    try {
      const res = await fetch(API_URL);
      if (!res.ok) throw new Error(`Server error: ${res.status}`);
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setCycles(data.cycles);
      setInstructionMemory(data.instructionMemory ?? null);
      setDataMemory(data.dataMemory ?? null);
    } catch (err) {
      setError(err.message);
      setInstructionMemory(null);
      setDataMemory(null);
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
        <h1 className="app-brand-title">Y86-64 Pipeline Visualizer</h1>

        <AppHeaderControls
          loading={loading}
          hasData={hasData}
          cycleIdx={cycleIdx}
          total={total}
          playing={playing}
          numberFormat={numberFormat}
          theme={theme}
          error={error}
          runStateLabel={runStateLabel}
          onLoadSimulation={loadSimulation}
          onPrev={prev}
          onNext={next}
          onTogglePlay={togglePlay}
          onCycleChange={(nextCycleIdx) => {
            setPlaying(false);
            setCycleIdx(nextCycleIdx);
          }}
          onNumberFormatChange={setNumberFormat}
          onThemeToggle={() => setTheme((prevTheme) => (prevTheme === 'dark' ? 'light' : 'dark'))}
        />
      </header>

      <main className="app-main">
        {error && <div className="error-banner">Error: {error}</div>}

        <div className="pipeline-register-row">
          <section className="section" id="pipeline-stages">
            <h2 className="section-title">Pipeline Stages</h2>
            <PipelineDiagram cycleData={currentCycle} numberFormat={numberFormat} control={control} />
            <PipelineTimeline cycles={cycles} currentCycleIndex={cycleIdx} />
          </section>

          <div className="register-sidebar-column">
            <RegisterFile
              registers={currentCycle?.registers ?? null}
              changedRegisters={new Set(changedRegisters.map((entry) => entry.name))}
              numberFormat={numberFormat}
            />

            {hasData && (
              <PerformanceMetricsPanel totalCycles={total} metrics={performanceMetrics} />
            )}
          </div>
        </div>

        {currentCycle ? (
          <div className="insights-memory-row">
            <section className="section cycle-details" id="cycle-insights">
              <h2 className="section-title">Cycle Insights</h2>

              <div className="insight-block">
                <div className="insight-heading">Control &amp; Flags</div>
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
                              <td className="mono-cell">{formatStagePcValue(stage.pcHex)}</td>
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

            <div className="memory-viewer-column">
              <InstructionMemoryViewer
                instructionMemory={instructionMemory}
                currentCycle={currentCycle}
                numberFormat={numberFormat}
              />
              <DataMemoryViewer
                dataMemory={dataMemory}
                cycles={cycles}
                cycleIdx={cycleIdx}
                currentCycle={currentCycle}
                numberFormat={numberFormat}
              />
            </div>
          </div>
        ) : (
          <section className="section empty-state" id="cycle-summary">
            <h2 className="section-title">Getting Started</h2>
            <p>Click <strong>Load Simulation</strong> in the toolbar above to fetch parsed pipeline cycles from the backend.</p>
            <p>Then use the slider or play controls to step through execution cycle by cycle.</p>
            <p>Keep <strong>Dec</strong> selected for easier reading, then switch to <strong>Hex</strong> when matching values against hardware traces.</p>
          </section>
        )}

        <details className="section bottom-panel">
          <summary className="section-title bottom-panel-summary">How To Read This</summary>
          <div className="sidebar-copy bottom-panel-body">
            <p><strong>1.</strong> Start with <em>Pipeline Stages</em> to see which instruction sits in each stage.</p>
            <p><strong>2.</strong> Check <em>Cycle Insights</em> for hazard signals, condition codes, and register changes.</p>
            <p><strong>3.</strong> Use <em>Register File</em> to see all current register values.</p>
            <p><strong>4.</strong> Use <em>Instruction Memory Viewer</em> to track which bytes are being fetched.</p>
            <p><strong>5.</strong> Use <em>Data Memory Hex Viewer</em> to inspect memory-stage reads/writes and the reconstructed data-memory snapshot.</p>
            <p className="sidebar-note">Decimal is the default format for readability. Switch to Hex when comparing with hardware traces.</p>
            <p className="sidebar-note"><strong>Keyboard shortcuts:</strong> <kbd>Space</kbd> Play/Pause &nbsp; <kbd>←</kbd>/<kbd>→</kbd> Step &nbsp; <kbd>Home</kbd>/<kbd>End</kbd> Jump</p>
          </div>
        </details>
      </main>
    </div>
  );
}
