import { useMemo, useState } from 'react';
import { REG_NAMES } from '@y86/isa.js';
import StageCard from './StageCard.jsx';
import HazardPanel from './HazardPanel.jsx';
import RegisterPanel from './RegisterPanel.jsx';
import RunSummary from './RunSummary.jsx';
import Panel from '../common/Panel.jsx';
import Listing from '../program/Listing.jsx';
import { STAGE_KEYS } from '../../utils/format.js';
import { explainPipelineCycle } from '../../utils/hazards.js';

function stageMarkers(cycle) {
  const markers = new Map();
  for (const key of STAGE_KEYS) {
    const s = cycle.stages[key];
    if (s.bubble || !s.line) continue;
    if (!markers.has(s.line)) markers.set(s.line, []);
    markers.get(s.line).push(key);
  }
  return markers;
}

function pendingWrites(cycle) {
  const w = cycle.stages.writeback;
  const pending = new Map();
  if (w.bubble) return pending;
  if (w.writeE !== 15) pending.set(REG_NAMES[w.writeE], w.valE);
  if (w.writeM !== 15) pending.set(REG_NAMES[w.writeM], w.valM);
  return pending;
}

export default function PipelineView({ result, cycleIndex, numberFormat, nav }) {
  const mode = result.modes.pipelined;
  const cycle = mode.cycles[cycleIndex];
  const previous = cycleIndex > 0 ? mode.cycles[cycleIndex - 1] : null;
  const [hovered, setHovered] = useState([]);
  const events = useMemo(() => explainPipelineCycle(cycle, numberFormat), [cycle, numberFormat]);
  const markers = useMemo(() => stageMarkers(cycle), [cycle]);
  const atEnd = cycleIndex === mode.cycles.length - 1;

  return (
    <div className="pipeline-layout">
      <div className="stage-strip" aria-label="Pipeline stages">
        {STAGE_KEYS.map((key) => (
          <StageCard
            key={key}
            stageKey={key}
            stage={cycle.stages[key]}
            control={cycle.control}
            numberFormat={numberFormat}
            highlight={hovered.includes(key)}
          />
        ))}
      </div>

      {atEnd && <RunSummary mode="pipelined" modeData={mode} numberFormat={numberFormat} />}

      <div className="pipeline-detail">
        <HazardPanel
          events={events}
          onHover={setHovered}
          canNavigate
          {...nav}
        />
        <Panel title="Source" subtitle="Each instruction in flight is tagged with its stage." className="source-panel">
          <Listing listing={result.program.listing} markers={markers} showBytes={false} follow />
        </Panel>
        <RegisterPanel
          registers={cycle.registers}
          previous={previous?.registers}
          pending={pendingWrites(cycle)}
          cc={cycle.cc}
          newCC={cycle.setCC ? cycle.newCC : null}
          numberFormat={numberFormat}
        />
      </div>
    </div>
  );
}
