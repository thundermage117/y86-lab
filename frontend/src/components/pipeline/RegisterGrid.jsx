import { REG_NAMES } from '@y86/isa.js';
import { formatWord } from '../../utils/format.js';

const ZERO = '0x0000000000000000';

/**
 * Register file at the start of the cycle. `pending` maps register name to
 * the value it will receive at the end of this cycle.
 */
export default function RegisterGrid({ registers, previous, pending, cc, newCC, numberFormat }) {
  return (
    <>
      <div className="reg-grid">
        {REG_NAMES.map((name) => {
          const value = registers?.[name];
          const changed = previous && previous[name] !== value;
          const next = pending?.get(name);
          return (
            <div
              key={name}
              className={`reg${changed ? ' is-changed' : ''}${next !== undefined ? ' is-pending' : ''}${value === ZERO ? ' is-zero' : ''}`}
            >
              <span className="reg-name">%{name}</span>
              <span className="reg-value">{formatWord(value, numberFormat)}</span>
              {next !== undefined && <span className="reg-pending">← {formatWord(next, numberFormat)}</span>}
            </div>
          );
        })}
      </div>
      <div className="cc-row" aria-label="Condition codes">
        <span className="cc-title">CC</span>
        {['zf', 'sf', 'of'].map((f) => (
          <span key={f} className={`cc-flag${cc?.[f] ? ' is-set' : ''}`} title={`${f.toUpperCase()} = ${cc?.[f] ? 1 : 0}`}>
            {f.toUpperCase()} {cc ? +cc[f] : '–'}
          </span>
        ))}
        {newCC && (
          <span className="cc-next">
            ← {['zf', 'sf', 'of'].map((f) => `${f.toUpperCase()}=${+newCC[f]}`).join(' ')}
          </span>
        )}
      </div>
    </>
  );
}
