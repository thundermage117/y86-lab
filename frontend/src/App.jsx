import { useState, useEffect, useRef, useCallback } from 'react';
import PipelineDiagram from './components/PipelineDiagram';
import RegisterFile from './components/RegisterFile';
import './App.css';

const API_URL = 'http://localhost:3001/api/simulate';
const PLAY_INTERVAL_MS = 200;

export default function App() {
  const [cycles, setCycles] = useState([]);
  const [cycleIdx, setCycleIdx] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [playing, setPlaying] = useState(false);
  const playTimer = useRef(null);

  const currentCycle = cycles[cycleIdx] ?? null;
  const total = cycles.length;

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

  const prev = () => setCycleIdx(i => Math.max(0, i - 1));
  const next = () => setCycleIdx(i => Math.min(total - 1, i + 1));
  const togglePlay = () => setPlaying(p => !p);

  return (
    <div className="app">
      <header className="app-header">
        <h1>Y86-64 Pipeline Visualizer</h1>
        <p className="subtitle">Cycle-by-cycle view of the 5-stage pipelined processor</p>
      </header>

      <main className="app-main">
        {/* Controls */}
        <div className="controls-bar">
          <button
            className="btn btn-primary"
            onClick={loadSimulation}
            disabled={loading}
          >
            {loading ? 'Loading\u2026' : total > 0 ? 'Reload Simulation' : 'Load Simulation'}
          </button>

          {total > 0 && (
            <>
              <div className="playback-controls">
                <button className="btn btn-icon" onClick={prev} disabled={cycleIdx === 0} title="Previous">&#9664;</button>
                <button className="btn btn-icon" onClick={togglePlay} title={playing ? 'Pause' : 'Play'}>
                  {playing ? '\u23F8' : '\u25B6'}
                </button>
                <button className="btn btn-icon" onClick={next} disabled={cycleIdx >= total - 1} title="Next">&#9654;</button>
              </div>

              <div className="cycle-display">
                Cycle <strong>{cycleIdx + 1}</strong> / {total}
              </div>

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
              />
            </>
          )}
        </div>

        {error && <div className="error-banner">Error: {error}</div>}

        {/* Pipeline diagram */}
        <section className="section">
          <h2 className="section-title">Pipeline Stages</h2>
          <PipelineDiagram cycleData={currentCycle} />
        </section>

        {/* Register file */}
        {currentCycle && (
          <RegisterFile registers={currentCycle.registers} />
        )}
      </main>
    </div>
  );
}
