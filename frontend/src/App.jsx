import { useCallback, useMemo, useState } from 'react';
import AppHeader from './components/AppHeader.jsx';
import Transport from './components/Transport.jsx';
import { TabPanel } from './components/common/TabBar.jsx';
import ProgramView from './components/program/ProgramView.jsx';
import StepView from './components/step/StepView.jsx';
import TimelineView from './components/timeline/TimelineView.jsx';
import PerformanceView from './components/performance/PerformanceView.jsx';
import LearnView from './components/learn/LearnView.jsx';
import { useSimulation } from './hooks/useSimulation.js';
import { usePlayback } from './hooks/usePlayback.js';
import { useTheme } from './hooks/useTheme.js';
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts.js';
import { readStored, writeStored } from './hooks/storage.js';
import { findHazard, hazardTimeline } from './utils/hazards.js';

const DEFAULT_NAV_KINDS = new Set(['loadUse', 'mispredict', 'ret', 'exception']);

function statusOf(sim, modeData) {
  if (sim.status === 'running') return { label: 'Running…', tone: 'busy' };
  if (sim.status === 'error') return { label: 'Error', tone: 'error' };
  if (!modeData) return { label: 'Idle', tone: 'idle' };
  if (modeData.timedOut) return { label: 'Cycle limit', tone: 'warn' };
  const stat = modeData.status.statName;
  return { label: stat === 'HLT' ? 'Halted OK' : `Stopped: ${stat}`, tone: stat === 'HLT' ? 'ok' : 'warn' };
}

function NeedsRun({ status }) {
  return (
    <div className="empty-state">
      <h2>Nothing to show yet</h2>
      <p>{status === 'running' ? 'Running the simulation…' : 'Assemble and run a program on the Program tab first.'}</p>
    </div>
  );
}

export default function App() {
  const sim = useSimulation();
  const { theme, toggle: toggleTheme } = useTheme();
  const [mode, setMode] = useState('pipelined');
  const [tab, setTab] = useState('program');
  const [numberFormat, setNumberFormatState] = useState(() => (readStored('y86-format') === 'hex' ? 'hex' : 'dec'));
  const [navKinds, setNavKinds] = useState(DEFAULT_NAV_KINDS);

  const { result } = sim;
  const modeData = result?.modes[mode] ?? null;
  const playback = usePlayback(modeData?.cycles.length ?? 0);
  const pipelined = mode === 'pipelined';
  const allTicks = useMemo(
    () => (result && pipelined ? hazardTimeline(result.modes.pipelined.cycles) : []),
    [result, pipelined],
  );
  // The event chips filter both the [ / ] jumps and the slider ticks.
  const ticks = useMemo(() => allTicks.filter((t) => t.kinds.some((k) => navKinds.has(k))), [allTicks, navKinds]);

  // A new run starts from cycle 1 (adjusting state during render, not in an effect).
  const [seenResult, setSeenResult] = useState(result);
  if (result !== seenResult) {
    setSeenResult(result);
    playback.reset();
  }

  const setNumberFormat = (f) => {
    setNumberFormatState(f);
    writeStored('y86-format', f);
  };

  const jumpHazard = useCallback((direction) => {
    if (!result || mode !== 'pipelined') return;
    const i = findHazard(result.modes.pipelined.cycles, playback.index, direction, navKinds);
    if (i >= 0) playback.seek(i);
  }, [result, mode, playback, navKinds]);

  const run = useCallback(() => sim.run(), [sim]);

  useKeyboardShortcuts({
    prev: () => playback.step(-1),
    next: () => playback.step(1),
    toggle: playback.toggle,
    first: () => playback.seek(0),
    last: () => playback.seek(playback.total - 1),
    prevHazard: () => jumpHazard(-1),
    nextHazard: () => jumpHazard(1),
    run,
  });

  const tabs = [
    { key: 'program', label: 'Program', badge: sim.diagnostics.length || null },
    { key: 'step', label: 'Step' },
    { key: 'timeline', label: 'Timeline' },
    { key: 'performance', label: 'Performance' },
    { key: 'learn', label: 'Learn' },
  ];
  const hasData = Boolean(modeData?.cycles.length);
  const view = { result, cycleIndex: playback.index, numberFormat };
  const showTransport = hasData && (tab === 'step' || tab === 'timeline');
  const nav = pipelined ? {
    navKinds,
    onNavKindsChange: setNavKinds,
    onPrev: () => jumpHazard(-1),
    onNext: () => jumpHazard(1),
  } : null;

  return (
    <div className="app">
      <a className="skip-link" href="#main">Skip to content</a>
      <AppHeader
        tabs={tabs}
        tab={tab}
        onTabChange={setTab}
        mode={mode}
        onModeChange={setMode}
        numberFormat={numberFormat}
        onNumberFormatChange={setNumberFormat}
        theme={theme}
        onThemeToggle={toggleTheme}
        status={statusOf(sim, modeData)}
      />
      {showTransport && <Transport playback={playback} ticks={ticks} nav={nav} />}

      <main id="main" className="app-main">
        {sim.status === 'error' && sim.error && (
          <div className="banner banner-error" role="alert">
            <span>{sim.error}</span>
            {sim.diagnostics.length === 0 && (
              <button type="button" className="btn btn-sm" onClick={sim.retry}>Retry</button>
            )}
          </div>
        )}

        <TabPanel idPrefix="view" tabKey={tab} className="view">
          {tab === 'program' && <ProgramView sim={sim} onRun={run} onOpenPipeline={() => setTab('step')} />}
          {tab === 'learn' && <LearnView />}
          {tab !== 'program' && tab !== 'learn' && !hasData && <NeedsRun status={sim.status} />}
          {hasData && tab === 'step' && (
            <StepView {...view} mode={mode} onSeek={playback.seek} />
          )}
          {hasData && tab === 'timeline' && <TimelineView {...view} mode={mode} onSeek={playback.seek} />}
          {hasData && tab === 'performance' && <PerformanceView result={result} />}
        </TabPanel>
      </main>

      <footer className="app-footer">
        <span>Y86-64 from <em>Computer Systems: A Programmer&apos;s Perspective</em> (Bryant &amp; O&apos;Hallaron).</span>
        <span>Simulated with Icarus Verilog · keyboard shortcuts are listed on the Learn tab</span>
      </footer>
    </div>
  );
}
