import { formatNumericString } from '../utils/numberFormat';

function isHexString(value) {
  return typeof value === 'string' && /^0x[0-9a-f]+$/i.test(value);
}

function normalizeHexValue(value) {
  if (!isHexString(value)) return 'x';
  return `0x${value.slice(2).toLowerCase()}`;
}

function getAccessWordIndex(access, wordCount) {
  if (!access || access.inRange !== true) return null;
  if (!Number.isInteger(access.wordIndex)) return null;
  if (access.wordIndex < 0 || access.wordIndex >= wordCount) return null;
  return access.wordIndex;
}

function applyWriteToSnapshot(values, access, wordCount) {
  if (!access?.write) return;
  const wordIndex = getAccessWordIndex(access, wordCount);
  if (wordIndex === null) return;

  const nextValue = normalizeHexValue(access.writeData_hex);
  if (nextValue === 'x') return;
  values[wordIndex] = nextValue;
}

function formatWordValue(valueHex, numberFormat) {
  return formatNumericString(valueHex, numberFormat);
}

export default function DataMemoryViewer({
  dataMemory,
  cycles = [],
  cycleIdx = 0,
  currentCycle,
  numberFormat = 'dec',
}) {
  const words = dataMemory?.words ?? [];
  const wordCount = words.length;

  if (wordCount === 0) {
    return (
      <section className="section" id="data-memory-viewer">
        <div className="section-header">
          <h2 className="section-title">Data Memory Hex Viewer</h2>
          <span className="section-badge">Unavailable</span>
        </div>
        <p className="section-subtitle">
          Visualizes data-memory reads/writes from the memory stage.
        </p>
        <div className="empty-note">Data memory words are unavailable from the backend response.</div>
      </section>
    );
  }

  const baselineValues = words.map((word) => normalizeHexValue(word.valueHex ?? `0x${word.hex}`));
  const preCycleValues = [...baselineValues];

  for (let i = 0; i < cycleIdx; i += 1) {
    applyWriteToSnapshot(preCycleValues, cycles[i]?.dataMemory, wordCount);
  }

  const access = currentCycle?.dataMemory ?? null;
  const activeWordIndex = getAccessWordIndex(access, wordCount);
  const postCycleValues = [...preCycleValues];
  applyWriteToSnapshot(postCycleValues, access, wordCount);

  const isRead = Boolean(access?.read);
  const isWrite = Boolean(access?.write);
  const accessLabel = isRead && isWrite ? 'Read + Write' : isWrite ? 'Write' : isRead ? 'Read' : 'Idle';
  const activeWord = activeWordIndex !== null ? words[activeWordIndex] : null;
  const beforeValue = activeWordIndex !== null ? preCycleValues[activeWordIndex] : 'x';
  const afterValue = activeWordIndex !== null ? postCycleValues[activeWordIndex] : 'x';
  const readValue = isRead && activeWordIndex !== null
    ? beforeValue
    : normalizeHexValue(access?.readData_hex);
  const writeValue = isWrite ? normalizeHexValue(access?.writeData_hex) : 'x';

  return (
    <section className="section" id="data-memory-viewer">
      <div className="section-header">
        <h2 className="section-title">Data Memory Hex Viewer</h2>
        <span className="section-badge">{wordCount} words</span>
      </div>

      <p className="section-subtitle">
        Visualizing read/writes to the data memory. The table shows a reconstructed snapshot up to the selected cycle and highlights the active memory-stage access.
      </p>

      <div className="memory-viewer-summary" role="status" aria-live="polite">
        <div className="memory-summary-item">
          <span>Activity</span>
          <code>{accessLabel}</code>
        </div>
        <div className="memory-summary-item">
          <span>Word index</span>
          <code>{activeWordIndex ?? 'x'}</code>
        </div>
        <div className="memory-summary-item">
          <span>Byte address</span>
          <code>{activeWord ? formatNumericString(`0x${activeWord.byteAddress.toString(16)}`, numberFormat) : 'x'}</code>
        </div>
        <div className="memory-summary-item">
          <span>Range check</span>
          <code>{access?.inRange === true ? 'in-range' : access?.address_hex === 'x' ? 'x' : 'out-of-range'}</code>
        </div>
        <div className="memory-summary-item">
          <span>Read value</span>
          <code>{isRead ? formatWordValue(readValue, numberFormat) : '—'}</code>
        </div>
        <div className="memory-summary-item">
          <span>Write value</span>
          <code>{isWrite ? formatWordValue(writeValue, numberFormat) : '—'}</code>
        </div>
        <div className="memory-summary-item memory-summary-item-wide">
          <span>Selected row transition</span>
          <code>
            {activeWordIndex === null
              ? 'x'
              : isWrite
                ? `${formatWordValue(beforeValue, numberFormat)} -> ${formatWordValue(afterValue, numberFormat)}`
                : formatWordValue(afterValue, numberFormat)}
          </code>
        </div>
      </div>

      <div className="instruction-memory-table-wrap">
        <table className="instruction-memory-table data-memory-table">
          <thead>
            <tr>
              <th>Word</th>
              <th>Byte Addr</th>
              <th>Hex</th>
              <th>Display</th>
              <th>Access</th>
            </tr>
          </thead>
          <tbody>
            {words.map((word) => {
              const currentValue = postCycleValues[word.index] ?? normalizeHexValue(word.valueHex ?? `0x${word.hex}`);
              const wasValue = preCycleValues[word.index] ?? currentValue;
              const rowIsRead = isRead && activeWordIndex === word.index;
              const rowIsWrite = isWrite && activeWordIndex === word.index;
              const rowChanged = rowIsWrite && wasValue !== currentValue;

              return (
                <tr
                  key={word.index}
                  className={[
                    rowIsRead ? 'is-dmem-read' : '',
                    rowIsWrite ? 'is-dmem-write' : '',
                    rowChanged ? 'is-dmem-updated' : '',
                  ].filter(Boolean).join(' ')}
                >
                  <td className="mono-cell">{word.index}</td>
                  <td className="mono-cell">{formatNumericString(`0x${word.byteAddress.toString(16)}`, numberFormat)}</td>
                  <td className="mono-cell">
                    {currentValue}
                    {rowChanged && <span className="memory-inline-delta"> ({wasValue} -&gt; {currentValue})</span>}
                  </td>
                  <td className="mono-cell">{formatWordValue(currentValue, numberFormat)}</td>
                  <td className="mono-cell">
                    <span className="memory-access-indicator">
                      {rowIsRead && <span className="memory-access-chip memory-access-chip-read">read</span>}
                      {rowIsWrite && <span className="memory-access-chip memory-access-chip-write">write</span>}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
