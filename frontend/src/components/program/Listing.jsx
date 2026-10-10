import { useEffect, useRef } from 'react';
import { STAGE_LETTERS, padAddr } from '../../utils/format.js';
import { metaHeaderLength } from '../../utils/listing.js';

const hexBytes = (bytes) => bytes.map((b) => b.toString(16).padStart(2, '0')).join(' ');

/**
 * Assembler listing: address | bytes | source. `markers` maps a source line
 * to the pipeline stages currently holding that instruction.
 */
export default function Listing({
  listing, markers, showBytes = true, follow = false, focusLine = null, onHoverLine,
}) {
  const container = useRef(null);
  const firstMarked = markers ? Math.min(...[...markers.keys()]) : null;

  useEffect(() => {
    if (!follow || !Number.isFinite(firstMarked) || !container.current) return;
    const row = container.current.querySelector(`[data-line="${firstMarked}"]`);
    if (!row) return;
    const box = container.current;
    const top = row.offsetTop - box.clientHeight / 3;
    box.scrollTo?.({ top: Math.max(0, top), behavior: 'smooth' });
  }, [follow, firstMarked]);

  if (!listing?.length) return <p className="empty">Assemble a program to see its listing.</p>;

  // Skip the leading `# @title` / `# @summary` header block; trim trailing blank lines.
  const begin = metaHeaderLength(listing);
  let end = listing.length;
  while (end > 0 && listing[end - 1].kind === 'blank' && !listing[end - 1].text.trim()) end -= 1;

  return (
    <div className="listing" ref={container}>
      <table>
        <thead className="sr-only">
          <tr>
            <th scope="col">Stages</th>
            <th scope="col">Address</th>
            {showBytes && <th scope="col">Bytes</th>}
            <th scope="col">Source</th>
          </tr>
        </thead>
        <tbody>
          {listing.slice(begin, end).map((item) => {
            const stages = markers?.get(item.line) ?? [];
            const isComment = /^\s*#/.test(item.text);
            return (
              <tr
                key={item.line}
                data-line={item.line}
                className={[
                  stages.length ? `is-marked stage-bg-${stages[0]}` : '',
                  isComment ? 'is-comment' : '',
                  focusLine === item.line ? 'is-focused' : '',
                ].join(' ')}
                onMouseEnter={onHoverLine && stages.length ? () => onHoverLine(item.line) : undefined}
                onMouseLeave={onHoverLine && stages.length ? () => onHoverLine(null) : undefined}
              >
                <td className="listing-stages">
                  {stages.map((s) => (
                    <span key={s} className={`stage-badge stage-${s}`} title={s}>{STAGE_LETTERS[s]}</span>
                  ))}
                </td>
                <td className="listing-addr">{item.addr !== null && item.kind !== 'blank' ? padAddr(item.addr, 3) : ''}</td>
                {showBytes && <td className="listing-bytes">{hexBytes(item.bytes)}</td>}
                <td className="listing-src"><code>{item.text || ' '}</code></td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
