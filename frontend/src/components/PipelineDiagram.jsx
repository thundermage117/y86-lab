import { formatNumericString, formatOpcodeValue } from '../utils/numberFormat';

const STAGE_LABELS = ['FETCH', 'DECODE', 'EXECUTE', 'MEMORY', 'WRITEBACK'];
const STAGE_KEYS = ['fetch', 'decode', 'execute', 'memory', 'writeback'];
const STAGE_LETTER = { fetch: 'F', decode: 'D', execute: 'E', memory: 'M', writeback: 'W' };

// Color per icode_name
const ICODE_COLORS = {
  HALT:    '#e74c3c',
  NOP:     '#555a6e',
  CMOVXX:  '#8e44ad',
  IRMOVQ:  '#2980b9',
  RMMOVQ:  '#27ae60',
  MRMOVQ:  '#16a085',
  OPQ:     '#d35400',
  JXX:     '#c0392b',
  CALL:    '#7f8c8d',
  RET:     '#7f8c8d',
  PUSHQ:   '#f39c12',
  POPQ:    '#e67e22',
  x:       '#333645',
};

function StageBox({ label, stage, numberFormat, isStalled, isBubble }) {
  const name = stage?.icode_name ?? 'x';
  const icode = stage?.icode;
  const isEmpty = name === 'x';
  const baseColor = ICODE_COLORS[name] ?? '#4a4f63';
  const icodeBg = isBubble
    ? 'rgba(255, 107, 107, 0.15)'
    : isEmpty
      ? 'rgba(51, 54, 69, 0.5)'
      : baseColor;
  const borderColor = isStalled
    ? 'rgba(245, 166, 35, 0.65)'
    : isBubble
      ? 'rgba(255, 107, 107, 0.5)'
      : isEmpty
        ? 'rgba(136, 173, 211, 0.12)'
        : `${baseColor}99`;
  const icodeDisplay = formatOpcodeValue(icode, numberFormat);
  const ifunHex = stage?.ifun_hex ?? 'x';
  const pcHex = stage?.pc_hex ?? 'x';
  const statName = stage?.stat_name ?? 'x';
  const ifunDisplay = formatNumericString(ifunHex, numberFormat);
  const pcDisplay = formatNumericString(pcHex, numberFormat);
  const tooltip = [
    `${label}: ${name} (${icodeDisplay})`,
    pcHex !== 'x' ? `PC ${pcDisplay}` : null,
    ifunHex !== 'x' ? `ifun ${ifunDisplay}` : null,
    statName !== 'x' ? `stat ${statName}` : null,
    isStalled ? 'STALLED' : null,
    isBubble ? 'BUBBLE' : null,
  ].filter(Boolean).join(' | ');

  return (
    <div
      className={`stage-box${isStalled ? ' stage-stalled' : ''}${isBubble ? ' stage-bubble' : ''}${isEmpty ? ' stage-empty' : ''}`}
      style={{ borderColor }}
      title={tooltip}
    >
      <div className="stage-label-row">
        <span className="stage-label">{label}</span>
        {isStalled && <span className="stage-status-tag stage-status-stall">STALL</span>}
        {isBubble && <span className="stage-status-tag stage-status-bubble">BUB</span>}
      </div>
      <div className="stage-icode" style={{ background: icodeBg, opacity: isBubble ? 0.75 : 1 }}>
        {name}
      </div>
      <div className="stage-hex">{icodeDisplay}</div>
      <div className="stage-meta">
        {pcHex !== 'x' && <span className="stage-meta-chip">PC {pcDisplay}</span>}
        {ifunHex !== 'x' && <span className="stage-meta-chip">ifun {ifunDisplay}</span>}
        {statName !== 'x' && <span className="stage-meta-chip">stat {statName}</span>}
      </div>
    </div>
  );
}

export default function PipelineDiagram({ cycleData, numberFormat = 'dec', control }) {
  if (!cycleData) {
    return (
      <div className="pipeline-diagram pipeline-empty">
        Load a simulation to begin.
      </div>
    );
  }

  const stageStatus = {};
  for (const key of STAGE_KEYS) {
    const l = STAGE_LETTER[key];
    stageStatus[key] = {
      stalled: !!(control?.[`${l}_stall`]),
      bubble: !!(control?.[`${l}_bubble`]),
    };
  }

  const presentOpcodes = Array.from(new Set(
    STAGE_KEYS
      .map((key) => cycleData[key]?.icode_name ?? 'x')
      .filter(Boolean),
  ));

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
