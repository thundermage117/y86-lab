import { useMemo, useState } from 'react';
import Panel from '../common/Panel.jsx';
import Segmented from '../common/Segmented.jsx';
import TimelineGrid, { TimelineLegend } from './TimelineGrid.jsx';
import { buildTimeline } from '../../utils/timeline.js';

const WINDOWS = [
  { value: 16, label: '16' },
  { value: 32, label: '32' },
  { value: 64, label: '64' },
  { value: 0, label: 'All' },
];

export default function TimelineView({ result, cycleIndex, onSeek, mode }) {
  const [width, setWidth] = useState(32);
  const cycles = result.modes.pipelined.cycles;
  const rows = useMemo(() => buildTimeline(cycles), [cycles]);

  const total = cycles.length;
  const span = width === 0 ? total : Math.min(width, total);
  const start = width === 0 ? 0 : Math.max(0, Math.min(cycleIndex - Math.floor(span / 2), total - span));
  const end = start + span - 1;

  return (
    <Panel
      title="Pipeline timeline"
      subtitle="Each row is one fetched instruction; each column a clock cycle. Repeated letters are stalls, struck-through rows were squashed. Click any cell to jump there."
      className="timeline-panel"
      actions={<Segmented label="Cycles shown" size="sm" value={width} onChange={setWidth} options={WINDOWS} />}
    >
      {mode === 'sequential' && (
        <p className="hint">
          This chart shows the pipelined CPU. The sequential CPU would be a single diagonal: one instruction
          per (much longer) cycle, {result.modes.sequential.total} cycles in total.
        </p>
      )}
      <TimelineGrid
        cycles={cycles}
        rows={rows}
        start={start}
        end={end}
        cycleIndex={cycleIndex}
        onSeek={onSeek}
      />
      <TimelineLegend />
    </Panel>
  );
}
