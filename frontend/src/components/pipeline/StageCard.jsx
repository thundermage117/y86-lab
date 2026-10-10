import { ICODE, STAT } from '@y86/isa.js';
import { STAGE_LABELS, STAGE_LETTERS, formatWord, formatAddr, regLabel } from '../../utils/format.js';

const FWD_STAGE = { e_valE: 'execute', M_valE: 'memory', m_valM: 'memory', W_valE: 'writeback', W_valM: 'writeback' };

function Row({ label, value, note, tone }) {
  return (
    <div className={`kv ${tone ? `kv-${tone}` : ''}`}>
      <dt>{label}</dt>
      <dd>{value}{note ? <span className="kv-note">{note}</span> : null}</dd>
    </div>
  );
}

function operandRow(name, src, val, fwd, fmt) {
  if (src === 15 || src === null) return null;
  const stage = FWD_STAGE[fwd];
  return (
    <Row
      key={name}
      label={`${name} ${regLabel(src)}`}
      value={fmt(val)}
      note={stage ? <span className={`fwd-chip stage-${stage}`}>← {fwd}</span> : <span className="fwd-chip">regfile</span>}
    />
  );
}

function stageRows(key, s, fmt, addr) {
  switch (key) {
    case 'fetch':
      return [
        <Row key="pc" label="PC" value={addr(s.pc)} />,
        <Row key="pred" label="predPC" value={addr(s.predPC)} note={s.icode === ICODE.JXX || s.icode === ICODE.CALL ? 'valC (predict taken)' : 'valP'} />,
        s.icode === ICODE.JXX || s.icode === ICODE.CALL || s.icode === ICODE.IRMOVQ
          ? <Row key="valC" label="valC" value={fmt(s.valC)} /> : null,
      ];
    case 'decode': {
      const rows = [];
      if (s.icode === ICODE.CALL || s.icode === ICODE.JXX) rows.push(<Row key="valA" label="valA" value={addr(s.valP)} note={<span className="fwd-chip">valP</span>} />);
      else rows.push(operandRow('valA', s.srcA, s.valA, s.fwdA, fmt));
      rows.push(operandRow('valB', s.srcB, s.valB, s.fwdB, fmt));
      if (s.dstE !== 15) rows.push(<Row key="dstE" label="dstE" value={regLabel(s.dstE)} />);
      if (s.dstM !== 15) rows.push(<Row key="dstM" label="dstM" value={regLabel(s.dstM)} />);
      return rows;
    }
    case 'execute': {
      const rows = [<Row key="valE" label="valE" value={fmt(s.valE)} note="ALU result" />];
      if (s.icode === ICODE.JXX || (s.icode === ICODE.RRMOVQ && s.ifun !== 0)) {
        rows.push(<Row key="cnd" label="Cnd" value={s.Cnd ? 'true' : 'false'} tone={s.Cnd ? 'ok' : 'warn'} />);
      }
      if (s.icode === ICODE.RRMOVQ && s.finalDstE !== s.dstE) {
        rows.push(<Row key="dst" label="dstE" value={`${regLabel(s.dstE)} → —`} note="cancelled" tone="warn" />);
      }
      if (s.setCC) rows.push(<Row key="cc" label="set_cc" value="yes" />);
      return rows;
    }
    case 'memory':
      if (s.write) return [<Row key="w" label="write" value={`M[${addr(s.addr)}]`} note={`← ${fmt(s.data)}`} tone={s.error ? 'bad' : undefined} />];
      if (s.read) return [<Row key="r" label="read" value={`M[${addr(s.addr)}]`} note={s.error ? 'invalid' : `→ ${fmt(s.valM)}`} tone={s.error ? 'bad' : undefined} />];
      return [<Row key="none" label="memory" value="no access" />];
    case 'writeback': {
      const rows = [];
      if (s.writeE !== 15) rows.push(<Row key="e" label={regLabel(s.writeE)} value={`← ${fmt(s.valE)}`} note="valE" />);
      if (s.writeM !== 15) rows.push(<Row key="m" label={regLabel(s.writeM)} value={`← ${fmt(s.valM)}`} note="valM" />);
      if (rows.length === 0) rows.push(<Row key="none" label="registers" value="no write" />);
      return rows;
    }
    default:
      return [];
  }
}

export default function StageCard({ stageKey, stage, control, numberFormat, highlight }) {
  const letter = STAGE_LETTERS[stageKey];
  const stalled = control?.[`${letter}_stall`];
  const bubbleNext = control?.[`${letter}_bubble`];
  const fmt = (v) => formatWord(v, numberFormat);
  const addr = (v) => formatAddr(v, numberFormat === 'hex' ? 'hex' : 'dec');
  const bad = stage && !stage.bubble && stage.stat !== null && stage.stat !== STAT.AOK;

  return (
    <article
      className={`stage-card stage-${stageKey}${stage?.bubble ? ' is-bubble' : ''}${highlight ? ' is-highlighted' : ''}`}
      aria-label={`${STAGE_LABELS[stageKey]} stage: ${stage?.bubble ? 'bubble' : stage?.text ?? 'empty'}`}
    >
      <header className="stage-card-header">
        <span className="stage-letter" aria-hidden="true">{letter}</span>
        <span className="stage-name">{STAGE_LABELS[stageKey]}</span>
        <span className="stage-flags">
          {stalled && <span className="flag flag-stall">stall</span>}
          {bubbleNext && <span className="flag flag-bubble">bubble next</span>}
          {bad && <span className="flag flag-error">{stage.statName}</span>}
        </span>
      </header>
      {stage?.bubble ? (
        <div className="stage-instr stage-instr-bubble">
          <code>bubble</code>
          <span className="muted">no instruction (nop inserted by control logic)</span>
        </div>
      ) : (
        <>
          <div className="stage-instr">
            <code>{stage?.text ?? '—'}</code>
            {stage?.line ? <span className="muted">line {stage.line}</span> : null}
          </div>
          <dl className="kv-list">{stage ? stageRows(stageKey, stage, fmt, addr) : null}</dl>
        </>
      )}
    </article>
  );
}
