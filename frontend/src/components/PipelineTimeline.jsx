import { useMemo } from 'react';
import { buildTimeline } from './pipelineTimelineModel';
import { PipelineTimelineLegend, PipelineTimelineTable } from './PipelineTimelineTable';

const WINDOW_HALF = 5;

export default function PipelineTimeline({ cycles, currentCycleIndex = 0 }) {
  const { rows, bubbleCount, stallCellCount } = useMemo(() => buildTimeline(cycles), [cycles]);

  const visibleIndices = useMemo(() => {
    if (!Array.isArray(cycles) || cycles.length === 0) return [];
    const total = cycles.length;
    let start = Math.max(0, currentCycleIndex - WINDOW_HALF);
    let end = Math.min(total - 1, start + WINDOW_HALF * 2);
    start = Math.max(0, end - WINDOW_HALF * 2);
    const result = [];
    for (let i = start; i <= end; i++) result.push(i);
    return result;
  }, [cycles, currentCycleIndex]);

  const visibleRows = useMemo(() => {
    const indexSet = new Set(visibleIndices);
    return rows.filter((row) => row.cells.some((_, i) => indexSet.has(i) && row.cells[i]));
  }, [rows, visibleIndices]);

  if (!Array.isArray(cycles) || cycles.length === 0) {
    return (
      <div className="pipeline-timeline-empty">
        Load a simulation to view the classic staircase timeline.
      </div>
    );
  }

  return (
    <div className="pipeline-timeline-wrap" aria-label="Classic pipeline staircase timeline">
      <div className="pipeline-timeline-head">
        <div>
          <div className="pipeline-timeline-title">Classic Staircase</div>
          <div className="pipeline-timeline-subtitle">
            Showing ±{WINDOW_HALF} cycles around current · {visibleRows.length} active instructions
          </div>
        </div>
        <div className="pipeline-timeline-summary" aria-label="Timeline summary">
          <span>{cycles.length} cycles total</span>
          <span>{bubbleCount} bubbles</span>
          <span>{stallCellCount} stalled</span>
        </div>
      </div>

      <PipelineTimelineTable
        visibleIndices={visibleIndices}
        visibleRows={visibleRows}
        currentCycleIndex={currentCycleIndex}
      />

      <PipelineTimelineLegend />
    </div>
  );
}

