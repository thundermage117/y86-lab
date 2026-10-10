import { useMemo, useRef, useState } from 'react';
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
import { useElementWidth } from '../../hooks/useElementWidth.js';
import { explainPipelineCycle, explainSequentialCycle } from '../../utils/hazards.js';

// Mini-timeline geometry; keep in step with .tl-scroller.is-compact in components.css.
const MINI_LABEL = 140;
const MINI_CELL = 28;

/** Cycles shown either side of the current one: as many as fit the panel. */
function miniRadius(width) {
  if (!width) return 8;
  const columns = Math.floor((width - MINI_LABEL) / MINI_CELL) - 1;
  return Math.max(4, Math.floor((columns - 1) / 2));
}

/**
 * The single "Step" workspace: everything about one cycle on one screen,
 * cross-linked by the instruction under the pointer.
 */
export default function StepView({ result, mode, cycleIndex, numberFormat, onSeek }) {
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
  const miniBox = useRef(null);
  const radius = miniRadius(useElementWidth(miniBox));
  const focusLine = lineForUid(cycle, mode, focusUid);

  const total = modeData.cycles.length;
  const miniStart = Math.max(0, Math.min(cycleIndex - radius, total - (2 * radius + 1)));
  const miniEnd = Math.min(total - 1, miniStart + 2 * radius);
  const atEnd = cycleIndex === total - 1;
  const newCC = cycle.setCC && (pipelined || cycle.stat === STAT.AOK) ? cycle.newCC : null;

  return (
    <div className="step-layout">
      {pipelined ? (
        <>
          <StageFlow
            cycles={pipeCycles}
            cycle={cycle}
            numberFormat={numberFormat}
            highlighted={hoveredStages}
            focusUid={focusUid}
            onFocusUid={setFocusUid}
          />
          <Panel id="mini-timeline" collapsible title="Around this cycle" className="mini-timeline-panel">
            <div ref={miniBox}>
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
            </div>
          </Panel>
        </>
      ) : (
        <SeqDatapath c={cycle} numberFormat={numberFormat} />
      )}

      <div className="step-detail">
        <HazardPanel events={events} onHover={setHoveredStages}>
          {atEnd && <RunSummary mode={mode} modeData={modeData} numberFormat={numberFormat} />}
        </HazardPanel>
        <Panel
          id="source"
          collapsible
          title="Source"
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
