import ForwardingMap from './PipelineDiagramForwardingMap';
import StageBox from './PipelineDiagramStageBox';
import {
  ICODE_COLORS,
  STAGE_KEYS,
  STAGE_LABELS,
  getPresentOpcodes,
  getStageStatus,
} from './pipelineDiagramModel';

export default function PipelineDiagram({ cycleData, numberFormat = 'dec', control }) {
  if (!cycleData) {
    return (
      <div className="pipeline-diagram pipeline-empty">
        Load a simulation to begin.
      </div>
    );
  }

  const stageStatus = getStageStatus(control);
  const presentOpcodes = getPresentOpcodes(cycleData);

  return (
    <div className="pipeline-diagram-wrap">
      <div className="pipeline-diagram">
        {STAGE_KEYS.map((key, i) => (
          <div key={key} className="stage-wrapper">
            <StageBox
              label={STAGE_LABELS[i]}
              stage={cycleData[key]}
              numberFormat={numberFormat}
              isStalled={stageStatus[key].stalled}
              isBubble={stageStatus[key].bubble}
            />
            {i < STAGE_KEYS.length - 1 && (
              <div className="stage-arrow">▶</div>
            )}
          </div>
        ))}
      </div>

      <ForwardingMap cycleData={cycleData} control={control} />

      <div className="pipeline-legend" aria-label="Opcode legend for this cycle">
        <span className="legend-title">Opcodes in view</span>
        {presentOpcodes.map((opcode) => (
          <span key={opcode} className="legend-chip">
            <span
              className="legend-swatch"
              style={{ background: ICODE_COLORS[opcode] ?? '#4a4f63' }}
              aria-hidden="true"
            />
            {opcode}
          </span>
        ))}
      </div>
    </div>
  );
}

