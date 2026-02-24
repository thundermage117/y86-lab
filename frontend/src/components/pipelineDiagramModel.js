export const STAGE_LABELS = ['FETCH', 'DECODE', 'EXECUTE', 'MEMORY', 'WRITEBACK'];
export const STAGE_KEYS = ['fetch', 'decode', 'execute', 'memory', 'writeback'];
export const STAGE_LETTER = { fetch: 'F', decode: 'D', execute: 'E', memory: 'M', writeback: 'W' };

export const ICODE_COLORS = {
  HALT: '#e74c3c',
  NOP: '#555a6e',
  CMOVXX: '#8e44ad',
  IRMOVQ: '#2980b9',
  RMMOVQ: '#27ae60',
  MRMOVQ: '#16a085',
  OPQ: '#d35400',
  JXX: '#c0392b',
  CALL: '#7f8c8d',
  RET: '#7f8c8d',
  PUSHQ: '#f39c12',
  POPQ: '#e67e22',
  x: '#333645',
};

export const FORWARD_VIEWBOX = { width: 1080, height: 196 };

export const FORWARD_STAGE_COLUMNS = [
  { key: 'D', label: 'Decode sinks', x: 44, y: 34, width: 190, height: 128 },
  { key: 'E', label: 'Execute sources', x: 324, y: 34, width: 170, height: 128 },
  { key: 'M', label: 'Memory sources', x: 554, y: 34, width: 170, height: 128 },
  { key: 'W', label: 'Writeback sources', x: 784, y: 34, width: 214, height: 128 },
];

export const FORWARD_PORT_LAYOUT = {
  srcA: { x: 140, y: 76, w: 124, h: 28, label: 'D.srcA', stage: 'D', type: 'sink' },
  srcB: { x: 140, y: 120, w: 124, h: 28, label: 'D.srcB', stage: 'D', type: 'sink' },
  'E.dstE': { x: 410, y: 76, w: 112, h: 26, label: 'E.dstE', stage: 'E', type: 'producer' },
  'E.dstM': { x: 410, y: 120, w: 112, h: 26, label: 'E.dstM', stage: 'E', type: 'producer' },
  'M.dstM': { x: 640, y: 76, w: 112, h: 26, label: 'M.dstM', stage: 'M', type: 'producer' },
  'M.dstE': { x: 640, y: 120, w: 112, h: 26, label: 'M.dstE', stage: 'M', type: 'producer' },
  'W.dstM': { x: 892, y: 76, w: 112, h: 26, label: 'W.dstM', stage: 'W', type: 'producer' },
  'W.dstE': { x: 892, y: 120, w: 112, h: 26, label: 'W.dstE', stage: 'W', type: 'producer' },
};

export function shortPcHex(pcHex) {
  if (!pcHex || pcHex === 'x') return 'x';
  if (pcHex.length <= 10) return pcHex;
  return `0x${pcHex.slice(-6)}`;
}

export function hasReg(reg) {
  return reg && reg.raw !== null && reg.isNone === false;
}

function sameReg(a, b) {
  return hasReg(a) && hasReg(b) && a.raw === b.raw;
}

export function formatForwardReg(reg) {
  return reg?.label ?? reg?.name ?? 'x';
}

function isUnknownReg(reg) {
  return !reg || reg.raw === null;
}

export function buildForwardingEdges(cycleData, control) {
  const forwarding = cycleData?.forwarding;
  if (!forwarding) {
    return {
      edges: [],
      blockedEdges: [],
      decodeSources: [],
      sourceStatuses: [],
      producers: [],
      executeLoadDst: null,
    };
  }

  const decodeSources = [
    { lane: 'A', key: 'srcA', reg: forwarding.decode?.srcA ?? null },
    { lane: 'B', key: 'srcB', reg: forwarding.decode?.srcB ?? null },
  ];

  const producers = [
    { node: 'E', path: 'dstE', stageLabel: 'Execute', reg: forwarding.execute?.dstE ?? null },
    { node: 'M', path: 'dstM', stageLabel: 'Memory', reg: forwarding.memory?.dstM ?? null },
    { node: 'M', path: 'dstE', stageLabel: 'Memory', reg: forwarding.memory?.dstE ?? null },
    { node: 'W', path: 'dstM', stageLabel: 'Writeback', reg: forwarding.writeback?.dstM ?? null },
    { node: 'W', path: 'dstE', stageLabel: 'Writeback', reg: forwarding.writeback?.dstE ?? null },
  ].map((producer, priority) => ({
    ...producer,
    key: `${producer.node}.${producer.path}`,
    priority: priority + 1,
  }));

  const edges = [];
  const blockedEdges = [];
  const sourceStatuses = [];
  const loadUseHazardActive = Boolean(control?.D_stall && control?.E_bubble);
  const executeLoadDst = forwarding.execute?.dstM ?? null;

  for (const source of decodeSources) {
    if (isUnknownReg(source.reg)) {
      sourceStatuses.push({
        ...source,
        status: 'unknown',
        summary: 'waiting for decode source id',
        candidates: [],
        selected: null,
      });
      continue;
    }

    if (!hasReg(source.reg)) {
      sourceStatuses.push({
        ...source,
        status: 'unused',
        summary: 'unused (RNONE)',
        candidates: [],
        selected: null,
      });
      continue;
    }

    const matches = producers.filter((producer) => sameReg(producer.reg, source.reg));
    const match = matches[0] ?? null;
    if (match) {
      edges.push({
        id: `${source.key}-${match.node}-${match.path}-${source.reg.raw}`,
        lane: source.lane,
        sourceKey: source.key,
        sourceNode: match.node,
        sourcePath: match.path,
        sourceStageLabel: match.stageLabel,
        producerKey: match.key,
        producerPriority: match.priority,
        reg: source.reg,
      });
      sourceStatuses.push({
        ...source,
        status: 'bypass',
        summary: `bypass from ${match.key}`,
        candidates: matches,
        selected: match,
      });
      continue;
    }

    if (loadUseHazardActive && sameReg(executeLoadDst, source.reg)) {
      const blockedEdge = {
        id: `blocked-${source.key}-${source.reg.raw}`,
        lane: source.lane,
        sourceKey: source.key,
        sourceNode: 'E',
        sourcePath: 'dstM',
        sourceStageLabel: 'Execute',
        producerKey: 'E.dstM',
        reg: source.reg,
      };
      blockedEdges.push(blockedEdge);
      sourceStatuses.push({
        ...source,
        status: 'blocked',
        summary: 'load-use stall on E.dstM',
        candidates: [],
        selected: { key: 'E.dstM', stageLabel: 'Execute', path: 'dstM' },
      });
      continue;
    }

    sourceStatuses.push({
      ...source,
      status: 'rf',
      summary: 'read from register file',
      candidates: [],
      selected: null,
    });
  }

  return { edges, blockedEdges, decodeSources, sourceStatuses, producers, executeLoadDst };
}

export function getStageStatus(control) {
  const stageStatus = {};
  for (const key of STAGE_KEYS) {
    const l = STAGE_LETTER[key];
    stageStatus[key] = {
      stalled: !!(control?.[`${l}_stall`]),
      bubble: !!(control?.[`${l}_bubble`]),
    };
  }
  return stageStatus;
}

export function getPresentOpcodes(cycleData) {
  return Array.from(new Set(
    STAGE_KEYS
      .map((key) => cycleData?.[key]?.icode_name ?? 'x')
      .filter(Boolean),
  ));
}

