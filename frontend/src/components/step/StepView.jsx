import { useMemo, useState } from 'react';
import { STAT } from '@y86/isa.js';
import StageFlow from './StageFlow.jsx';
import SeqDatapath from './SeqDatapath.jsx';
import Inspector from './Inspector.jsx';
import { lineForUid, pendingWrites, stageMarkers, uidForLine } from './stepModel.js';
import Panel from '../common/Panel.jsx';
import HazardPanel from '../pipeline/HazardPanel.jsx';
import RunSummary from '../pipeline/RunSummary.jsx';
import Listing from '../program/Listing.jsx';
import TimelineGrid from '../timeline/TimelineGrid.jsx';
import { buildTimeline } from '../../utils/timeline.js';
import { explainPipelineCycle, explainSequentialCycle } from '../../utils/hazards.js';

const MINI_RADIUS = 8;

/**
 * The single "Step" workspace: everything about one cycle on one screen,
 * cross-linked by the instruction under the pointer.
 */
export default function StepView({ result, mode, cycleIndex, numberFormat, onSeek, nav }) {
  const modeData = result.modes[mode];
  const cycle = modeData.cycles[cycleIndex];
  const previous = cycleIndex > 0 ? modeData.cycles[cycleIndex - 1] : null;
  const pipelined = mode === 'pipelined';

  const [hoveredStages, setHoveredStages] = useState([]);
  const [focusUid, setFocusUid] = useState(null);
  const [showBytes, setShowBytes] = useState(false);

  const pipeCycles = result.modes.pipelined.cycles;
  const rows = useMemo(() => buildTimeline(pipeCycles), [pipeCycles]);
  const events = useMemo(
    () => (pipelined ? explainPipelineCycle(cycle, numberFormat) : explainSequentialCycle(cycle, numberFormat)),
    [cycle, numberFormat, pipelined],
  );
  const markers = useMemo(() => stageMarkers(cycle, mode), [cycle, mode]);
  const focusLine = lineForUid(cycle, mode, focusUid);

  const total = modeData.cycles.length;
  const miniStart = Math.max(0, Math.min(cycleIndex - MINI_RADIUS, total - (2 * MINI_RADIUS + 1)));
  const miniEnd = Math.min(total - 1, miniStart + 2 * MINI_RADIUS);
  const atEnd = cycleIndex === total - 1;
  const newCC = cycle.setCC && (pipelined || cycle.stat === STAT.AOK) ? cycle.newCC : null;

  return (
    <div className="step-layout">
      {pipelined ? (
        <>
          <StageFlow
            cycle={cycle}
            numberFormat={numberFormat}
            highlighted={hoveredStages}
            focusUid={focusUid}
            onFocusUid={setFocusUid}
          />
          <Panel id="mini-timeline" collapsible title="Around this cycle" className="mini-timeline-panel">
            <TimelineGrid
              cycles={pipeCycles}
              rows={rows}
              start={miniStart}
              end={miniEnd}
              cycleIndex={cycleIndex}
              onSeek={onSeek}
              compact
              focusUid={focusUid}
              onFocusUid={setFocusUid}
            />
          </Panel>
        </>
      ) : (
        <SeqDatapath c={cycle} numberFormat={numberFormat} />
      )}

      {atEnd && <RunSummary mode={mode} modeData={modeData} numberFormat={numberFormat} />}

      <div className="step-detail">
        <HazardPanel
          events={events}
          onHover={setHoveredStages}
          canNavigate={pipelined}
          title={pipelined ? 'What is happening this cycle' : 'This cycle'}
          {...(pipelined ? nav : {})}
        />
        <Panel
          id="source"
          collapsible
          title="Source"
          subtitle={pipelined ? 'Each instruction in flight is tagged with its stage.' : undefined}
          className="source-panel"
          actions={(
            <label className="check">
              <input type="checkbox" checked={showBytes} onChange={(e) => setShowBytes(e.target.checked)} />
              bytes
            </label>
          )}
        >
          <Listing
            listing={result.program.listing}
            markers={markers}
            showBytes={showBytes}
            follow
            focusLine={focusLine}
            onHoverLine={(line) => setFocusUid(line === null ? null : uidForLine(cycle, mode, line))}
          />
        </Panel>
        <Inspector
          result={result}
          mode={mode}
          cycleIndex={cycleIndex}
          numberFormat={numberFormat}
          previous={previous}
          pending={pendingWrites(cycle, mode)}
          newCC={newCC}
        />
      </div>
    </div>
  );
}
