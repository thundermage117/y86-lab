import { formatNumericString, formatOpcodeValue } from '../utils/numberFormat';

function shortPcHex(pcHex) {
  if (!pcHex || pcHex === 'x') return 'x';
  if (pcHex.length <= 10) return pcHex;
  return `0x${pcHex.slice(-6)}`;
}

const STAGE_LABELS = ['FETCH', 'DECODE', 'EXECUTE', 'MEMORY', 'WRITEBACK'];
const STAGE_KEYS = ['fetch', 'decode', 'execute', 'memory', 'writeback'];
const STAGE_LETTER = { fetch: 'F', decode: 'D', execute: 'E', memory: 'M', writeback: 'W' };

// Color per icode_name
const ICODE_COLORS = {
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

const FORWARD_VIEWBOX = { width: 1080, height: 196 };

const FORWARD_STAGE_COLUMNS = [
  { key: 'D', label: 'Decode sinks', x: 44, y: 34, width: 190, height: 128 },
  { key: 'E', label: 'Execute sources', x: 324, y: 34, width: 170, height: 128 },
  { key: 'M', label: 'Memory sources', x: 554, y: 34, width: 170, height: 128 },
  { key: 'W', label: 'Writeback sources', x: 784, y: 34, width: 214, height: 128 },
];

const FORWARD_PORT_LAYOUT = {
  srcA: { x: 140, y: 76, w: 124, h: 28, label: 'D.srcA', stage: 'D', type: 'sink' },
  srcB: { x: 140, y: 120, w: 124, h: 28, label: 'D.srcB', stage: 'D', type: 'sink' },
  'E.dstE': { x: 410, y: 76, w: 112, h: 26, label: 'E.dstE', stage: 'E', type: 'producer' },
  'E.dstM': { x: 410, y: 120, w: 112, h: 26, label: 'E.dstM', stage: 'E', type: 'producer' },
  'M.dstM': { x: 640, y: 76, w: 112, h: 26, label: 'M.dstM', stage: 'M', type: 'producer' },
  'M.dstE': { x: 640, y: 120, w: 112, h: 26, label: 'M.dstE', stage: 'M', type: 'producer' },
  'W.dstM': { x: 892, y: 76, w: 112, h: 26, label: 'W.dstM', stage: 'W', type: 'producer' },
  'W.dstE': { x: 892, y: 120, w: 112, h: 26, label: 'W.dstE', stage: 'W', type: 'producer' },
};

function hasReg(reg) {
  return reg && reg.raw !== null && reg.isNone === false;
}

function sameReg(a, b) {
  return hasReg(a) && hasReg(b) && a.raw === b.raw;
}

function formatForwardReg(reg) {
  return reg?.label ?? reg?.name ?? 'x';
}

function isUnknownReg(reg) {
  return !reg || reg.raw === null;
}

function buildForwardingEdges(cycleData, control) {
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

function ForwardingPathSvg({ edges, blockedEdges, sourceStatuses, producers, executeLoadDst }) {
  const hasAny = edges.length > 0 || blockedEdges.length > 0;

  const activeProducerKeys = new Set([
    ...edges.map((edge) => edge.producerKey),
    ...blockedEdges.map((edge) => edge.producerKey),
  ]);
  const activeSinkKeys = new Set([
    ...edges.map((edge) => edge.sourceKey),
    ...blockedEdges.map((edge) => edge.sourceKey),
  ]);

  const producerRegMap = new Map(producers.map((producer) => [producer.key, producer.reg]));
  producerRegMap.set('E.dstM', executeLoadDst);

  const makePath = (edge, index, blocked = false) => {
    const startPort = FORWARD_PORT_LAYOUT[edge.producerKey];
    const endPort = FORWARD_PORT_LAYOUT[edge.sourceKey];
    if (!startPort || !endPort) {
      return {
        d: '',
        labelX: FORWARD_VIEWBOX.width / 2,
        labelY: FORWARD_VIEWBOX.height / 2,
        channelY: FORWARD_VIEWBOX.height / 2,
      };
    }

    const startX = startPort.x - startPort.w / 2;
    const startY = startPort.y;
    const endX = endPort.x + endPort.w / 2;
    const endY = endPort.y;
    const laneBaseY = blocked
      ? (edge.lane === 'A' ? 42 : 154)
      : (edge.lane === 'A' ? 22 : 174);
    const laneSpread = (index % 2 === 0 ? -1 : 1) * (blocked ? 4 : 6);
    const channelY = laneBaseY + laneSpread;
    const bendA = startX - 22;
    const bendB = endX + 24;

    return {
      d: [
        `M ${startX} ${startY}`,
        `L ${bendA} ${startY}`,
        `L ${bendA} ${channelY}`,
        `L ${bendB} ${channelY}`,
        `L ${bendB} ${endY}`,
        `L ${endX} ${endY}`,
      ].join(' '),
      labelX: (bendA + bendB) / 2,
      labelY: channelY + (edge.lane === 'A' ? -5 : 12),
      channelY,
    };
  };

  return (
    <div className="forwarding-map-svg-wrap">
      <svg
        className="forwarding-map-svg"
        viewBox={`0 0 ${FORWARD_VIEWBOX.width} ${FORWARD_VIEWBOX.height}`}
        role="img"
        aria-label="Data forwarding and bypass paths"
      >
        <defs>
          <marker id="forward-arrowhead-srcA" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="7" markerHeight="7" orient="auto">
            <path d="M 0 0 L 8 4 L 0 8 z" fill="#31c3ff" />
          </marker>
          <marker id="forward-arrowhead-srcB" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="7" markerHeight="7" orient="auto">
            <path d="M 0 0 L 8 4 L 0 8 z" fill="#f6b34b" />
          </marker>
          <marker id="forward-arrowhead-blocked" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="7" markerHeight="7" orient="auto">
            <path d="M 0 0 L 8 4 L 0 8 z" fill="#ff7d7d" />
          </marker>
          <filter id="fwd-glow-a" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur in="SourceGraphic" stdDeviation="2" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <filter id="fwd-glow-b" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur in="SourceGraphic" stdDeviation="2" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <filter id="fwd-glow-blocked" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur in="SourceGraphic" stdDeviation="2" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {FORWARD_STAGE_COLUMNS.map((column) => (
          <g key={column.key} className={`forward-stage-column forward-stage-column-${column.key.toLowerCase()}`}>
            <rect
              x={column.x}
              y={column.y}
              width={column.width}
              height={column.height}
              rx="14"
              className="forward-stage-column-bg"
            />
            <text x={column.x + 12} y={column.y + 18} className="forward-stage-column-label">
              {column.label}
            </text>
          </g>
        ))}

        <line x1="48" y1="76" x2="1008" y2="76" className="forward-lane-guide forward-lane-guide-srcA" />
        <line x1="48" y1="120" x2="1008" y2="120" className="forward-lane-guide forward-lane-guide-srcB" />

        {Object.entries(FORWARD_PORT_LAYOUT).map(([portKey, port]) => {
          const reg = port.type === 'producer'
            ? producerRegMap.get(portKey)
            : sourceStatuses.find((source) => source.key === portKey)?.reg ?? null;
          const displayValue = formatForwardReg(reg);
          const isActive = port.type === 'producer'
            ? activeProducerKeys.has(portKey)
            : activeSinkKeys.has(portKey);
          const laneClass = portKey === 'srcA' ? 'is-srcA' : portKey === 'srcB' ? 'is-srcB' : '';
          return (
            <g
              key={portKey}
              className={`forward-port ${port.type === 'sink' ? 'forward-port-sink' : 'forward-port-producer'}${isActive ? ' is-active' : ''} ${laneClass}`.trim()}
            >
              <rect
                x={port.x - port.w / 2}
                y={port.y - port.h / 2}
                width={port.w}
                height={port.h}
                rx="9"
                className="forward-port-pill"
              />
              <text x={port.x - port.w / 2 + 8} y={port.y - 1} className="forward-port-label">
                {port.label}
              </text>
              <text x={port.x + port.w / 2 - 8} y={port.y - 1} textAnchor="end" className="forward-port-value">
                {displayValue}
              </text>
            </g>
          );
        })}

        {edges.map((edge, index) => {
          const path = makePath(edge, index, false);
          const laneClass = edge.lane === 'A' ? 'is-srcA' : 'is-srcB';
          const glowId = edge.lane === 'A' ? 'fwd-glow-a' : 'fwd-glow-b';
          const regLabel = formatForwardReg(edge.reg);
          return (
            <g key={edge.id} className={`forward-edge ${laneClass}`}>
              <path
                d={path.d}
                className="forward-edge-line is-animated"
                filter={`url(#${glowId})`}
                markerEnd={edge.lane === 'A' ? 'url(#forward-arrowhead-srcA)' : 'url(#forward-arrowhead-srcB)'}
              />
              <g className={`forward-reg-pill forward-reg-pill-${edge.lane.toLowerCase()}`}>
                <rect x={path.labelX - 28} y={path.channelY - 9} width={56} height={18} rx={9} className="forward-reg-pill-rect" />
                <text x={path.labelX} y={path.channelY} textAnchor="middle" dominantBaseline="central" className="forward-reg-pill-text">{regLabel}</text>
              </g>
            </g>
          );
        })}

        {blockedEdges.map((edge, index) => {
          const path = makePath(edge, index, true);
          const regLabel = formatForwardReg(edge.reg);
          return (
            <g key={edge.id} className="forward-edge is-blocked">
              <path
                d={path.d}
                className="forward-edge-line"
                filter="url(#fwd-glow-blocked)"
                markerEnd="url(#forward-arrowhead-blocked)"
              />
              <g className="forward-reg-pill forward-reg-pill-blocked">
                <rect x={path.labelX - 28} y={path.channelY - 9} width={56} height={18} rx={9} className="forward-reg-pill-rect" />
                <text x={path.labelX} y={path.channelY} textAnchor="middle" dominantBaseline="central" className="forward-reg-pill-text">{regLabel}</text>
              </g>
            </g>
          );
        })}

        {!hasAny && (
          <text x={FORWARD_VIEWBOX.width / 2} y="181" textAnchor="middle" className="forwarding-map-empty">
            No active decode-stage bypass selected (sources may still read from the register file)
          </text>
        )}
      </svg>
    </div>
  );
}

function ForwardingMap({ cycleData, control }) {
  if (!cycleData) return null;

  const { edges, blockedEdges, decodeSources, sourceStatuses, producers, executeLoadDst } = buildForwardingEdges(cycleData, control);
  const producerGroups = [
    { stage: 'E', title: 'Execute', keys: ['E.dstE', 'E.dstM'] },
    { stage: 'M', title: 'Memory', keys: ['M.dstM', 'M.dstE'] },
    { stage: 'W', title: 'Writeback', keys: ['W.dstM', 'W.dstE'] },
  ];
  const activeProducerKeys = new Set([
    ...edges.map((edge) => edge.producerKey),
    ...blockedEdges.map((edge) => edge.producerKey),
  ]);
  const producerMap = new Map(producers.map((producer) => [producer.key, producer]));
  producerMap.set('E.dstM', {
    key: 'E.dstM',
    reg: executeLoadDst,
  });

  return (
    <div className="forwarding-map" aria-label="Forwarding visualization">
      <div className="forwarding-map-head">
        <span className="forwarding-map-title">Data Forwarding / Bypass</span>
        <div className="forwarding-map-sources" aria-label="Decode source registers">
          {decodeSources.map((source) => {
            const status = sourceStatuses.find((entry) => entry.key === source.key);
            return (
              <span key={source.key} className={`forwarding-source-chip${status ? ` is-${status.status}` : ''}`}>
                <strong>{source.key}</strong>
                <span>{formatForwardReg(source.reg)}</span>
              </span>
            );
          })}
        </div>
      </div>

      <ForwardingPathSvg
        edges={edges}
        blockedEdges={blockedEdges}
        sourceStatuses={sourceStatuses}
        producers={producers}
        executeLoadDst={executeLoadDst}
      />

      <div className="forwarding-source-summary-grid" aria-label="Decode source resolution">
        {sourceStatuses.map((source) => (
          <div key={source.key} className={`forwarding-source-summary is-${source.status}`}>
            <div className="forwarding-source-summary-top">
              <span className={`forwarding-source-lane forwarding-source-lane-${source.lane.toLowerCase()}`}>
                {source.key}
              </span>
              <code className="forwarding-source-reg">{formatForwardReg(source.reg)}</code>
              <span className={`forwarding-source-status forwarding-source-status-${source.status}`}>
                {source.status === 'bypass' ? 'Bypass' :
                  source.status === 'blocked' ? 'Stall' :
                    source.status === 'rf' ? 'RegFile' :
                      source.status === 'unused' ? 'Unused' : 'Unknown'}
              </span>
            </div>
            <div className="forwarding-source-summary-text">{source.summary}</div>
            {source.candidates.length > 1 && (
              <div className="forwarding-source-candidates">
                {source.candidates.map((candidate) => (
                  <span
                    key={`${source.key}-${candidate.key}`}
                    className={`forwarding-candidate-chip${source.selected?.key === candidate.key ? ' is-selected' : ''}`}
                  >
                    {candidate.key}
                  </span>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="forwarding-producer-grid" aria-label="Forwarding producer slots">
        {producerGroups.map((group) => (
          <div key={group.stage} className="forwarding-producer-group">
            <div className="forwarding-producer-group-title">{group.title}</div>
            <div className="forwarding-producer-list">
              {group.keys.map((key) => {
                const producer = producerMap.get(key);
                const reg = producer?.reg ?? null;
                const hasValue = hasReg(reg);
                return (
                  <div
                    key={key}
                    className={`forwarding-producer-chip${activeProducerKeys.has(key) ? ' is-active' : ''}${hasValue ? '' : ' is-empty'}`}
                  >
                    <span className="forwarding-producer-chip-key">{key}</span>
                    <code className="forwarding-producer-chip-reg">{formatForwardReg(reg)}</code>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      <div className="forwarding-map-legend" aria-label="Forwarding legend">
        <span className="forwarding-legend-item">
          <span className="forwarding-legend-line forwarding-legend-line-srcA" aria-hidden="true" />
          `srcA` bypass
        </span>
        <span className="forwarding-legend-item">
          <span className="forwarding-legend-line forwarding-legend-line-srcB" aria-hidden="true" />
          `srcB` bypass
        </span>
        <span className="forwarding-legend-item">
          <span className="forwarding-legend-line forwarding-legend-line-blocked" aria-hidden="true" />
          load-use stall dependency
        </span>
      </div>
    </div>
  );
}

function StageBox({ label, stage, numberFormat, isStalled, isBubble }) {
  const name = stage?.icode_name ?? 'x';
  const icode = stage?.icode;
  const isEmpty = name === 'x';
  const baseColor = ICODE_COLORS[name] ?? '#4a4f63';
  const icodeBg = isBubble
    ? 'rgba(255, 107, 107, 0.15)'
    : isEmpty
      ? 'rgba(51, 54, 69, 0.5)'
      : baseColor;
  const borderColor = isStalled
    ? 'rgba(245, 166, 35, 0.65)'
    : isBubble
      ? 'rgba(255, 107, 107, 0.5)'
      : isEmpty
        ? 'rgba(136, 173, 211, 0.12)'
        : `${baseColor}99`;
  const icodeDisplay = formatOpcodeValue(icode, numberFormat);
  const ifunHex = stage?.ifun_hex ?? 'x';
  const pcHex = stage?.pc_hex ?? 'x';
  const statName = stage?.stat_name ?? 'x';
  const ifunDisplay = formatNumericString(ifunHex, numberFormat);
  const pcDisplay = numberFormat === 'hex'
    ? shortPcHex(pcHex)
    : formatNumericString(pcHex, numberFormat);
  const tooltip = [
    `${label}: ${name} (${icodeDisplay})`,
    pcHex !== 'x' ? `PC ${pcDisplay}` : null,
    ifunHex !== 'x' ? `ifun ${ifunDisplay}` : null,
    statName !== 'x' ? `stat ${statName}` : null,
    isStalled ? 'STALLED' : null,
    isBubble ? 'BUBBLE' : null,
  ].filter(Boolean).join(' | ');

  return (
    <div
      className={`stage-box${isStalled ? ' stage-stalled' : ''}${isBubble ? ' stage-bubble' : ''}${isEmpty ? ' stage-empty' : ''}`}
      style={{ borderColor }}
      title={tooltip}
    >
      <div className="stage-label-row">
        <span className="stage-label">{label}</span>
        {isStalled && <span className="stage-status-tag stage-status-stall">STALL</span>}
        {isBubble && <span className="stage-status-tag stage-status-bubble">BUB</span>}
      </div>
      <div className="stage-icode" style={{ background: icodeBg, opacity: isBubble ? 0.75 : 1 }}>
        {name}
      </div>
      <div className="stage-hex">{icodeDisplay}</div>
      <div className="stage-meta">
        {pcHex !== 'x' && <span className="stage-meta-chip">PC {pcDisplay}</span>}
        {ifunHex !== 'x' && <span className="stage-meta-chip">ifun {ifunDisplay}</span>}
        {statName !== 'x' && <span className="stage-meta-chip">stat {statName}</span>}
      </div>
    </div>
  );
}

export default function PipelineDiagram({ cycleData, numberFormat = 'dec', control }) {
  if (!cycleData) {
    return (
      <div className="pipeline-diagram pipeline-empty">
        Load a simulation to begin.
      </div>
    );
  }

  const stageStatus = {};
  for (const key of STAGE_KEYS) {
    const l = STAGE_LETTER[key];
    stageStatus[key] = {
      stalled: !!(control?.[`${l}_stall`]),
      bubble: !!(control?.[`${l}_bubble`]),
    };
  }

  const presentOpcodes = Array.from(new Set(
    STAGE_KEYS
      .map((key) => cycleData[key]?.icode_name ?? 'x')
      .filter(Boolean),
  ));

  return (
    <div className="pipeline-diagram-wrap">
      <div className="pipeline-diagram">
        {STAGE_KEYS.map((key, i) => (
          <div key={key} className="stage-wrapper">
            <StageBox
              label={STAGE_LABELS[i]}
              stage={cycleData[key]}
              numberFormat={numberFormat}
              isStalled={stageStatus[key].stalled}
              isBubble={stageStatus[key].bubble}
            />
            {i < STAGE_KEYS.length - 1 && (
              <div className="stage-arrow">▶</div>
            )}
          </div>
        ))}
      </div>

      <ForwardingMap cycleData={cycleData} control={control} />

      <div className="pipeline-legend" aria-label="Opcode legend for this cycle">
        <span className="legend-title">Opcodes in view</span>
        {presentOpcodes.map((opcode) => (
          <span key={opcode} className="legend-chip">
            <span
              className="legend-swatch"
              style={{ background: ICODE_COLORS[opcode] ?? '#4a4f63' }}
              aria-hidden="true"
            />
            {opcode}
          </span>
        ))}
      </div>
    </div>
  );
}
