import { formatNumericString } from '../utils/numberFormat';

const INSTRUCTION_LENGTHS = {
  HALT: 1,
  NOP: 1,
  CMOVXX: 2,
  IRMOVQ: 10,
  RMMOVQ: 10,
  MRMOVQ: 10,
  OPQ: 2,
  JXX: 9,
  CALL: 9,
  RET: 1,
  PUSHQ: 2,
  POPQ: 2,
};

function parseHexStringToBigInt(value) {
  if (typeof value !== 'string' || value === 'x') return null;
  try {
    return BigInt(value);
  } catch {
    return null;
  }
}

function formatBitAddress(bitAddress, numberFormat) {
  const hex = `0x${bitAddress.toString(16)}`;
  return formatNumericString(hex, numberFormat);
}

export default function InstructionMemoryViewer({ instructionMemory, currentCycle, numberFormat }) {
  const bytes = instructionMemory?.bytes ?? [];
  const fetchStage = currentCycle?.fetch ?? null;
  const fetchPcBits = parseHexStringToBigInt(fetchStage?.pc_hex);
  const fetchIcodeName = fetchStage?.icode_name ?? 'x';
  const fetchLengthBytes = INSTRUCTION_LENGTHS[fetchIcodeName] ?? null;
  const fetchByteIndex = fetchPcBits !== null ? Number(fetchPcBits / 8n) : null;
  const isAligned = fetchPcBits !== null ? (fetchPcBits % 8n) === 0n : false;
  const activeStart = fetchByteIndex !== null && isAligned ? fetchByteIndex : null;
  const activeEnd = activeStart !== null && fetchLengthBytes
    ? Math.min(bytes.length - 1, activeStart + fetchLengthBytes - 1)
    : null;

  const fetchedBytes = activeStart !== null && activeEnd !== null
    ? bytes.slice(activeStart, activeEnd + 1).map((entry) => entry.hex)
    : [];

  return (
    <section className="section" id="instruction-memory-viewer">
      <div className="section-header">
        <h2 className="section-title">Instruction Memory Viewer</h2>
        <span className="section-badge">{bytes.length} bytes</span>
      </div>

      <p className="section-subtitle">
        Program binary stored in fetch-stage instruction memory. Rows highlight the bytes read for the current fetch PC.
      </p>

      {bytes.length === 0 ? (
        <div className="empty-note">Instruction memory bytes are unavailable from the backend response.</div>
      ) : (
        <>
          <div className="memory-viewer-summary" role="status" aria-live="polite">
            <div className="memory-summary-item">
              <span>Fetch PC (bit address)</span>
              <code>{fetchPcBits !== null ? formatBitAddress(fetchPcBits, numberFormat) : 'x'}</code>
            </div>
            <div className="memory-summary-item">
              <span>Byte index</span>
              <code>{activeStart ?? 'x'}</code>
            </div>
            <div className="memory-summary-item">
              <span>Instruction</span>
              <code>{fetchIcodeName}</code>
            </div>
            <div className="memory-summary-item">
              <span>Length</span>
              <code>{fetchLengthBytes ? `${fetchLengthBytes} byte${fetchLengthBytes === 1 ? '' : 's'}` : 'unknown'}</code>
            </div>
            <div className="memory-summary-item memory-summary-item-wide">
              <span>Fetched bytes</span>
              <code>{fetchedBytes.length > 0 ? fetchedBytes.join(' ') : (isAligned ? 'unavailable' : 'PC not byte-aligned')}</code>
            </div>
          </div>

          <div className="instruction-memory-table-wrap">
            <table className="instruction-memory-table">
              <thead>
                <tr>
                  <th>Byte</th>
                  <th>Bit Addr</th>
                  <th>Hex</th>
                  <th>Binary</th>
                  <th>Fetch</th>
                </tr>
              </thead>
              <tbody>
                {bytes.map((entry) => {
                  const isFetched = activeStart !== null && activeEnd !== null
                    && entry.index >= activeStart && entry.index <= activeEnd;
                  const isFetchHead = activeStart !== null && entry.index === activeStart;

                  return (
                    <tr
                      key={entry.index}
                      className={[
                        isFetched ? 'is-fetched' : '',
                        isFetchHead ? 'is-fetch-head' : '',
                      ].filter(Boolean).join(' ')}
                    >
                      <td className="mono-cell">{entry.index}</td>
                      <td className="mono-cell">{formatBitAddress(BigInt(entry.bitAddress), numberFormat)}</td>
                      <td className="mono-cell">0x{entry.hex}</td>
                      <td className="mono-cell binary-cell">{entry.binary}</td>
                      <td className="mono-cell">{isFetchHead ? 'start' : isFetched ? 'read' : ''}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </section>
  );
}
