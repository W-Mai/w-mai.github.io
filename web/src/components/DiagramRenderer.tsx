import { useState, useEffect, useCallback, type FC, type CSSProperties } from 'react';
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
import { getConnectedNodes, isEditorOnly, isNavigable, LAYOUT } from '~/lib/diagram-layout';

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
    accent: '#94a3b8',
    accentMuted: 'rgba(148,163,184,0.08)',
    border: 'rgba(148,163,184,0.3)',
  };
}

/* ------------------------------------------------------------------ */
/*  Arch node component                                               */
/* ------------------------------------------------------------------ */

function ArchNodeComponent({ data }: NodeProps) {
  const d = data as {
    label: string; icon: string; url?: string;
    layerId: string; editorOnly: boolean;
    highlighted: boolean; dimmed: boolean;
    navigable: boolean;
  };
  const theme = getLayerTheme(d.layerId);

  const card: CSSProperties = {
    position: 'relative',
    display: 'flex', alignItems: 'center', gap: '8px',
    padding: '6px 12px', borderRadius: '6px',
    fontSize: '11px', fontWeight: 500, letterSpacing: '0.01em',
    cursor: d.navigable ? 'pointer' : 'default',
    background: d.highlighted ? theme.accentMuted : 'transparent',
    color: d.dimmed ? 'var(--text-muted)' : 'var(--text-primary)',
    opacity: d.dimmed ? 0.25 : 1,
    border: d.editorOnly
      ? `1.5px dashed ${d.dimmed ? 'var(--border-divider)' : theme.border}`
      : `1px solid ${d.dimmed ? 'var(--border-divider)' : theme.border}`,
    transition: 'opacity 200ms ease, border-color 200ms ease, background 200ms ease',
    minWidth: '120px', whiteSpace: 'nowrap' as const, overflow: 'hidden',
  };

  const handleClick = () => {
    if (d.navigable && d.url) {
      try { window.location.assign(d.url); } catch { /* noop */ }
    }
  };

  const hs: CSSProperties = {
    background: 'var(--neu-bg)', width: 5, height: 5,
    border: `1.5px solid ${theme.accent}`,
  };

  return (
    <div style={card} onClick={handleClick}
      onMouseEnter={(e) => {
        if (!d.dimmed) {
          (e.currentTarget as HTMLElement).style.background = theme.accentMuted;
          (e.currentTarget as HTMLElement).style.borderColor = theme.accent;
        }
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLElement).style.background = d.highlighted ? theme.accentMuted : 'transparent';
        (e.currentTarget as HTMLElement).style.borderColor = d.dimmed ? 'var(--border-divider)' : theme.border;
      }}
    >
      <Handle type="target" position={Position.Top} style={{ ...hs, left: '50%' }} />
      <span style={{ fontSize: '13px', flexShrink: 0, opacity: d.dimmed ? 0.4 : 0.8 }}>{d.icon}</span>
      <span>{d.label}</span>
      {d.editorOnly && <span style={{ fontSize: '8px', opacity: 0.5, marginLeft: '2px' }}>DEV</span>}
      <Handle type="source" position={Position.Bottom} style={{ ...hs, left: '50%' }} />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Layer band component (background row for each layer)              */
/* ------------------------------------------------------------------ */

function LayerBandComponent({ data }: NodeProps) {
  const d = data as { label: string; icon: string; layerId: string; dimmed: boolean };
  const theme = getLayerTheme(d.layerId);

  return (
    <div style={{
      width: '100%', height: '100%', borderRadius: '8px',
      border: `1px dashed ${d.dimmed ? 'var(--border-divider)' : theme.border}`,
      background: 'transparent',
      opacity: d.dimmed ? 0.3 : 1,
      transition: 'opacity 200ms ease',
    }}>
      <div style={{
        display: 'inline-flex', alignItems: 'center', gap: '4px',
        padding: '3px 8px', margin: '6px 0 0 8px',
        borderRadius: '4px', background: theme.accentMuted,
        border: `1px solid ${d.dimmed ? 'var(--border-divider)' : theme.border}`,
      }}>
        <span style={{ fontSize: '10px' }}>{d.icon}</span>
        <span style={{
          fontSize: '9px', fontWeight: 700, textTransform: 'uppercase' as const,
          letterSpacing: '0.08em', color: d.dimmed ? 'var(--text-muted)' : theme.accent,
        }}>{d.label}</span>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Custom edge with arrow marker                                     */
/* ------------------------------------------------------------------ */

function LayeredEdge({ id, sourceX, sourceY, targetX, targetY, data }: EdgeProps) {
  const d = data as { label?: string; dimmed?: boolean; color?: string } | undefined;
  const dimmed = d?.dimmed ?? false;
  const color = d?.color ?? '#94a3b8';
  const markerId = `arrow-${id.replace(/[^a-zA-Z0-9]/g, '_')}`;

  // Vertical-first orthogonal path: down from source, horizontal, then down to target
  const midY = (sourceY + targetY) / 2;
  const r = Math.min(8, Math.abs(targetY - sourceY) / 4, Math.abs(targetX - sourceX) / 2 || 999);

  let edgePath: string;
  if (Math.abs(targetX - sourceX) < 1) {
    // Straight vertical
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
    <>
      <defs>
        <marker id={markerId} markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto">
          <path d="M 0 0 L 8 3 L 0 6 Z" fill={color} opacity={dimmed ? 0.15 : 0.5} />
        </marker>
      </defs>
      <path d={edgePath} fill="none"
        stroke={color}
        strokeWidth={dimmed ? 0.6 : 1}
        strokeDasharray={dimmed ? '4 3' : 'none'}
        opacity={dimmed ? 0.12 : 0.4}
        markerEnd={`url(#${markerId})`}
      />
      {!dimmed && (
        <circle r="1.2" fill={color} opacity="0.6">
          <animateMotion dur="3s" repeatCount="indefinite" path={edgePath} />
        </circle>
      )}
      {d?.label && (
        <g transform={`translate(${(sourceX + targetX) / 2}, ${midY})`}>
          <text textAnchor="middle" dominantBaseline="central"
            style={{ fontSize: '7px', fontWeight: 500, fill: color, opacity: dimmed ? 0.2 : 0.6 }}>
            {d.label}
          </text>
        </g>
      )}
    </>
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
/*  Auto-layout: arrange nodes in horizontal rows per layer           */
/* ------------------------------------------------------------------ */

const { layerPadX, layerPadTop, layerPadBottom, layerGapY, nodeWidth, nodeHeight, nodeGapX, nodeGapY, layerHeaderHeight } = LAYOUT;

function computeAutoLayout(archData: ArchitectureData): {
  layerBands: { layerDef: ArchLayerDef; x: number; y: number; w: number; h: number }[];
  nodePositions: Record<string, { x: number; y: number }>;
} {
  const layerBands: { layerDef: ArchLayerDef; x: number; y: number; w: number; h: number }[] = [];
  const nodePositions: Record<string, { x: number; y: number }> = {};

  // Max nodes per row within a layer
  const MAX_PER_ROW = 8;
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

  // Center narrower bands
  for (const band of layerBands) {
    const offset = (maxWidth - band.w) / 2;
    band.x = offset;
    const layerNodes = archData.nodes.filter((n) => n.layer === band.layerDef.id);
    for (const node of layerNodes) {
      if (nodePositions[node.id]) {
        nodePositions[node.id].x += offset;
      }
    }
    band.w = maxWidth;
  }

  return { layerBands, nodePositions };
}

/* ------------------------------------------------------------------ */
/*  Build ReactFlow nodes + edges                                     */
/* ------------------------------------------------------------------ */

function buildFlowElements(
  archData: ArchitectureData,
  hoveredNodeId: string | null,
  showEditorNodes: boolean,
): { nodes: Node[]; edges: Edge[] } {
  // Populate layer themes
  for (const l of archData.layers) {
    LAYER_THEMES[l.id] = { accent: l.accent, accentMuted: l.accentMuted, border: l.border };
  }

  // Filter nodes based on editor mode toggle
  const visibleNodes = showEditorNodes
    ? archData.nodes
    : archData.nodes.filter((n) => !isEditorOnly(n));

  // Filter edges to only include those between visible nodes
  const visibleNodeIds = new Set(visibleNodes.map((n) => n.id));
  const visibleEdges = archData.edges.filter(
    (e) => visibleNodeIds.has(e.source) && visibleNodeIds.has(e.target),
  );

  // Compute connected set for hover highlight
  const connectedSet = hoveredNodeId
    ? getConnectedNodes(hoveredNodeId, visibleEdges)
    : null;

  // Build a filtered ArchitectureData for layout computation
  const filteredData: ArchitectureData = {
    layers: archData.layers,
    nodes: visibleNodes,
    edges: visibleEdges,
  };
  const { layerBands, nodePositions } = computeAutoLayout(filteredData);

  const nodes: Node[] = [];
  const edges: Edge[] = [];

  // Layer band nodes
  for (const band of layerBands) {
    const dimmed = connectedSet !== null;
    nodes.push({
      id: `layer-${band.layerDef.id}`,
      type: 'layerBand',
      position: { x: band.x, y: band.y },
      data: {
        label: band.layerDef.name, icon: band.layerDef.icon,
        layerId: band.layerDef.id, dimmed,
      },
      style: { width: band.w, height: band.h },
      draggable: false, selectable: false,
      zIndex: -1,
    });
  }

  // Arch nodes (positioned relative to their layer band)
  for (const archNode of visibleNodes) {
    const band = layerBands.find((b) => b.layerDef.id === archNode.layer);
    if (!band) continue;
    const pos = nodePositions[archNode.id];
    if (!pos) continue;

    const highlighted = connectedSet !== null && connectedSet.has(archNode.id);
    const dimmed = connectedSet !== null && !connectedSet.has(archNode.id);

    nodes.push({
      id: archNode.id,
      type: 'archNode',
      position: { x: pos.x, y: pos.y },
      parentId: `layer-${archNode.layer}`,
      extent: 'parent' as const,
      data: {
        label: archNode.name, icon: archNode.icon, url: archNode.url,
        layerId: archNode.layer, editorOnly: isEditorOnly(archNode),
        highlighted, dimmed,
        navigable: !dimmed && isNavigable(archNode),
      },
      draggable: false,
      zIndex: 1,
    });
  }

  // Edges
  for (const archEdge of visibleEdges) {
    const srcNode = visibleNodes.find((n) => n.id === archEdge.source);
    if (!srcNode) continue;
    const theme = getLayerTheme(srcNode.layer);
    const dimmed = connectedSet !== null &&
      !(connectedSet.has(archEdge.source) && connectedSet.has(archEdge.target));

    edges.push({
      id: `${archEdge.source}->${archEdge.target}`,
      source: archEdge.source,
      target: archEdge.target,
      type: 'layered',
      data: { label: archEdge.label, dimmed, color: theme.accent },
      zIndex: dimmed ? 0 : 2,
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

  // Rebuild layout when filter or hover changes
  useEffect(() => {
    const result = buildFlowElements(data, hoveredNodeId, showEditorNodes);
    setNodes(result.nodes);
    setEdges(result.edges);
  }, [data, hoveredNodeId, showEditorNodes]);

  // Fit view on filter change (not on hover)
  const prevShowEditor = usePrevious(showEditorNodes);
  useEffect(() => {
    if (prevShowEditor !== undefined && prevShowEditor !== showEditorNodes) {
      setTimeout(() => fitView({ padding: 0.1, duration: 300 }), 50);
    }
  }, [showEditorNodes, fitView, prevShowEditor]);

  // Initial fit
  useEffect(() => {
    setTimeout(() => fitView({ padding: 0.1, duration: 300 }), 100);
  }, [fitView]);

  // Hover detection via node mouse events
  const onNodeMouseEnter = useCallback((_: React.MouseEvent, node: Node) => {
    if (node.type === 'archNode') setHoveredNodeId(node.id);
  }, []);
  const onNodeMouseLeave = useCallback(() => {
    setHoveredNodeId(null);
  }, []);

  const onNodesChange: OnNodesChange = useCallback((changes) => {
    setNodes((nds) => applyNodeChanges(changes, nds));
  }, []);

  return (
    <div style={{ position: 'relative', width: '100%' }}>
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        flexWrap: 'wrap', gap: '0.5rem', marginBottom: '1rem',
      }}>
        <div className="neu-mood-capsule"
          style={{ display: 'inline-flex', gap: '0.25rem', padding: '0.3rem' }}>
          {[
            { key: true, label: '🔧 All (Dev)', title: 'Show all nodes including editor-only' },
            { key: false, label: '🌐 Publish', title: 'Show only publish-mode nodes' },
          ].map((opt) => (
            <button key={String(opt.key)}
              className={showEditorNodes === opt.key ? 'neu-mood-item selected' : 'neu-mood-item'}
              onClick={() => setShowEditorNodes(opt.key)}
              title={opt.title}
              style={{
                padding: '0.4rem 1rem', fontSize: '0.85rem',
                border: 'none', cursor: 'pointer', fontFamily: 'inherit',
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
          fitView fitViewOptions={{ padding: 0.1 }}
          nodesConnectable={false} elementsSelectable={false}
          panOnScroll zoomOnScroll={false} zoomOnPinch
          minZoom={0.15} maxZoom={2}
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
        .react-flow__minimap {
          background: var(--neu-bg) !important;
        }
      `}</style>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  usePrevious hook                                                  */
/* ------------------------------------------------------------------ */

function usePrevious<T>(value: T): T | undefined {
  const [prev, setPrev] = useState<T | undefined>(undefined);
  const [current, setCurrent] = useState(value);
  if (value !== current) {
    setPrev(current);
    setCurrent(value);
  }
  return prev;
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
