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

  return (
    <div className="stage-box" style={{ borderColor: bg }}>
      <div className="stage-label">{label}</div>
      <div className="stage-icode" style={{ background: bg }}>{name}</div>
      <div className="stage-hex">{icodeHex}</div>
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

  return (
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
  );
}
