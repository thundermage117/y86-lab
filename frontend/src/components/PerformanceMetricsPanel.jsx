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

  return (
    <section className="register-file performance-panel" id="performance-metrics">
      <div className="performance-panel-header-row">
        <h2 className="section-title">Performance Metrics</h2>
      </div>

      {comparisonMetrics && (
        <>
          <div className="performance-compare-grid" aria-label="Sequential vs pipelined comparison">
            {['pipelined', 'sequential'].map((key) => {
              const summary = comparisonMetrics[key];
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
                      <span>Cycle time</span>
                      <strong title={summary.cycleTimescale ? `VCD timescale: ${summary.cycleTimescale}` : undefined}>
                        {formatCycleTimeTicks(summary.cycleTimeTicks)}
                      </strong>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>

          <div className="performance-compare-note">
            The highlighted card matches the current page mode. Both CPU summaries stay visible here for direct comparison.
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
