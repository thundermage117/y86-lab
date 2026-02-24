const STAGE_LABELS = ['FETCH', 'DECODE', 'EXECUTE', 'MEMORY', 'WRITEBACK'];
const STAGE_KEYS = ['fetch', 'decode', 'execute', 'memory', 'writeback'];

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

function StageBox({ label, stage }) {
  const name = stage?.icode_name ?? 'x';
  const icode = stage?.icode;
  const bg = ICODE_COLORS[name] ?? '#4a4f63';
  const icodeHex = icode !== null && icode !== undefined
    ? `0x${icode.toString(16).toUpperCase()}`
    : 'x';
  const ifunHex = stage?.ifun_hex ?? 'x';
  const pcHex = stage?.pc_hex ?? 'x';
  const statName = stage?.stat_name ?? 'x';
  const tooltip = [
    `${label}: ${name} (${icodeHex})`,
    pcHex !== 'x' ? `PC ${pcHex}` : null,
    ifunHex !== 'x' ? `ifun ${ifunHex}` : null,
    statName !== 'x' ? `stat ${statName}` : null,
  ].filter(Boolean).join(' | ');

  return (
    <div
      className="stage-box"
      style={{ borderColor: bg }}
      title={tooltip}
    >
      <div className="stage-label">{label}</div>
      <div className="stage-icode" style={{ background: bg }}>{name}</div>
      <div className="stage-hex">{icodeHex}</div>
      <div className="stage-meta">
        {pcHex !== 'x' && <span className="stage-meta-chip">PC {pcHex}</span>}
        {ifunHex !== 'x' && <span className="stage-meta-chip">ifun {ifunHex}</span>}
        {statName !== 'x' && <span className="stage-meta-chip">stat {statName}</span>}
      </div>
    </div>
  );
}

export default function PipelineDiagram({ cycleData }) {
  if (!cycleData) {
    return (
      <div className="pipeline-diagram pipeline-empty">
        Load a simulation to begin.
      </div>
    );
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
            <StageBox label={STAGE_LABELS[i]} stage={cycleData[key]} />
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
