import { cellTitle } from './pipelineTimelineModel';

function TimelineCell({ row, cell, cycleIndex, currentCycleIndex }) {
  if (!cell) {
    return (
      <td
        className={`timeline-cell timeline-cell-empty${cycleIndex === currentCycleIndex ? ' is-current' : ''}`}
        aria-label={`Cycle ${cycleIndex + 1}: empty`}
      />
    );
  }

  const classes = [
    'timeline-cell',
    `timeline-cell-${cell.stageKey}`,
    cell.stalled ? 'is-stall' : '',
    cell.bubbled ? 'is-bubble' : '',
    cycleIndex === currentCycleIndex ? 'is-current' : '',
  ].filter(Boolean).join(' ');

  return (
    <td className={classes} title={cellTitle(row, cell)}>
      <span className="timeline-cell-stage">{cell.stageLetter}</span>
      {cell.stalled && <span className="timeline-cell-tag">S</span>}
      {cell.bubbled && <span className="timeline-cell-tag timeline-cell-tag-bub">B</span>}
    </td>
  );
}

function TimelineRow({ row, visibleIndices, currentCycleIndex }) {
  return (
    <tr className={row.kind === 'bubble' ? 'timeline-row-bubble' : ''}>
      <th className="timeline-row-label timeline-sticky-col" title={row.label}>
        {row.kind === 'bubble' && (
          <span className="timeline-row-kind timeline-row-kind-bubble">
            BUB
          </span>
        )}
        <span className="timeline-row-text">{row.label}</span>
      </th>

      {visibleIndices.map((cycleIndex) => (
        <TimelineCell
          key={`${row.id}-${cycleIndex}`}
          row={row}
          cell={row.cells[cycleIndex] ?? null}
          cycleIndex={cycleIndex}
          currentCycleIndex={currentCycleIndex}
        />
      ))}
    </tr>
  );
}

export function PipelineTimelineTable({ visibleIndices, visibleRows, currentCycleIndex }) {
  return (
    <div className="pipeline-timeline-scroll">
      <table className="pipeline-timeline-table">
        <thead>
          <tr>
            <th className="timeline-col-label timeline-sticky-col">Instruction</th>
            {visibleIndices.map((index) => (
              <th
                key={`cycle-${index}`}
                className={`timeline-col-cycle${index === currentCycleIndex ? ' is-current' : ''}`}
                title={`Cycle ${index + 1}`}
              >
                C{index + 1}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {visibleRows.map((row) => (
            <TimelineRow
              key={row.id}
              row={row}
              visibleIndices={visibleIndices}
              currentCycleIndex={currentCycleIndex}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function PipelineTimelineLegend() {
  return (
    <div className="pipeline-timeline-legend" aria-label="Timeline legend">
      <span className="timeline-legend-title">Legend</span>
      <span className="timeline-legend-item"><span className="timeline-stage-demo timeline-stage-demo-fetch">F</span> Fetch</span>
      <span className="timeline-legend-item"><span className="timeline-stage-demo timeline-stage-demo-decode">D</span> Decode</span>
      <span className="timeline-legend-item"><span className="timeline-stage-demo timeline-stage-demo-execute">E</span> Execute</span>
      <span className="timeline-legend-item"><span className="timeline-stage-demo timeline-stage-demo-memory">M</span> Memory</span>
      <span className="timeline-legend-item"><span className="timeline-stage-demo timeline-stage-demo-writeback">W</span> Writeback</span>
      <span className="timeline-legend-item">S = stall · B = bubble</span>
    </div>
  );
}

