import { formatNumericString, formatOpcodeValue } from '../utils/numberFormat';
import { ICODE_COLORS, shortPcHex } from './pipelineDiagramModel';

export default function StageBox({ label, stage, numberFormat, isStalled, isBubble }) {
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
  const pcDisplay = numberFormat === 'hex'
    ? shortPcHex(pcHex)
    : formatNumericString(pcHex, numberFormat);
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

