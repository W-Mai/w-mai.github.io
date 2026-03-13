import { useState, useEffect, useCallback, type FC, type CSSProperties } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  type Node,
  type Edge,
  type NodeTypes,
  type NodeProps,
  type EdgeProps,
  Position,
  Handle,
  useReactFlow,
  ReactFlowProvider,
  BaseEdge,
  getSmoothStepPath,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import type { ElkNode, ElkExtendedEdge } from 'elkjs';
import type { ArchitectureData, ArchGroupTheme } from '~/data/architecture';
import { type ViewMode } from '~/lib/diagram-layout';

interface DiagramRendererProps {
  data: ArchitectureData;
}

/* ------------------------------------------------------------------ */
/*  Theme-aware color helpers                                         */
/* ------------------------------------------------------------------ */

const GROUP_THEMES: Record<string, ArchGroupTheme> = {};

function getTheme(groupId: string): ArchGroupTheme {
  return GROUP_THEMES[groupId] ?? {
    accent: '#94a3b8', accentMuted: 'rgba(148,163,184,0.08)',
    border: 'rgba(148,163,184,0.3)', bg: 'rgba(148,163,184,0.04)',
    gradient: 'linear-gradient(135deg, #94a3b8, #cbd5e1)',
  };
}

/* ------------------------------------------------------------------ */
/*  Custom arch node — card with colored left accent bar              */
/* ------------------------------------------------------------------ */

function ArchNodeComponent({ data }: NodeProps) {
  const d = data as {
    label: string; icon: string; url?: string;
    disabled: boolean; navigable: boolean; groupId: string;
  };
  const theme = getTheme(d.groupId);

  const card: CSSProperties = {
    position: 'relative',
    display: 'flex', alignItems: 'center', gap: '8px',
    padding: '10px 16px 10px 14px', borderRadius: '10px',
    fontSize: '13px', fontWeight: 600, letterSpacing: '0.01em',
    cursor: d.navigable ? 'pointer' : 'default',
    background: d.disabled ? 'var(--neu-bg)' : 'var(--bg-surface)',
    color: d.disabled ? 'var(--text-muted)' : 'var(--text-primary)',
    opacity: d.disabled ? 0.4 : 1,
    boxShadow: d.disabled
      ? 'inset 2px 2px 4px var(--neu-shadow-dark-strong), inset -2px -2px 4px var(--neu-shadow-light-strong)'
      : '3px 3px 6px var(--neu-shadow-dark), -3px -3px 6px var(--neu-shadow-light)',
    transition: 'opacity 250ms ease, box-shadow 250ms ease, transform 200ms ease',
    border: 'none', minWidth: '140px', whiteSpace: 'nowrap' as const, overflow: 'hidden',
  };

  const handleClick = () => {
    if (d.navigable && d.url) {
      try { window.location.assign(d.url); } catch { /* noop */ }
    }
  };

  return (
    <div style={card} onClick={handleClick}
      onMouseEnter={(e) => {
        if (!d.disabled) {
          const el = e.currentTarget as HTMLElement;
          el.style.transform = 'translateY(-2px)';
          el.style.boxShadow = '4px 4px 12px var(--neu-shadow-dark), -4px -4px 12px var(--neu-shadow-light)';
        }
      }}
      onMouseLeave={(e) => {
        const el = e.currentTarget as HTMLElement;
        el.style.transform = '';
        el.style.boxShadow = d.disabled
          ? 'inset 2px 2px 4px var(--neu-shadow-dark-strong), inset -2px -2px 4px var(--neu-shadow-light-strong)'
          : '3px 3px 6px var(--neu-shadow-dark), -3px -3px 6px var(--neu-shadow-light)';
      }}
    >
      <Handle type="target" position={Position.Left}
        style={{ background: theme.accent, width: 7, height: 7, border: '2px solid var(--neu-bg)' }} />
      <div style={{
        position: 'absolute', left: 0, top: '20%', bottom: '20%',
        width: '3px', borderRadius: '0 3px 3px 0',
        background: d.disabled ? 'var(--text-muted)' : theme.gradient,
      }} />
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        width: '26px', height: '26px', borderRadius: '6px',
        background: d.disabled ? 'transparent' : theme.accentMuted,
        fontSize: '14px', flexShrink: 0,
      }}><span>{d.icon}</span></div>
      <span>{d.label}</span>
      <Handle type="source" position={Position.Right}
        style={{ background: theme.accent, width: 7, height: 7, border: '2px solid var(--neu-bg)' }} />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Custom group node — colored container with header strip           */
/* ------------------------------------------------------------------ */

function GroupNodeComponent({ data }: NodeProps) {
  const d = data as { label: string; icon: string; disabled: boolean; groupId: string; nodeCount: number };
  const theme = getTheme(d.groupId);

  return (
    <div style={{
      width: '100%', height: '100%', borderRadius: '14px',
      border: `1.5px solid ${d.disabled ? 'var(--border-divider)' : theme.border}`,
      background: d.disabled ? 'transparent' : theme.bg,
      opacity: d.disabled ? 0.5 : 1, transition: 'opacity 250ms ease', overflow: 'hidden',
    }}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 14px',
        borderBottom: `1px solid ${d.disabled ? 'var(--border-divider)' : theme.border}`,
        background: d.disabled ? 'transparent' : theme.accentMuted,
      }}>
        <span style={{ fontSize: '14px' }}>{d.icon}</span>
        <span style={{
          fontSize: '12px', fontWeight: 700, textTransform: 'uppercase' as const,
          letterSpacing: '0.06em', color: d.disabled ? 'var(--text-muted)' : theme.accent,
        }}>{d.label}</span>
        <span style={{
          fontSize: '10px', fontWeight: 600, padding: '1px 6px', borderRadius: '8px',
          background: d.disabled ? 'transparent' : theme.accentMuted,
          color: d.disabled ? 'var(--text-muted)' : theme.accent, marginLeft: 'auto',
        }}>{d.nodeCount}</span>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Custom gradient edge with animated flow dot                       */
/* ------------------------------------------------------------------ */

function GradientEdge({
  id, sourceX, sourceY, targetX, targetY,
  sourcePosition, targetPosition, data, style,
}: EdgeProps) {
  const d = data as { label?: string; disabled?: boolean; sourceAccent?: string; targetAccent?: string } | undefined;
  const disabled = d?.disabled ?? false;
  const gradientId = `edge-gradient-${id}`;

  const [edgePath, labelX, labelY] = getSmoothStepPath({
    sourceX, sourceY, targetX, targetY,
    sourcePosition, targetPosition, borderRadius: 16,
  });

  return (
    <>
      <defs>
        <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor={d?.sourceAccent ?? 'var(--text-muted)'} stopOpacity={disabled ? 0.15 : 0.6} />
          <stop offset="100%" stopColor={d?.targetAccent ?? 'var(--text-muted)'} stopOpacity={disabled ? 0.15 : 0.6} />
        </linearGradient>
      </defs>
      <BaseEdge id={id} path={edgePath} style={{
        ...style, stroke: `url(#${gradientId})`, strokeWidth: disabled ? 1 : 1.5,
      }} />
      {!disabled && (
        <circle r="2.5" fill={d?.sourceAccent ?? 'var(--text-muted)'} opacity="0.8">
          <animateMotion dur="3s" repeatCount="indefinite" path={edgePath} />
        </circle>
      )}
      {d?.label && (
        <g transform={`translate(${labelX}, ${labelY})`}>
          <rect x="-18" y="-9" width="36" height="18" rx="4"
            fill="var(--neu-bg)" fillOpacity="0.9"
            stroke={d?.sourceAccent ?? 'var(--border-divider)'} strokeWidth="0.5" strokeOpacity="0.4" />
          <text textAnchor="middle" dominantBaseline="central"
            style={{ fontSize: '9px', fontWeight: 600, fill: disabled ? 'var(--text-muted)' : 'var(--text-secondary)' }}>
            {d.label}
          </text>
        </g>
      )}
    </>
  );
}

const nodeTypes: NodeTypes = {
  archNode: ArchNodeComponent as any,
  groupNode: GroupNodeComponent as any,
};
const edgeTypes = { gradient: GradientEdge as any };

/* ------------------------------------------------------------------ */
/*  ELK layout engine                                                 */
/* ------------------------------------------------------------------ */

let elkInstance: any = null;
async function getElk() {
  if (!elkInstance) {
    const ELK = (await import('elkjs/lib/elk.bundled.js')).default;
    elkInstance = new ELK();
  }
  return elkInstance;
}
const NODE_W = 170;
const NODE_H = 44;
const GROUP_HEADER_H = 36;

async function computeElkLayout(
  archData: ArchitectureData,
  mode: ViewMode,
): Promise<{ nodes: Node[]; edges: Edge[] }> {
  for (const g of archData.groups) GROUP_THEMES[g.id] = g.theme;

  const getNodeState = (n: { modes: readonly string[] }) =>
    n.modes.includes(mode) ? 'enabled' : 'disabled';

  // Build ELK graph with compound nodes (groups contain children)
  const elkChildren: ElkNode[] = [];
  for (const group of archData.groups) {
    const groupNodes = archData.nodes.filter((n) => n.group === group.id);
    elkChildren.push({
      id: `group-${group.id}`,
      layoutOptions: {
        'elk.padding': `[top=${GROUP_HEADER_H + 14},left=16,bottom=14,right=16]`,
        'elk.spacing.nodeNode': '10',
      },
      children: groupNodes.map((n) => ({
        id: n.id,
        width: NODE_W,
        height: NODE_H,
      })),
    });
  }

  const elkEdges: ElkExtendedEdge[] = archData.edges.map((e) => ({
    id: `${e.source}-${e.target}`,
    sources: [e.source],
    targets: [e.target],
  }));

  const elkGraph: ElkNode = {
    id: 'root',
    layoutOptions: {
      'elk.algorithm': 'layered',
      'elk.direction': 'RIGHT',
      'elk.spacing.nodeNode': '60',
      'elk.layered.spacing.nodeNodeBetweenLayers': '100',
      'elk.spacing.edgeEdge': '20',
      'elk.spacing.edgeNode': '30',
      'elk.layered.spacing.edgeEdgeBetweenLayers': '25',
      'elk.layered.spacing.edgeNodeBetweenLayers': '30',
      'elk.edgeRouting': 'ORTHOGONAL',
      'elk.layered.mergeEdges': 'false',
      'elk.hierarchyHandling': 'INCLUDE_CHILDREN',
    },
    children: elkChildren,
    edges: elkEdges,
  };

  const elk = await getElk();
  const layout = await elk.layout(elkGraph);

  // Convert ELK layout to React Flow nodes
  const nodes: Node[] = [];
  for (const elkGroup of layout.children ?? []) {
    const groupId = elkGroup.id.replace('group-', '');
    const group = archData.groups.find((g) => g.id === groupId);
    if (!group) continue;
    const groupNodes = archData.nodes.filter((n) => n.group === groupId);
    const allDisabled = groupNodes.every((n) => getNodeState(n) === 'disabled');

    nodes.push({
      id: elkGroup.id,
      type: 'groupNode',
      position: { x: elkGroup.x ?? 0, y: elkGroup.y ?? 0 },
      data: { label: group.name, icon: group.icon, disabled: allDisabled, groupId, nodeCount: groupNodes.length },
      style: { width: elkGroup.width, height: elkGroup.height },
      draggable: false, selectable: false,
    });

    for (const elkChild of elkGroup.children ?? []) {
      const archNode = archData.nodes.find((n) => n.id === elkChild.id);
      if (!archNode) continue;
      const disabled = getNodeState(archNode) === 'disabled';
      const navigable = !disabled && typeof archNode.url === 'string' && archNode.url.length > 0;
      nodes.push({
        id: elkChild.id,
        type: 'archNode',
        position: { x: elkChild.x ?? 0, y: elkChild.y ?? 0 },
        parentId: elkGroup.id,
        extent: 'parent' as const,
        data: { label: archNode.name, icon: archNode.icon, url: archNode.url, disabled, navigable, groupId },
        draggable: false,
      });
    }
  }

  // Convert ELK edges to React Flow edges
  const edges: Edge[] = [];
  for (const e of archData.edges) {
    const srcNode = archData.nodes.find((n) => n.id === e.source);
    const tgtNode = archData.nodes.find((n) => n.id === e.target);
    if (!srcNode || !tgtNode) continue;
    const disabled = getNodeState(srcNode) === 'disabled' || getNodeState(tgtNode) === 'disabled';
    const srcTheme = getTheme(srcNode.group);
    const tgtTheme = getTheme(tgtNode.group);

    edges.push({
      id: `${e.source}-${e.target}`,
      source: e.source,
      target: e.target,
      type: 'gradient',
      data: {
        label: e.label, disabled,
        sourceAccent: srcTheme.accent, targetAccent: tgtTheme.accent,
      },
    });
  }

  return { nodes, edges };
}

/* ------------------------------------------------------------------ */
/*  Main flow component with async ELK layout                        */
/* ------------------------------------------------------------------ */

function DiagramFlow({ data }: DiagramRendererProps) {
  const [mode, setMode] = useState<ViewMode>('publish');
  const [nodes, setNodes] = useState<Node[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);
  const { fitView } = useReactFlow();

  useEffect(() => {
    let cancelled = false;
    computeElkLayout(data, mode).then((result) => {
      if (cancelled) return;
      setNodes(result.nodes);
      setEdges(result.edges);
      setTimeout(() => fitView({ padding: 0.12, duration: 300 }), 50);
    });
    return () => { cancelled = true; };
  }, [data, mode, fitView]);

  return (
    <div style={{ position: 'relative', width: '100%' }}>
      {/* Mode switcher */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        flexWrap: 'wrap', gap: '0.5rem', marginBottom: '1rem',
      }}>
        <div className="neu-mood-capsule"
          style={{ display: 'inline-flex', gap: '0.25rem', padding: '0.3rem' }}>
          {(['publish', 'editor'] as const).map((m) => (
            <button key={m}
              className={mode === m ? 'neu-mood-item selected' : 'neu-mood-item'}
              onClick={() => setMode(m)}
              style={{
                padding: '0.4rem 1rem', fontSize: '0.85rem',
                border: 'none', cursor: 'pointer', fontFamily: 'inherit',
              }}>
              {m === 'publish' ? '🌐 Publish' : '✏️ Editor'}
            </button>
          ))}
        </div>
        <p className="diagram-mobile-hint" style={{
          display: 'none', textAlign: 'center', fontSize: '0.75rem',
          color: 'var(--text-muted)', margin: 0,
        }}>👆 捏合缩放 · 拖动平移</p>
      </div>

      {/* React Flow canvas */}
      <div style={{
        width: '100%', height: '70vh', borderRadius: '1rem', overflow: 'hidden',
        boxShadow: 'inset 6px 6px 10px var(--neu-shadow-dark-strong), inset -6px -6px 10px var(--neu-shadow-light-strong)',
      }}>
        <ReactFlow
          nodes={nodes} edges={edges}
          nodeTypes={nodeTypes} edgeTypes={edgeTypes}
          fitView fitViewOptions={{ padding: 0.12 }}
          nodesDraggable={false} nodesConnectable={false} elementsSelectable={false}
          panOnScroll zoomOnScroll={false} zoomOnPinch
          minZoom={0.2} maxZoom={2}
          proOptions={{ hideAttribution: true }}
          style={{ background: 'var(--neu-bg)' }}
        >
          <Background color="var(--border-subtle)" gap={24} size={1} />
          <Controls showInteractive={false} style={{
            borderRadius: '12px', overflow: 'hidden',
            boxShadow: '4px 4px 8px var(--neu-shadow-dark), -4px -4px 8px var(--neu-shadow-light)',
          }} />
          <MiniMap
            nodeColor={(n) => {
              if (n.type === 'groupNode') return 'transparent';
              const gId = (n.data as any)?.groupId;
              const t = gId ? getTheme(gId) : null;
              if ((n.data as any)?.disabled) return 'var(--text-muted)';
              return t?.accent ?? 'var(--text-primary)';
            }}
            maskColor="var(--neu-bg)"
            style={{
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

const DiagramRenderer: FC<DiagramRendererProps> = ({ data }) => (
  <ReactFlowProvider>
    <DiagramFlow data={data} />
  </ReactFlowProvider>
);

export default DiagramRenderer;
