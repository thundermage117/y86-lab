import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import PipelineDiagram from './components/PipelineDiagram';
import PipelineTimeline from './components/PipelineTimeline';
import RegisterFile from './components/RegisterFile';
import InstructionMemoryViewer from './components/InstructionMemoryViewer';
import DataMemoryViewer from './components/DataMemoryViewer';
import SequentialExecutionPanel from './components/SequentialExecutionPanel';
import SequentialCycleInsights from './components/SequentialCycleInsights';
import AppHeaderControls from './components/AppHeaderControls';
import PerformanceMetricsPanel from './components/PerformanceMetricsPanel';
import { formatNumericString, formatOpcodeValue } from './utils/numberFormat';
import './App.css';

const API_URL = 'http://localhost:3001/api/simulate';
const PLAY_INTERVAL_MS = 200;
const ZERO_REG = '0x0000000000000000';
const STAGE_KEYS = ['fetch', 'decode', 'execute', 'memory', 'writeback'];
const THEME_STORAGE_KEY = 'y86-pipeline-theme';
const COMPARISON_FOCUS_PIPELINED = 'pipelined';
const COMPARISON_FOCUS_SEQUENTIAL = 'sequential';
const PAGE_VIEW_EXECUTION = 'execution';
const PAGE_VIEW_INSIGHTS = 'insights';
const PAGE_VIEW_MEMORY = 'memory';
const PAGE_VIEW_PERFORMANCE = 'performance';
const PIPELINE_VIEW_DIAGRAM = 'diagram';
const PIPELINE_VIEW_TIMELINE = 'timeline';
const MEMORY_VIEW_INSTRUCTION = 'instruction';
const MEMORY_VIEW_DATA = 'data';

function emptySimulationMode(mode) {
  return {
    mode,
    cycles: [],
    total: 0,
    instructionMemory: null,
    dataMemory: null,
    clock: null,
  };
}

function normalizeSimulationModePayload(mode, payload) {
  if (!payload || !Array.isArray(payload.cycles)) {
    return emptySimulationMode(mode);
  }

  return {
    mode,
    cycles: payload.cycles,
    total: typeof payload.total === 'number' ? payload.total : payload.cycles.length,
    instructionMemory: payload.instructionMemory ?? null,
    dataMemory: payload.dataMemory ?? null,
    clock: payload.clock ?? null,
  };
}

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
      bubbleInsertions: 0,
      branchPenaltyCycles: 0,
      branchPenaltyPercent: 0,
    };
  }

  let retiredInstructions = 0;
  let mispredictions = 0;
  let dataHazardStallCycles = 0;
  let bubbleInsertions = 0;

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
    bubbleInsertions += Number(Boolean(control?.D_bubble));
    bubbleInsertions += Number(Boolean(control?.E_bubble));
    bubbleInsertions += Number(Boolean(control?.M_bubble));
    bubbleInsertions += Number(Boolean(control?.W_bubble));

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
    bubbleInsertions,
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
  const [simulationModes, setSimulationModes] = useState(() => ({
    pipelined: emptySimulationMode(COMPARISON_FOCUS_PIPELINED),
    sequential: emptySimulationMode(COMPARISON_FOCUS_SEQUENTIAL),
  }));
  const [executionMode, setExecutionMode] = useState(COMPARISON_FOCUS_PIPELINED);
  const [cycleIdx, setCycleIdx] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [playing, setPlaying] = useState(false);
  const [numberFormat, setNumberFormat] = useState('dec');
  const [theme, setTheme] = useState(getInitialTheme);
  const [pageView, setPageView] = useState(PAGE_VIEW_EXECUTION);
  const [pipelineView, setPipelineView] = useState(PIPELINE_VIEW_DIAGRAM);
  const [memoryView, setMemoryView] = useState(MEMORY_VIEW_INSTRUCTION);
  const playTimer = useRef(null);

  const activeSimulation = simulationModes[executionMode] ?? emptySimulationMode(executionMode);
  const cycles = activeSimulation.cycles ?? [];
  const instructionMemory = activeSimulation.instructionMemory ?? null;
  const dataMemory = activeSimulation.dataMemory ?? null;
  const currentCycle = cycles[cycleIdx] ?? null;
  const previousCycle = cycleIdx > 0 ? cycles[cycleIdx - 1] ?? null : null;
  const total = cycles.length;
  const hasData = total > 0;
  const hasAnyData = Object.values(simulationModes).some((entry) => (entry?.cycles?.length ?? 0) > 0);
  const control = currentCycle?.control ?? null;
  const flags = currentCycle?.flags ?? null;
  const meta = currentCycle?.meta ?? null;
  const pipelineMetrics = useMemo(
    () => computePerformanceMetrics(simulationModes.pipelined?.cycles ?? []),
    [simulationModes],
  );
  const sequentialMetrics = useMemo(
    () => computePerformanceMetrics(simulationModes.sequential?.cycles ?? []),
    [simulationModes],
  );
  const performanceMetrics = executionMode === COMPARISON_FOCUS_SEQUENTIAL ? sequentialMetrics : pipelineMetrics;
  const comparisonMetrics = useMemo(() => {
    const pipelinedCycles = simulationModes.pipelined?.cycles?.length ?? 0;
    const sequentialCycles = simulationModes.sequential?.cycles?.length ?? 0;
    const pipelinedRetired = pipelineMetrics.retiredInstructions;
    const sequentialRetired = sequentialMetrics.retiredInstructions;
    const pipelinedCpi = pipelinedRetired > 0 ? pipelinedCycles / pipelinedRetired : null;
    const sequentialCpi = sequentialRetired > 0 ? sequentialCycles / sequentialRetired : null;

    return {
      pipelined: {
        key: COMPARISON_FOCUS_PIPELINED,
        label: 'Pipelined CPU',
        subtitle: '5-stage trace',
        cyclesTaken: pipelinedCycles,
        bubblesInserted: pipelineMetrics.bubbleInsertions,
        cpi: pipelinedCpi,
        retiredInstructions: pipelinedRetired,
        throughputIpc: pipelinedRetired > 0 && pipelinedCycles > 0 ? (pipelinedRetired / pipelinedCycles) : null,
        cycleTimeTicks: simulationModes.pipelined?.clock?.periodTicks ?? null,
        cycleTimescale: simulationModes.pipelined?.clock?.timescaleRaw ?? null,
      },
      sequential: {
        key: COMPARISON_FOCUS_SEQUENTIAL,
        label: 'Sequential CPU',
        subtitle: 'Sequential trace',
        cyclesTaken: sequentialCycles,
        bubblesInserted: sequentialMetrics.bubbleInsertions,
        cpi: sequentialCpi,
        retiredInstructions: sequentialRetired,
        throughputIpc: sequentialRetired > 0 && sequentialCycles > 0 ? (sequentialRetired / sequentialCycles) : null,
        cycleTimeTicks: simulationModes.sequential?.clock?.periodTicks ?? null,
        cycleTimescale: simulationModes.sequential?.clock?.timescaleRaw ?? null,
      },
    };
  }, [simulationModes, pipelineMetrics, sequentialMetrics]);

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

  useEffect(() => {
    setCycleIdx((prevIdx) => {
      if (total <= 0) return 0;
      return Math.min(prevIdx, total - 1);
    });
    if (total <= 0) setPlaying(false);
  }, [executionMode, total]);

  const loadSimulation = useCallback(async () => {
    setLoading(true);
    setError(null);
    setPlaying(false);
    setCycleIdx(0);
    setPageView(PAGE_VIEW_EXECUTION);
    setPipelineView(PIPELINE_VIEW_DIAGRAM);
    setMemoryView(MEMORY_VIEW_INSTRUCTION);
    setSimulationModes({
      pipelined: emptySimulationMode(COMPARISON_FOCUS_PIPELINED),
      sequential: emptySimulationMode(COMPARISON_FOCUS_SEQUENTIAL),
    });
    try {
      const res = await fetch(API_URL);
      if (!res.ok) throw new Error(`Server error: ${res.status}`);
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      const pipelineMode = normalizeSimulationModePayload(
        COMPARISON_FOCUS_PIPELINED,
        data.modes?.pipelined ?? {
          cycles: data.cycles ?? [],
          total: data.total,
          instructionMemory: data.instructionMemory,
          dataMemory: data.dataMemory,
        },
      );
      const sequentialMode = normalizeSimulationModePayload(
        COMPARISON_FOCUS_SEQUENTIAL,
        data.modes?.sequential,
      );

      setSimulationModes({
        pipelined: pipelineMode,
        sequential: sequentialMode,
      });

      if ((executionMode === COMPARISON_FOCUS_SEQUENTIAL) && sequentialMode.cycles.length === 0 && pipelineMode.cycles.length > 0) {
        setExecutionMode(COMPARISON_FOCUS_PIPELINED);
      }
    } catch (err) {
      setError(err.message);
      setSimulationModes({
        pipelined: emptySimulationMode(COMPARISON_FOCUS_PIPELINED),
        sequential: emptySimulationMode(COMPARISON_FOCUS_SEQUENTIAL),
      });
    } finally {
      setLoading(false);
    }
  }, [executionMode]);

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
        <h1 className="app-brand-title">Y86-64 CPU Visualizer</h1>

        <AppHeaderControls
          loading={loading}
          hasData={hasData}
          hasAnyData={hasAnyData}
          cycleIdx={cycleIdx}
          total={total}
          playing={playing}
          numberFormat={numberFormat}
          theme={theme}
          error={error}
          executionMode={executionMode}
          runStateLabel={runStateLabel}
          onLoadSimulation={loadSimulation}
          onExecutionModeChange={(nextMode) => {
            setPlaying(false);
            setExecutionMode(nextMode);
          }}
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

        {currentCycle ? (
          <>
            <div className="page-view-tabs" role="tablist" aria-label="Main page sections">
              {[
                [PAGE_VIEW_EXECUTION, 'Execution'],
                [PAGE_VIEW_INSIGHTS, 'Insights'],
                [PAGE_VIEW_MEMORY, 'Memory'],
                [PAGE_VIEW_PERFORMANCE, 'Performance'],
              ].map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  role="tab"
                  aria-selected={pageView === key}
                  className={`page-view-tab${pageView === key ? ' is-active' : ''}`}
                  onClick={() => setPageView(key)}
                >
                  {label}
                </button>
              ))}
            </div>

            {pageView === PAGE_VIEW_EXECUTION && (
              <div className="pipeline-register-row">
                <section className="section" id="pipeline-stages">
                  <h2 className="section-title">
                    {executionMode === COMPARISON_FOCUS_SEQUENTIAL ? 'Sequential Execution' : 'Pipeline Stages'}
                  </h2>
                  {executionMode !== COMPARISON_FOCUS_SEQUENTIAL && (
                    <div className="section-tabbar" role="tablist" aria-label="Pipeline visualization">
                      {[
                        [PIPELINE_VIEW_DIAGRAM, 'Diagram'],
                        [PIPELINE_VIEW_TIMELINE, 'Timeline'],
                      ].map(([key, label]) => (
                        <button
                          key={key}
                          type="button"
                          role="tab"
                          aria-selected={pipelineView === key}
                          className={`section-tab${pipelineView === key ? ' is-active' : ''}`}
                          onClick={() => setPipelineView(key)}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                  )}

                  {executionMode === COMPARISON_FOCUS_SEQUENTIAL ? (
                    <SequentialExecutionPanel
                      currentCycle={currentCycle}
                      cycles={cycles}
                      cycleIdx={cycleIdx}
                      numberFormat={numberFormat}
                    />
                  ) : pipelineView === PIPELINE_VIEW_TIMELINE ? (
                    <PipelineTimeline cycles={cycles} currentCycleIndex={cycleIdx} />
                  ) : (
                    <PipelineDiagram cycleData={currentCycle} numberFormat={numberFormat} control={control} />
                  )}
                </section>

                <div className="register-sidebar-column">
                  <RegisterFile
                    registers={currentCycle?.registers ?? null}
                    changedRegisters={new Set(changedRegisters.map((entry) => entry.name))}
                    numberFormat={numberFormat}
                  />
                </div>
              </div>
            )}

            {pageView === PAGE_VIEW_INSIGHTS && (
              <section className="section cycle-details" id="cycle-insights">
                <h2 className="section-title">Cycle Insights</h2>
                {executionMode === COMPARISON_FOCUS_SEQUENTIAL ? (
                  <SequentialCycleInsights
                    currentCycle={currentCycle}
                    previousCycle={previousCycle}
                    cycleIdx={cycleIdx}
                    numberFormat={numberFormat}
                  />
                ) : (
                  <>
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
                  </>
                )}
              </section>
            )}

            {pageView === PAGE_VIEW_MEMORY && (
              <div className="tabbed-panel-stack">
                <div className="section-tabbar page-subtabbar" role="tablist" aria-label="Memory viewer">
                  {[
                    [MEMORY_VIEW_INSTRUCTION, 'Instruction Memory'],
                    [MEMORY_VIEW_DATA, 'Data Memory'],
                  ].map(([key, label]) => (
                    <button
                      key={key}
                      type="button"
                      role="tab"
                      aria-selected={memoryView === key}
                      className={`section-tab${memoryView === key ? ' is-active' : ''}`}
                      onClick={() => setMemoryView(key)}
                    >
                      {label}
                    </button>
                  ))}
                </div>

                {memoryView === MEMORY_VIEW_INSTRUCTION ? (
                  <InstructionMemoryViewer
                    instructionMemory={instructionMemory}
                    currentCycle={currentCycle}
                    numberFormat={numberFormat}
                  />
                ) : (
                  <DataMemoryViewer
                    dataMemory={dataMemory}
                    cycles={cycles}
                    cycleIdx={cycleIdx}
                    currentCycle={currentCycle}
                    numberFormat={numberFormat}
                  />
                )}
              </div>
            )}

            {pageView === PAGE_VIEW_PERFORMANCE && hasData && (
              <PerformanceMetricsPanel
                totalCycles={total}
                metrics={performanceMetrics}
                comparisonMetrics={comparisonMetrics}
                selectedMode={executionMode}
              />
            )}
          </>
        ) : (
          <section className="section empty-state" id="cycle-summary">
            <h2 className="section-title">Getting Started</h2>
            <p>Click <strong>Load Simulation</strong> in the toolbar above to fetch both pipeline and sequential traces from the backend.</p>
            <p>Use the <strong>Pipeline / Sequential</strong> switch at the top to choose which processor drives the page, then step cycle by cycle.</p>
            <p>Keep <strong>Dec</strong> selected for easier reading, then switch to <strong>Hex</strong> when matching values against hardware traces.</p>
          </section>
        )}

        <details className="section bottom-panel">
          <summary className="section-title bottom-panel-summary">How To Read This</summary>
          <div className="sidebar-copy bottom-panel-body">
            <p><strong>1.</strong> Use the top <em>Pipeline / Sequential</em> switch to choose the processor view.</p>
            <p><strong>2.</strong> Start with the main execution panel to inspect the selected mode's current cycle.</p>
            <p><strong>3.</strong> Check <em>Cycle Insights</em> for control/datapath signals and cycle-to-cycle changes.</p>
            <p><strong>4.</strong> Use <em>Register File</em> to see current register values (sequential mode depends on VCD dump visibility).</p>
            <p><strong>5.</strong> Use <em>Instruction Memory Viewer</em> to track which bytes are being fetched.</p>
            <p><strong>6.</strong> Use <em>Data Memory Hex Viewer</em> to inspect memory reads/writes and the reconstructed snapshot.</p>
            <p className="sidebar-note">Decimal is the default format for readability. Switch to Hex when comparing with hardware traces.</p>
            <p className="sidebar-note"><strong>Keyboard shortcuts:</strong> <kbd>Space</kbd> Play/Pause &nbsp; <kbd>←</kbd>/<kbd>→</kbd> Step &nbsp; <kbd>Home</kbd>/<kbd>End</kbd> Jump</p>
          </div>
        </details>
      </main>
    </div>
  );
}
