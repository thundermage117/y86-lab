const STAGES = [
  { key: 'fetch', label: 'Fetch', letter: 'F', controlPrefix: 'F', upstream: null },
  { key: 'decode', label: 'Decode', letter: 'D', controlPrefix: 'D', upstream: 'fetch' },
  { key: 'execute', label: 'Execute', letter: 'E', controlPrefix: 'E', upstream: 'decode' },
  { key: 'memory', label: 'Memory', letter: 'M', controlPrefix: 'M', upstream: 'execute' },
  { key: 'writeback', label: 'Writeback', letter: 'W', controlPrefix: 'W', upstream: 'memory' },
];

const STAGE_INDEX = Object.fromEntries(STAGES.map((stage, index) => [stage.key, index]));

function stageSignature(stage) {
  if (!stage) return 'x';
  return [
    stage.icode_name ?? 'x',
    stage.pc_hex ?? 'x',
    stage.ifun_hex ?? 'x',
  ].join('|');
}

function shortPc(pcHex) {
  if (!pcHex || pcHex === 'x') return 'x';
  if (pcHex.length <= 10) return pcHex;
  return `0x${pcHex.slice(-6)}`;
}

function createToken({ id, kind, cycleIndex, stageKey, stageSnapshot }) {
  const opcode = stageSnapshot?.icode_name ?? (kind === 'bubble' ? 'NOP' : 'x');
  const pcHex = stageSnapshot?.pc_hex ?? 'x';
  const ifunHex = stageSnapshot?.ifun_hex ?? 'x';
  const signature = stageSignature(stageSnapshot);
  return {
    id,
    kind,
    createdAtCycle: cycleIndex,
    createdStageKey: stageKey,
    opcode,
    pcHex,
    ifunHex,
    signature,
    cells: [],
  };
}

export function buildTimeline(cycles) {
  if (!Array.isArray(cycles) || cycles.length === 0) {
    return { rows: [], bubbleCount: 0, stallCellCount: 0 };
  }

  let nextTokenId = 1;
  let bubbleCount = 0;
  let stallCellCount = 0;
  const tokens = new Map();
  let prevAssignments = {};

  const makeToken = (kind, cycleIndex, stageKey, stageSnapshot) => {
    const token = createToken({
      id: nextTokenId++,
      kind,
      cycleIndex,
      stageKey,
      stageSnapshot,
    });
    tokens.set(token.id, token);
    return token.id;
  };

  cycles.forEach((cycle, cycleIndex) => {
    const currentAssignments = {};

    for (const stageInfo of STAGES) {
      const { key, controlPrefix, upstream } = stageInfo;
      const stageSnapshot = cycle?.[key] ?? null;
      const icodeName = stageSnapshot?.icode_name ?? 'x';
      const hasVisibleContent = icodeName !== 'x';
      const control = cycle?.control ?? null;
      const isBubble = Boolean(control?.[`${controlPrefix}_bubble`]);
      const isStall = Boolean(control?.[`${controlPrefix}_stall`]);

      let tokenId = null;

      if (isBubble && key !== 'fetch') {
        tokenId = makeToken('bubble', cycleIndex, key, stageSnapshot);
        bubbleCount += 1;
      } else if (isStall && prevAssignments[key]) {
        tokenId = prevAssignments[key];
        stallCellCount += 1;
      } else if (upstream && prevAssignments[upstream] && hasVisibleContent) {
        tokenId = prevAssignments[upstream];
      } else if (key === 'fetch' && hasVisibleContent) {
        tokenId = makeToken('instruction', cycleIndex, key, stageSnapshot);
      } else if (hasVisibleContent) {
        tokenId = makeToken('instruction', cycleIndex, key, stageSnapshot);
      }

      currentAssignments[key] = tokenId;

      if (!tokenId) continue;
      const token = tokens.get(tokenId);
      if (!token) continue;

      if (token.cells[cycleIndex]) {
        tokenId = makeToken(token.kind, cycleIndex, key, stageSnapshot);
        currentAssignments[key] = tokenId;
      }

      const row = tokens.get(currentAssignments[key]);
      row.cells[cycleIndex] = {
        cycleIndex,
        stageKey: key,
        stageLabel: stageInfo.label,
        stageLetter: stageInfo.letter,
        stalled: isStall,
        bubbled: isBubble,
        opcode: stageSnapshot?.icode_name ?? 'x',
        pcHex: stageSnapshot?.pc_hex ?? 'x',
        ifunHex: stageSnapshot?.ifun_hex ?? 'x',
        statName: stageSnapshot?.stat_name ?? 'x',
      };
    }

    prevAssignments = currentAssignments;
  });

  const rows = Array.from(tokens.values())
    .sort((a, b) =>
      a.createdAtCycle - b.createdAtCycle
      || STAGE_INDEX[a.createdStageKey] - STAGE_INDEX[b.createdStageKey]
      || a.id - b.id,
    )
    .map((row) => ({
      ...row,
      baseLabel: row.kind === 'bubble'
        ? `Bubble   @ cycle ${String(row.createdAtCycle + 1).padEnd(3, '\u00A0')}       `
        : `${row.opcode.padEnd(8, '\u00A0')} @ ${row.pcHex !== 'x' ? row.pcHex : '                  '}`,
    }));

  const seenLabels = new Map();
  for (const row of rows) {
    const count = (seenLabels.get(row.baseLabel) ?? 0) + 1;
    seenLabels.set(row.baseLabel, count);
    row.label = row.kind === 'bubble'
      ? `Bubble ${count}`
      : row.baseLabel;
  }

  return { rows, bubbleCount, stallCellCount };
}

export function cellTitle(row, cell) {
  const parts = [
    `Cycle ${cell.cycleIndex + 1}`,
    `${cell.stageLabel} stage`,
    row.kind === 'bubble' ? 'Injected bubble' : row.opcode,
  ];

  if (cell.pcHex && cell.pcHex !== 'x') parts.push(`PC ${shortPc(cell.pcHex)}`);
  if (cell.stalled) parts.push('Stalled');
  if (cell.bubbled) parts.push('Bubble');
  return parts.join(' | ');
}

