import { useState } from 'react';
import Panel from '../common/Panel.jsx';
import Segmented from '../common/Segmented.jsx';
import RegisterGrid from '../pipeline/RegisterGrid.jsx';
import DataMemory from '../memory/DataMemory.jsx';
import { readStored, writeStored } from '../../hooks/storage.js';
import { memoryAccess } from '../../utils/memory.js';
import { formatWord, padAddr } from '../../utils/format.js';

const KEY = 'y86-inspector';

/** Registers / data memory, switchable, in one panel. */
export default function Inspector({ result, mode, cycleIndex, numberFormat, previous, pending, newCC }) {
  const [view, setView] = useState(() => (readStored(KEY) === 'memory' ? 'memory' : 'registers'));
  const modeData = result.modes[mode];
  const cycle = modeData.cycles[cycleIndex];
  const access = memoryAccess(cycle, mode);

  const change = (v) => {
    setView(v);
    writeStored(KEY, v);
  };

  let note = '← marks a value written at the next clock edge.';
  if (view === 'memory') {
    note = access?.write
      ? `This cycle writes ${formatWord(access.data, numberFormat)} to ${padAddr(BigInt(access.addr))}.`
      : access?.read
        ? `This cycle reads ${padAddr(BigInt(access.addr))}.`
        : 'Program data and every word the program writes.';
  }

  return (
    <Panel
      id="inspector"
      collapsible
      title={view === 'registers' ? 'Registers' : 'Data memory'}
      hideTitle
      className="inspector-panel"
      actions={(
        <Segmented
          label="Inspector view"
          size="sm"
          value={view}
          onChange={change}
          options={[
            { value: 'registers', label: 'Registers' },
            { value: 'memory', label: access?.read || access?.write ? 'Memory •' : 'Memory', title: 'Data memory' },
          ]}
        />
      )}
    >
      <p className="panel-note">{note}</p>
      {view === 'registers' ? (
        <RegisterGrid
          registers={cycle.registers}
          previous={previous?.registers}
          pending={pending}
          cc={cycle.cc}
          newCC={newCC}
          numberFormat={numberFormat}
        />
      ) : (
        <DataMemory
          program={result.program}
          cycles={modeData.cycles}
          cycleIndex={cycleIndex}
          mode={mode}
          rsp={cycle.registers.rsp}
          numberFormat={numberFormat}
        />
      )}
    </Panel>
  );
}
