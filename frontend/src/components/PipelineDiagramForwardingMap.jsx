import {
  FORWARD_PORT_LAYOUT,
  FORWARD_STAGE_COLUMNS,
  FORWARD_VIEWBOX,
  buildForwardingEdges,
  formatForwardReg,
  hasReg,
} from './pipelineDiagramModel';

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

export default function ForwardingMap({ cycleData, control }) {
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

