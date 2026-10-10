import { useMemo } from 'react';
import { formatWord, padAddr } from '../../utils/format.js';
import Value from '../common/Value.jsx';
import { collectWrites, interestingWords, memoryAccess, memoryAt, readWord } from '../../utils/memory.js';
import Chip from '../common/Chip.jsx';

/** Data words of the program plus every word it writes, at the current cycle. */
export default function DataMemory({ program, cycles, cycleIndex, mode, rsp, numberFormat }) {
  const writes = useMemo(() => collectWrites(cycles, mode), [cycles, mode]);
  const words = useMemo(() => interestingWords(program, writes), [program, writes]);
  const mem = useMemo(() => memoryAt(program.image, writes, cycleIndex), [program.image, writes, cycleIndex]);
  const access = memoryAccess(cycles[cycleIndex], mode);
  const accessAddr = access && (access.read || access.write) && access.addr ? Number(BigInt(access.addr)) : null;
  const rspAddr = rsp ? Number(BigInt(rsp)) : null;

  const lastWrite = (addr) => {
    let found = null;
    for (const w of writes) {
      if (w.cycle >= cycleIndex) break;
      if (w.addr === addr) found = w;
    }
    return found;
  };

  if (words.length === 0) {
    return <p className="empty">This program has no data words and never writes memory.</p>;
  }

  return (
    <div className="table-wrap">
      <table className="data-table mem-table">
        <thead>
          <tr>
            <th scope="col">Address</th>
            <th scope="col">Label</th>
            <th scope="col">Value</th>
            <th scope="col">Last written</th>
          </tr>
        </thead>
        <tbody>
          {words.map(({ addr, label }) => {
            const lw = lastWrite(addr);
            const now = accessAddr === addr;
            return (
              <tr key={addr} className={now ? (access.write ? 'is-writing' : 'is-reading') : ''}>
                <td>
                  {padAddr(addr)}
                  {rspAddr === addr && <Chip tone="accent">%rsp</Chip>}
                </td>
                <td>{label ?? ''}</td>
                <td>
                  <Value hex={readWord(mem, addr)} numberFormat={numberFormat} />
                  {now && access.write && <span className="mem-next"> ← {formatWord(access.data, numberFormat)}</span>}
                  {now && access.read && <span className="mem-next"> → read</span>}
                </td>
                <td className="muted">{lw ? <>cycle {lw.cycle + 1}: <code>{lw.text}</code></> : 'initial'}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
