import { useMemo } from 'react';
import Panel from '../common/Panel.jsx';
import Listing from '../program/Listing.jsx';
import DataMemory from './DataMemory.jsx';
import { STAGE_KEYS, formatWord, padAddr } from '../../utils/format.js';
import { memoryAccess } from '../../utils/memory.js';

export default function MemoryView({ result, mode, cycleIndex, numberFormat }) {
  const modeData = result.modes[mode];
  const cycle = modeData.cycles[cycleIndex];
  const markers = useMemo(() => {
    const m = new Map();
    if (mode === 'sequential') {
      if (cycle.line) m.set(cycle.line, ['execute']);
      return m;
    }
    for (const key of STAGE_KEYS) {
      const s = cycle.stages[key];
      if (s.bubble || !s.line) continue;
      if (!m.has(s.line)) m.set(s.line, []);
      m.get(s.line).push(key);
    }
    return m;
  }, [cycle, mode]);
  const access = memoryAccess(cycle, mode);

  return (
    <div className="memory-layout">
      <Panel
        title="Instruction memory"
        subtitle="Program bytes as loaded at address 0. Code and data share one byte-addressed 8 KB memory."
        className="imem-panel"
      >
        <Listing listing={result.program.listing} markers={markers} follow />
      </Panel>
      <Panel
        title="Data memory"
        subtitle={access?.write
          ? `This cycle: ${access.text} writes ${formatWord(access.data, numberFormat)} to ${padAddr(BigInt(access.addr))}.`
          : access?.read
            ? `This cycle: ${access.text} reads ${padAddr(BigInt(access.addr))}.`
            : 'Program data words and every word the program writes. Writes take effect at the end of the cycle.'}
        className="dmem-panel"
      >
        <DataMemory
          program={result.program}
          cycles={modeData.cycles}
          cycleIndex={cycleIndex}
          mode={mode}
          rsp={cycle.registers.rsp}
          numberFormat={numberFormat}
        />
      </Panel>
    </div>
  );
}
