import { useMemo, useState } from 'react';

const DEFAULT_STAGE_DELAYS = {
  fetch: 300,
  decode: 200,
  execute: 250,
  memory: 300,
  writeback: 100,
  pipelineRegOverhead: 20,
};

function formatPercentPrecise(value) {
  if (!Number.isFinite(value)) return '--';
  return `${value.toFixed(1)}%`;
}

function formatCpi(value) {
  if (!Number.isFinite(value)) return '--';
  return value.toFixed(2);
}

function formatIpc(value) {
  if (!Number.isFinite(value)) return '--';
  return value.toFixed(3);
}

function formatCycleTimeTicks(ticks) {
  if (!Number.isFinite(ticks)) return '--';
  return `${ticks} ticks`;
}

function formatDelayUnits(value) {
  if (!Number.isFinite(value)) return '--';
  return `${value.toFixed(value >= 100 ? 0 : 2)} u`;
}

function formatExecTimeUnits(value) {
  if (!Number.isFinite(value)) return '--';
  return `${value.toFixed(value >= 1000 ? 0 : 2)} u`;
}

function formatSpeedup(value) {
  if (!Number.isFinite(value)) return '--';
  return `${value.toFixed(2)}x`;
}

function clampNonNegativeNumber(value, fallback) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) return fallback;
  return parsed;
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

export default function PerformanceMetricsPanel({
  totalCycles,
  metrics,
  comparisonMetrics,
  selectedMode = 'pipelined',
}) {
  const focusedKey = selectedMode === 'sequential' ? 'sequential' : 'pipelined';
  const [stageDelays, setStageDelays] = useState(DEFAULT_STAGE_DELAYS);

  const hardwareTimingModel = useMemo(() => {
    const fetch = clampNonNegativeNumber(stageDelays.fetch, DEFAULT_STAGE_DELAYS.fetch);
    const decode = clampNonNegativeNumber(stageDelays.decode, DEFAULT_STAGE_DELAYS.decode);
    const execute = clampNonNegativeNumber(stageDelays.execute, DEFAULT_STAGE_DELAYS.execute);
    const memory = clampNonNegativeNumber(stageDelays.memory, DEFAULT_STAGE_DELAYS.memory);
    const writeback = clampNonNegativeNumber(stageDelays.writeback, DEFAULT_STAGE_DELAYS.writeback);
    const pipelineRegOverhead = clampNonNegativeNumber(stageDelays.pipelineRegOverhead, DEFAULT_STAGE_DELAYS.pipelineRegOverhead);
    const stageMax = Math.max(fetch, decode, execute, memory, writeback);

    return {
      fetch,
      decode,
      execute,
      memory,
      writeback,
      pipelineRegOverhead,
      sequentialCycleTime: fetch + decode + execute + memory + writeback,
      pipelinedCycleTime: stageMax + pipelineRegOverhead,
    };
  }, [stageDelays]);

  const enrichedComparisonMetrics = useMemo(() => {
    if (!comparisonMetrics) return null;

    const attachDerived = (summary, modeKey) => {
      if (!summary) return null;
      const hardwareCycleTime = modeKey === 'sequential'
        ? hardwareTimingModel.sequentialCycleTime
        : hardwareTimingModel.pipelinedCycleTime;
      const estimatedExecutionTime = Number.isFinite(summary.cyclesTaken)
        ? summary.cyclesTaken * hardwareCycleTime
        : null;
      const estimatedThroughputPerUnit = Number.isFinite(summary.retiredInstructions) && Number.isFinite(estimatedExecutionTime) && estimatedExecutionTime > 0
        ? (summary.retiredInstructions / estimatedExecutionTime)
        : null;

      return {
        ...summary,
        simClockTicks: summary.cycleTimeTicks ?? null,
        hardwareCycleTime,
        estimatedExecutionTime,
        estimatedThroughputPerUnit,
      };
    };

    return {
      pipelined: attachDerived(comparisonMetrics.pipelined, 'pipelined'),
      sequential: attachDerived(comparisonMetrics.sequential, 'sequential'),
    };
  }, [comparisonMetrics, hardwareTimingModel]);

  const estimatedSpeedup = useMemo(() => {
    const seqTime = enrichedComparisonMetrics?.sequential?.estimatedExecutionTime;
    const pipeTime = enrichedComparisonMetrics?.pipelined?.estimatedExecutionTime;
    if (!Number.isFinite(seqTime) || !Number.isFinite(pipeTime) || pipeTime <= 0) return null;
    return seqTime / pipeTime;
  }, [enrichedComparisonMetrics]);

  const selectedHardwareCycleTime = focusedKey === 'sequential'
    ? hardwareTimingModel.sequentialCycleTime
    : hardwareTimingModel.pipelinedCycleTime;
  const selectedEstimatedExecTime = (() => {
    if (!Number.isFinite(selectedHardwareCycleTime) || !Number.isFinite(totalCycles)) return null;
    return totalCycles * selectedHardwareCycleTime;
  })();

  return (
    <section className="register-file performance-panel" id="performance-metrics">
      <div className="performance-panel-header-row">
        <h2 className="section-title">Performance Metrics</h2>
      </div>

      <details className="performance-advanced">
        <summary className="performance-advanced-summary">
          <span>Hardware Timing Model (Estimated)</span>
          <span className="performance-advanced-summary-meta">
            <code>Seq {formatDelayUnits(hardwareTimingModel.sequentialCycleTime)}</code>
            <code>Pipe {formatDelayUnits(hardwareTimingModel.pipelinedCycleTime)}</code>
          </span>
        </summary>
        <div className="performance-timing-model" aria-label="Estimated hardware timing model">
          <div className="performance-timing-model-head">
            <strong>Adjust Stage Delays</strong>
            <button
              type="button"
              className="btn btn-icon performance-timing-reset"
              onClick={() => setStageDelays(DEFAULT_STAGE_DELAYS)}
              title="Reset stage delays"
            >
              Reset
            </button>
          </div>
          <div className="performance-timing-model-copy">
            Sequential cycle = sum of stage delays. Pipelined cycle = max stage delay + pipeline register overhead. Units are arbitrary (for example, ps).
          </div>
          <div className="performance-timing-grid">
            {[
              ['fetch', 'F'],
              ['decode', 'D'],
              ['execute', 'E'],
              ['memory', 'M'],
              ['writeback', 'W'],
              ['pipelineRegOverhead', 'Reg OH'],
            ].map(([key, label]) => (
              <label key={key} className="performance-timing-field">
                <span>{label}</span>
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={stageDelays[key]}
                  onChange={(e) => {
                    const next = e.target.value;
                    setStageDelays((prev) => ({
                      ...prev,
                      [key]: next === '' ? '' : clampNonNegativeNumber(next, prev[key]),
                    }));
                  }}
                />
              </label>
            ))}
          </div>
        </div>
      </details>

      {enrichedComparisonMetrics && (
        <>
          <div className="performance-compare-grid" aria-label="Sequential vs pipelined comparison">
            {['pipelined', 'sequential'].map((key) => {
              const summary = enrichedComparisonMetrics[key];
              if (!summary) return null;
              return (
                <button
                  key={key}
                  type="button"
                  className={`performance-compare-card${focusedKey === key ? ' is-active' : ''}`}
                  aria-pressed={focusedKey === key}
                  disabled
                >
                  <div className="performance-compare-card-head">
                    <span className="performance-compare-card-title">{summary.label}</span>
                    <span className="performance-compare-card-subtitle">{summary.subtitle}</span>
                  </div>
                  <div className="performance-compare-card-metrics">
                    <div className="performance-compare-stat">
                      <span>Cycles</span>
                      <strong>{summary.cyclesTaken}</strong>
                    </div>
                    <div className="performance-compare-stat">
                      <span>Bubbles</span>
                      <strong>{summary.bubblesInserted}</strong>
                    </div>
                    <div className="performance-compare-stat">
                      <span>CPI</span>
                      <strong>{formatCpi(summary.cpi)}</strong>
                    </div>
                    <div className="performance-compare-stat">
                      <span>IPC</span>
                      <strong>{formatIpc(summary.throughputIpc)}</strong>
                    </div>
                    <div className="performance-compare-stat">
                      <span>Sim clock (VCD)</span>
                      <strong title={summary.cycleTimescale ? `VCD timescale: ${summary.cycleTimescale}` : undefined}>
                        {formatCycleTimeTicks(summary.simClockTicks)}
                      </strong>
                    </div>
                    <div className="performance-compare-stat">
                      <span>HW cycle (est)</span>
                      <strong>{formatDelayUnits(summary.hardwareCycleTime)}</strong>
                    </div>
                    <div className="performance-compare-stat">
                      <span>Exec time (est)</span>
                      <strong>{formatExecTimeUnits(summary.estimatedExecutionTime)}</strong>
                    </div>
                    <div className="performance-compare-stat">
                      <span>Throughput (est)</span>
                      <strong>{Number.isFinite(summary.estimatedThroughputPerUnit) ? `${summary.estimatedThroughputPerUnit.toFixed(4)} instr/u` : '--'}</strong>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>

          <div className="performance-compare-note">
            The highlighted card matches the current page mode. Estimated speedup (Seq/Pipe) with the timing model above: <strong>{formatSpeedup(estimatedSpeedup)}</strong>.
          </div>
        </>
      )}

      <div className="sidebar-metric-list performance-panel-body">
        <div className="sidebar-metric">
          <MetricTooltip
            label="Total CPI"
            description="Total CPI = total captured cycles / retired instructions. Retired instructions are counted from non-NOP instructions observed in the writeback stage."
          />
          <strong>{formatCpi(totalCycles && metrics.retiredInstructions ? (totalCycles / metrics.retiredInstructions) : Number.NaN)}</strong>
        </div>
        <div className="sidebar-metric">
          <MetricTooltip
            label="Bubble insertions"
            description="Counts asserted pipeline bubble controls across stages (D/E/M/W) over the captured execution."
          />
          <strong>{metrics.bubbleInsertions ?? 0}</strong>
        </div>
        <div className="sidebar-metric">
          <MetricTooltip
            label="Throughput (IPC)"
            description="Normalized throughput = retired instructions / total captured cycles. This is instructions completed per cycle, not instructions per second."
          />
          <strong>{formatIpc(totalCycles && metrics.retiredInstructions ? (metrics.retiredInstructions / totalCycles) : Number.NaN)}</strong>
        </div>
        <div className="sidebar-metric">
          <MetricTooltip
            label="Hardware cycle (est)"
            description="Estimated hardware clock period from the timing model above. Sequential uses sum(stage delays); pipelined uses max(stage delays) + pipeline register overhead."
          />
          <strong>{formatDelayUnits(selectedHardwareCycleTime)}</strong>
        </div>
        <div className="sidebar-metric">
          <MetricTooltip
            label="Execution time (est)"
            description="Estimated total time = captured cycles × estimated hardware cycle time. Uses the timing model above."
          />
          <strong>{formatExecTimeUnits(selectedEstimatedExecTime)}</strong>
        </div>
        <div className="sidebar-metric">
          <MetricTooltip
            label="Sim Clock (VCD)"
            description="Clock period inferred from VCD timestamps (simulation clock only). This is not a real hardware timing result."
          />
          <strong>{formatCycleTimeTicks(
            focusedKey === 'sequential'
              ? enrichedComparisonMetrics?.sequential?.simClockTicks
              : enrichedComparisonMetrics?.pipelined?.simClockTicks,
          )}</strong>
        </div>
        <div className="sidebar-metric">
          <MetricTooltip
            label="Branch mispredict penalty"
            description="Estimated penalty % = (2 penalty cycles per mispredicted JXX branch / total captured cycles) × 100. A misprediction is counted when execute has JXX and e_Cnd = 0."
          />
          <strong>{formatPercentPrecise(metrics.branchPenaltyPercent)}</strong>
        </div>
        <div className="sidebar-metric">
          <MetricTooltip
            label="Data hazard stall cycles"
            description="Counts cycles matching the data-hazard stall pattern: F_stall=1, D_stall=1, and E_bubble=1, excluding branch-mispredict cycles."
          />
          <strong>{metrics.dataHazardStallCycles}</strong>
        </div>
        <div className="sidebar-metric">
          <MetricTooltip
            label="Retired instructions"
            description="Number of non-NOP instructions observed in the writeback stage across all captured cycles."
          />
          <strong>{metrics.retiredInstructions}</strong>
        </div>
      </div>
    </section>
  );
}
