import { REG_NAMES, STAT_DESCRIPTIONS } from '@y86/isa.js';
import { formatWord, padAddr } from '../../utils/format.js';

const ZERO = '0x0000000000000000';

/** End-of-run summary: final status, results and memory changes. */
export default function RunSummary({ mode, modeData, numberFormat }) {
  const last = modeData.cycles.at(-1);
  const regs = REG_NAMES.filter((r) => last.registers[r] !== ZERO);
  const statName = modeData.status.statName;
  return (
    <section className={`run-summary stat-${statName}`} aria-label="Run summary">
      <div className="run-summary-head">
        <strong>{modeData.timedOut ? 'Stopped at the cycle limit' : `Finished: ${statName}`}</strong>
        <span className="muted">
          {modeData.timedOut ? 'The program did not halt; raise maxCycles or check for an infinite loop.' : STAT_DESCRIPTIONS[statName]}
        </span>
      </div>
      <dl className="run-stats">
        <div><dt>Cycles</dt><dd>{modeData.total}</dd></div>
        <div><dt>Instructions</dt><dd>{modeData.retired}</dd></div>
        <div><dt>CPI</dt><dd>{modeData.cpi ? modeData.cpi.toFixed(2) : '—'}</dd></div>
        <div><dt>Memory words written</dt><dd>{modeData.memoryChanges.length}</dd></div>
      </dl>
      {regs.length > 0 && (
        <p className="run-regs">
          <span className="muted">Non-zero registers ({mode}):</span>{' '}
          {regs.map((r) => <code key={r}>%{r} = {formatWord(last.registers[r], numberFormat)}</code>)}
        </p>
      )}
      {modeData.memoryChanges.length > 0 && (
        <p className="run-regs">
          <span className="muted">Memory:</span>{' '}
          {modeData.memoryChanges.slice(0, 8).map((c) => (
            <code key={c.addr}>[{padAddr(c.addr, 3)}] {formatWord(c.before, numberFormat)} → {formatWord(c.after, numberFormat)}</code>
          ))}
          {modeData.memoryChanges.length > 8 && <span className="muted"> … and {modeData.memoryChanges.length - 8} more</span>}
        </p>
      )}
    </section>
  );
}
