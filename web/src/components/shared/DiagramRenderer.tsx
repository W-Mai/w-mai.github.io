import { useState, useEffect, useCallback, useRef, useMemo, type FC } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  type Node,
  type Edge,
  type NodeTypes,
  type NodeProps,
  type EdgeProps,
  type OnNodesChange,
  Position,
  Handle,
  useReactFlow,
  ReactFlowProvider,
  applyNodeChanges,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import type { ArchitectureData, ArchLayerDef } from '~/data/architecture';
import { getConnectedNodes, isEditorOnly, isNavigable, LAYOUT } from '~/lib/editor/diagram';

/* ------------------------------------------------------------------ */
/*  Types                                                             */
/* ------------------------------------------------------------------ */

interface DiagramRendererProps {
  data: ArchitectureData;
  savedLayout?: Record<string, unknown>;
  editorMode?: boolean;
}

interface LayerTheme {
  accent: string;
  accentMuted: string;
  border: string;
}

/* ------------------------------------------------------------------ */
/*  Layer theme lookup                                                */
/* ------------------------------------------------------------------ */

const LAYER_THEMES: Record<string, LayerTheme> = {};

function getLayerTheme(layerId: string): LayerTheme {
  return LAYER_THEMES[layerId] ?? {
    accent: '#94a3b8', accentMuted: 'rgba(148,163,184,0.08)',
    border: 'rgba(148,163,184,0.3)',
  };
}

/* ------------------------------------------------------------------ */
/*  Arch node — uses CSS classes for highlight/dim, not inline style  */
/* ------------------------------------------------------------------ */

function ArchNodeComponent({ id, data }: NodeProps) {
  const d = data as {
    label: string; icon: string; url?: string;
    layerId: string; editorOnly: boolean; navigable: boolean;
  };
  const theme = getLayerTheme(d.layerId);

  const handleClick = () => {
    if (d.navigable && d.url) {
      try { window.location.assign(d.url); } catch { /* noop */ }
    }
  };

  const hs = {
    background: 'transparent', width: 1, height: 1,
    border: 'none', opacity: 0,
  };

  return (
    <div
      className={`arch-node${d.editorOnly ? ' editor-only' : ''}`}
      data-node-id={id}
      style={{
        '--node-accent': theme.accent,
        '--node-accent-muted': theme.accentMuted,
        '--node-border': theme.border,
      } as React.CSSProperties}
      onClick={handleClick}
    >
      <Handle type="target" position={Position.Top} style={{ ...hs, left: '50%' }} />
      <span className="arch-node-icon">{d.icon}</span>
      <span className="arch-node-label">{d.label}</span>
      {d.editorOnly && <span className="arch-node-dev">DEV</span>}
      <Handle type="source" position={Position.Bottom} style={{ ...hs, left: '50%' }} />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Layer band component                                              */
/* ------------------------------------------------------------------ */

function LayerBandComponent({ id, data }: NodeProps) {
  const d = data as { label: string; icon: string; layerId: string };
  const theme = getLayerTheme(d.layerId);

  return (
    <div
      className="layer-band"
      data-layer-id={d.layerId}
      style={{
        '--layer-accent': theme.accent,
        '--layer-accent-muted': theme.accentMuted,
        '--layer-border': theme.border,
      } as React.CSSProperties}
    >
      <div className="layer-band-badge">
        <span className="layer-band-icon">{d.icon}</span>
        <span className="layer-band-label">{d.label}</span>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Custom edge with arrow marker                                     */
/* ------------------------------------------------------------------ */

function LayeredEdge({ id, sourceX, sourceY, targetX, targetY, data }: EdgeProps) {
  const d = data as { label?: string; color?: string } | undefined;
  const color = d?.color ?? '#94a3b8';
  const markerId = `arrow-${id.replace(/[^a-zA-Z0-9]/g, '_')}`;

  const midY = (sourceY + targetY) / 2;
  const r = Math.min(8, Math.abs(targetY - sourceY) / 4, Math.abs(targetX - sourceX) / 2 || 999);

  let edgePath: string;
  if (Math.abs(targetX - sourceX) < 1) {
    edgePath = `M ${sourceX} ${sourceY} L ${targetX} ${targetY}`;
  } else {
    const dirX = targetX > sourceX ? 1 : -1;
    const dirY = targetY > sourceY ? 1 : -1;
    edgePath = [
      `M ${sourceX} ${sourceY}`,
      `L ${sourceX} ${midY - r * dirY}`,
      `Q ${sourceX} ${midY} ${sourceX + r * dirX} ${midY}`,
      `L ${targetX - r * dirX} ${midY}`,
      `Q ${targetX} ${midY} ${targetX} ${midY + r * dirY}`,
      `L ${targetX} ${targetY}`,
    ].join(' ');
  }

  return (
    <g className="layered-edge">
      <defs>
        <marker id={markerId} markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto">
          <path d="M 0 0 L 8 3 L 0 6 Z" fill={color} opacity="0.25" />
        </marker>
      </defs>
      <path d={edgePath} fill="none" stroke={color} strokeWidth="1.5"
        opacity="0.25" markerEnd={`url(#${markerId})`} />
      <circle r="1.2" fill={color} opacity="0.3">
        <animateMotion dur="3s" repeatCount="indefinite" path={edgePath} />
      </circle>
      {d?.label && (
        <text x={(sourceX + targetX) / 2} y={midY} textAnchor="middle" dominantBaseline="central"
          style={{ fontSize: '7px', fontWeight: 500, fill: color, opacity: 0.35 }}>
          {d.label}
        </text>
      )}
    </g>
  );
}

/* ------------------------------------------------------------------ */
/*  Node/edge type registrations                                      */
/* ------------------------------------------------------------------ */

const nodeTypes: NodeTypes = {
  archNode: ArchNodeComponent as any,
  layerBand: LayerBandComponent as any,
};
const edgeTypes = { layered: LayeredEdge as any };

/* ------------------------------------------------------------------ */
/*  Auto-layout: arrange nodes in hori
zontal rows per layer           */
/* ------------------------------------------------------------------ */

const { layerPadX, layerPadTop, layerPadBottom, layerGapY, nodeWidth, nodeHeight, nodeGapX, nodeGapY, layerHeaderHeight } = LAYOUT;

function computeAutoLayout(archData: ArchitectureData): {
  layerBands: { layerDef: ArchLayerDef; x: number; y: number; w: number; h: number }[];
  nodePositions: Record<string, { x: number; y: number }>;
} {
  const layerBands: { layerDef: ArchLayerDef; x: number; y: number; w: number; h: number }[] = [];
  const nodePositions: Record<string, { x: number; y: number }> = {};
  const MAX_PER_ROW = 6;
  let cursorY = 0;
  let maxWidth = 0;

  for (const layer of archData.layers) {
    const layerNodes = archData.nodes.filter((n) => n.layer === layer.id);
    if (layerNodes.length === 0) continue;
    const rows = Math.ceil(layerNodes.length / MAX_PER_ROW);
    const contentH = rows * nodeHeight + (rows - 1) * nodeGapY;
    const bandH = layerHeaderHeight + layerPadTop + contentH + layerPadBottom;
    const nodesPerRow = Math.ceil(layerNodes.length / rows);
    const bandW = layerPadX * 2 + nodesPerRow * nodeWidth + (nodesPerRow - 1) * nodeGapX;
    layerBands.push({ layerDef: layer, x: 0, y: cursorY, w: bandW, h: bandH });
    maxWidth = Math.max(maxWidth, bandW);
    layerNodes.forEach((node, i) => {
      const row = Math.floor(i / nodesPerRow);
      const col = i % nodesPerRow;
      nodePositions[node.id] = {
        x: layerPadX + col * (nodeWidth + nodeGapX),
        y: layerHeaderHeight + layerPadTop + row * (nodeHeight + nodeGapY),
      };
    });
    cursorY += bandH + layerGapY;
  }

  for (const band of layerBands) {
    const offset = (maxWidth - band.w) / 2;
    band.x = offset;
    const layerNodes = archData.nodes.filter((n) => n.layer === band.layerDef.id);
    for (const node of layerNodes) {
      if (nodePositions[node.id]) nodePositions[node.id].x += offset;
    }
    band.w = maxWidth;
  }
  return { layerBands, nodePositions };
}

/* ------------------------------------------------------------------ */
/*  Build ReactFlow nodes + edges (NO hover logic here)               */
/* ------------------------------------------------------------------ */

function buildFlowElements(
  archData: ArchitectureData,
  showEditorNodes: boolean,
): { nodes: Node[]; edges: Edge[] } {
  for (const l of archData.layers) {
    LAYER_THEMES[l.id] = { accent: l.accent, accentMuted: l.accentMuted, border: l.border };
  }

  const visibleNodes = showEditorNodes
    ? archData.nodes
    : archData.nodes.filter((n) => !isEditorOnly(n));
  const visibleNodeIds = new Set(visibleNodes.map((n) => n.id));
  const visibleEdges = archData.edges.filter(
    (e) => visibleNodeIds.has(e.source) && visibleNodeIds.has(e.target),
  );

  const filteredData: ArchitectureData = {
    layers: archData.layers, nodes: visibleNodes, edges: visibleEdges,
  };
  const { layerBands, nodePositions } = computeAutoLayout(filteredData);

  const nodes: Node[] = [];
  const edges: Edge[] = [];

  for (const band of layerBands) {
    nodes.push({
      id: `layer-${band.layerDef.id}`, type: 'layerBand',
      position: { x: band.x, y: band.y },
      data: { label: band.layerDef.name, icon: band.layerDef.icon, layerId: band.layerDef.id },
      style: { width: band.w, height: band.h },
      draggable: false, selectable: false, zIndex: -1,
    });
  }

  for (const archNode of visibleNodes) {
    const band = layerBands.find((b) => b.layerDef.id === archNode.layer);
    if (!band) continue;
    const pos = nodePositions[archNode.id];
    if (!pos) continue;
    nodes.push({
      id: archNode.id, type: 'archNode',
      position: { x: pos.x, y: pos.y },
      parentId: `layer-${archNode.layer}`, extent: 'parent' as const,
      data: {
        label: archNode.name, icon: archNode.icon, url: archNode.url,
        layerId: archNode.layer, editorOnly: isEditorOnly(archNode),
        navigable: isNavigable(archNode),
      },
      draggable: false, zIndex: 1,
    });
  }

  for (const archEdge of visibleEdges) {
    const srcNode = visibleNodes.find((n) => n.id === archEdge.source);
    if (!srcNode) continue;
    const theme = getLayerTheme(srcNode.layer);
    edges.push({
      id: `${archEdge.source}->${archEdge.target}`,
      source: archEdge.source, target: archEdge.target,
      type: 'layered',
      data: { label: archEdge.label, color: theme.accent },
    });
  }

  return { nodes, edges };
}

/* ------------------------------------------------------------------ */
/*  Main flow component                                               */
/* ------------------------------------------------------------------ */

function DiagramFlow({ data }: DiagramRendererProps) {
  const [showEditorNodes, setShowEditorNodes] = useState(true);
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);
  const [nodes, setNodes] = useState<Node[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);
  const { fitView } = useReactFlow();
  const containerRef = useRef<HTMLDivElement>(null);

  // Pre-compute connected sets for all nodes (once per filter change)
  const connectedMap = useMemo(() => {
    const visibleNodes = showEditorNodes
      ? data.nodes
      : data.nodes.filter((n) => !isEditorOnly(n));
    const visibleNodeIds = new Set(visibleNodes.map((n) => n.id));
    const visibleEdges = data.edges.filter(
      (e) => visibleNodeIds.has(e.source) && visibleNodeIds.has(e.target),
    );
    const map = new Map<string, Set<string>>();
    for (const n of visibleNodes) {
      map.set(n.id, getConnectedNodes(n.id, visibleEdges));
    }
    return map;
  }, [data, showEditorNodes]);

  // Build layout only when filter changes (NOT on hover)
  useEffect(() => {
    const result = buildFlowElements(data, showEditorNodes);
    setNodes(result.nodes);
    setEdges(result.edges);
    setTimeout(() => fitView({ padding: 0.05, duration: 300 }), 50);
  }, [data, showEditorNodes, fitView]);

  // Hover: set CSS data attribute on container (no node rebuild)
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    if (hoveredNodeId) {
      const connected = connectedMap.get(hoveredNodeId);
      if (connected) {
        el.setAttribute('data-hovered', hoveredNodeId);
        el.setAttribute('data-connected', Array.from(connected).join(','));
      }
    } else {
      el.removeAttribute('data-hovered');
      el.removeAttribute('data-connected');
    }
  }, [hoveredNodeId, connectedMap]);

  const onNodeMouseEnter = useCallback((_: React.MouseEvent, node: Node) => {
    if (node.type === 'archNode') setHoveredNodeId(node.id);
  }, []);
  const onNodeMouseLeave = useCallback(() => {
    setHoveredNodeId(null);
  }, []);

  const onNodesChange: OnNodesChange = useCallback((changes) => {
    setNodes((nds) => applyNodeChanges(changes, nds));
  }, []);

  // Build dynamic CSS for highlight/dim based on connected nodes
  const highlightCSS = useMemo(() => {
    if (!hoveredNodeId) return '';
    const connected = connectedMap.get(hoveredNodeId);
    if (!connected) return '';

    const connectedNodeSelectors = Array.from(connected)
      .map((nid) => `[data-id="${nid}"] .arch-node`)
      .join(',\n');

    // Build edge selectors: edges where both source AND target are connected
    const connectedEdgeSelectors: string[] = [];
    for (const e of edges) {
      if (connected.has(e.source) && connected.has(e.target)) {
        connectedEdgeSelectors.push(
          `.react-flow__edge[data-testid="rf__edge-${e.id}"]`
        );
      }
    }
    const edgeSel = connectedEdgeSelectors.join(',\n');

    return `
      /* Dim all nodes */
      .diagram-container[data-hovered] .arch-node {
        opacity: 0.08 !important;
        border-color: transparent !important;
        border-left-color: transparent !important;
        box-shadow: none !important;
        transform: none !important;
        filter: grayscale(1) !important;
      }
      .diagram-container[data-hovered] .layer-band {
        opacity: 0.08 !important;
      }
      /* Dim all edges */
      .diagram-container[data-hovered] .react-flow__edge path {
        opacity: 0.03 !important;
      }
      .diagram-container[data-hovered] .react-flow__edge circle {
        opacity: 0 !important;
      }
      .diagram-container[data-hovered] .react-flow__edge text {
        opacity: 0 !important;
      }
      /* Highlight connected nodes */
      .diagram-container[data-hovered] :is(${connectedNodeSelectors}) {
        opacity: 1 !important;
        filter: none !important;
        border-color: var(--node-accent) !important;
        border-left-color: var(--node-accent) !important;
        background: var(--node-accent-muted) !important;
        box-shadow: 0 0 0 1px var(--node-accent),
                    3px 3px 8px var(--neu-shadow-dark),
                    -3px -3px 8px var(--neu-shadow-light) !important;
      }
      /* Highlight connected edges */
      ${edgeSel ? `.diagram-container[data-hovered] :is(${edgeSel}) path {
        opacity: 0.85 !important;
        stroke-width: 2px !important;
      }
      .diagram-container[data-hovered] :is(${edgeSel}) circle {
        opacity: 0.8 !important;
      }
      .diagram-container[data-hovered] :is(${edgeSel}) text {
        opacity: 0.8 !important;
      }` : ''}
    `;
  }, [hoveredNodeId, connectedMap, edges]);

  return (
    <div ref={containerRef} className="diagram-container" style={{ position: 'relative', width: '100%' }}>
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        flexWrap: 'wrap', gap: '0.5rem', marginBottom: '1rem',
      }}>
        <div className="neu-mood-capsule"
          style={{ display: 'inline-flex', gap: '0.25rem', padding: '0.3rem' }}>
          {[
            { key: true, label: '🔧 全部', title: 'Show all nodes including editor-only' },
            { key: false, label: '🌐 发布', title: 'Show only publish-mode nodes' },
          ].map((opt) => (
            <button key={String(opt.key)}
              className={showEditorNodes === opt.key ? 'neu-mood-item selected' : 'neu-mood-item'}
              onClick={() => setShowEditorNodes(opt.key)}
              title={opt.title}
              style={{
                width: 'auto', height: 'auto', borderRadius: '1rem',
                padding: '0.35rem 0.85rem', fontSize: '0.8rem',
                border: 'none', cursor: 'pointer', fontFamily: 'inherit',
                whiteSpace: 'nowrap', filter: 'none',
              }}>
              {opt.label}
            </button>
          ))}
        </div>
        <p className="diagram-mobile-hint" style={{
          display: 'none', textAlign: 'center', fontSize: '0.75rem',
          color: 'var(--text-muted)', margin: 0,
        }}>👆 捏合缩放 · 拖动平移</p>
      </div>

      <div style={{
        width: '100%', height: '70vh', borderRadius: '1rem', overflow: 'hidden',
        boxShadow: 'inset 6px 6px 10px var(--neu-shadow-dark-strong), inset -6px -6px 10px var(--neu-shadow-light-strong)',
      }}>
        <ReactFlow
          nodes={nodes} edges={edges}
          onNodesChange={onNodesChange}
          onNodeMouseEnter={onNodeMouseEnter}
          onNodeMouseLeave={onNodeMouseLeave}
          nodeTypes={nodeTypes} edgeTypes={edgeTypes}
          fitView fitViewOptions={{ padding: 0.05 }}
          nodesConnectable={false} elementsSelectable={false}
          panOnScroll zoomOnScroll={false} zoomOnPinch
          minZoom={0.3} maxZoom={2}
          proOptions={{ hideAttribution: true }}
          style={{ background: 'var(--neu-bg)' }}
        >
          <Background color="var(--border-subtle)" gap={24} size={1} />
          <Controls showInteractive={false} style={{
            borderRadius: '12px', overflow: 'hidden',
            boxShadow: '4px 4px 8px var(--neu-shadow-dark), -4px -4px 8px var(--neu-shadow-light)',
          }} />
        </ReactFlow>
      </div>

      <style>{`
        /* Base arch node style */
        .arch-node {
          position: relative;
          display: flex; align-items: center; gap: 8px;
          padding: 8px 14px 8px 12px; border-radius: 10px;
          font-size: 12px; font-weight: 600; letter-spacing: 0.01em;
          background: var(--neu-bg);
          color: var(--text-primary);
          border: 1.5px solid var(--node-border);
          border-left: 4px solid var(--node-accent);
          box-shadow: 3px 3px 6px var(--neu-shadow-dark), -3px -3px 6px var(--neu-shadow-light);
          transition: opacity 180ms ease, border-color 180ms ease, background 180ms ease,
                      box-shadow 180ms ease, transform 180ms ease, filter 180ms ease;
          min-width: 130px; white-space: nowrap; overflow: hidden;
          cursor: default;
        }
        .arch-node:hover {
          background: var(--node-accent-muted);
          border-color: var(--node-accent);
          border-left-color: var(--node-accent);
          box-shadow: 0 0 0 1px var(--node-accent),
                      4px 4px 10px var(--neu-shadow-dark),
                      -4px -4px 10px var(--neu-shadow-light);
          transform: translateY(-2px);
        }
        .arch-node.editor-only {
          border-style: dashed;
          border-left-style: solid;
          border-width: 1.5px;
          border-left-width: 4px;
          opacity: 0.7;
        }
        .arch-node-icon { font-size: 14px; flex-shrink: 0; }
        .arch-node-label { }
        .arch-node-dev {
          font-size: 7px; font-weight: 700; margin-left: auto;
          padding: 1px 5px; border-radius: 4px;
          background: var(--node-accent); color: #fff;
          letter-spacing: 0.06em; opacity: 0.85;
        }

        /* Layer band style */
        .layer-band {
          width: 100%; height: 100%; border-radius: 14px;
          border: 1.5px dashed var(--layer-border);
          background: var(--layer-accent-muted);
          transition: opacity 180ms ease;
        }
        .layer-band-badge {
          display: inline-flex; align-items: center; gap: 6px;
          padding: 5px 14px; margin: 10px 0 0 12px;
          border-radius: 10px;
          background: var(--neu-bg);
          border: 1px solid var(--layer-border);
          box-shadow: 2px 2px 4px var(--neu-shadow-dark), -2px -2px 4px var(--neu-shadow-light);
        }
        .layer-band-icon { font-size: 16px; }
        .layer-band-label {
          font-size: 14px; font-weight: 700;
          text-transform: uppercase; letter-spacing: 0.08em;
          color: var(--layer-accent);
        }

        /* Edge default */
        .layered-edge path { transition: opacity 180ms ease, stroke-width 180ms ease; }
        .layered-edge circle { transition: opacity 180ms ease; }

        @media (max-width: 768px) {
          .diagram-mobile-hint { display: block !important; }
        }
        .react-flow__controls button {
          background: var(--neu-bg) !important;
          border: none !important;
          color: var(--text-primary) !important;
          fill: var(--text-primary) !important;
        }
        .react-flow__controls button:hover {
          background: var(--bg-surface) !important;
        }
      `}</style>
      {highlightCSS && <style>{highlightCSS}</style>}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Export with ReactFlowProvider wrapper                              */
/* ------------------------------------------------------------------ */

const DiagramRenderer: FC<DiagramRendererProps> = ({ data, savedLayout, editorMode }) => (
  <ReactFlowProvider>
    <DiagramFlow data={data} savedLayout={savedLayout} editorMode={editorMode} />
  </ReactFlowProvider>
);

export default DiagramRenderer;
