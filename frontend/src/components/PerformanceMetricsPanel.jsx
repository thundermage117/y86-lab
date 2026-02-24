function formatPercentPrecise(value) {
  if (!Number.isFinite(value)) return '--';
  return `${value.toFixed(1)}%`;
}

function formatCpi(totalCycles, retiredInstructions) {
  if (!retiredInstructions) return '--';
  return (totalCycles / retiredInstructions).toFixed(2);
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

export default function PerformanceMetricsPanel({ totalCycles, metrics }) {
  return (
    <section className="register-file performance-panel" id="performance-metrics">
      <h2 className="section-title">Performance Metrics</h2>
      <div className="sidebar-metric-list performance-panel-body">
        <div className="sidebar-metric">
          <MetricTooltip
            label="Total CPI"
            description="Total CPI = total captured cycles / retired instructions. Retired instructions are counted from non-NOP instructions observed in the writeback stage."
          />
          <strong>{formatCpi(totalCycles, metrics.retiredInstructions)}</strong>
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

