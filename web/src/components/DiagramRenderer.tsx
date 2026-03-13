import { useState, useCallback, useMemo, useEffect, type FC, type CSSProperties } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  type Node,
  type Edge,
  type NodeTypes,
  type NodeProps,
  Position,
  Handle,
  useReactFlow,
  ReactFlowProvider,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import type { ArchitectureData } from '~/data/architecture';
import { type ViewMode } from '~/lib/diagram-layout';

interface DiagramRendererProps {
  data: ArchitectureData;
}

// Custom node component for architecture nodes
function ArchNodeComponent({ data }: NodeProps) {
  const d = data as {
    label: string; icon: string; url?: string;
    disabled: boolean; navigable: boolean;
  };
  const style: CSSProperties = {
    padding: '8px 16px',
    borderRadius: '10px',
    fontSize: '13px',
    fontWeight: 500,
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    cursor: d.navigable ? 'pointer' : 'default',
    background: d.disabled ? 'var(--neu-bg)' : 'var(--bg-surface)',
    color: d.disabled ? 'var(--text-muted)' : 'var(--text-primary)',
    opacity: d.disabled ? 0.5 : 1,
    boxShadow: d.disabled
      ? 'inset 2px 2px 4px var(--neu-shadow-dark-strong), inset -2px -2px 4px var(--neu-shadow-light-strong)'
      : '4px 4px 8px var(--neu-shadow-dark), -4px -4px 8px var(--neu-shadow-light)',
    transition: 'opacity 250ms ease, box-shadow 250ms ease, transform 200ms ease',
    border: 'none',
    minWidth: '120px',
    whiteSpace: 'nowrap',
  };

  const handleClick = () => {
    if (d.navigable && d.url) {
      try { window.location.assign(d.url); } catch { /* noop */ }
    }
  };

  return (
    <div style={style} onClick={handleClick}
      onMouseEnter={(e) => {
        if (d.navigable) (e.currentTarget as HTMLElement).style.transform = 'translateY(-2px)';
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLElement).style.transform = '';
      }}
    >
      <Handle type="target" position={Position.Left} style={{ background: 'var(--text-muted)', width: 6, height: 6, border: 'none' }} />
      <span>{d.icon}</span>
      <span>{d.label}</span>
      <Handle type="source" position={Position.Right} style={{ background: 'var(--text-muted)', width: 6, height: 6, border: 'none' }} />
    </div>
  );
}

// Custom group node
function GroupNodeComponent({ data }: NodeProps) {
  const d = data as { label: string; icon: string; disabled: boolean };
  return (
    <div style={{
      padding: '8px 16px',
      borderRadius: '16px',
      border: `2px dashed ${d.disabled ? 'var(--text-muted)' : 'var(--border-divider)'}`,
      background: 'transparent',
      width: '100%',
      height: '100%',
      opacity: d.disabled ? 0.5 : 1,
      transition: 'opacity 250ms ease',
    }}>
      <div style={{
        fontSize: '14px', fontWeight: 700,
        color: d.disabled ? 'var(--text-muted)' : 'var(--text-heading)',
        marginBottom: '4px',
      }}>
        {d.icon} {d.label}
      </div>
    </div>
  );
}

const nodeTypes: NodeTypes = {
  archNode: ArchNodeComponent as any,
  groupNode: GroupNodeComponent as any,
};

// Layout constants for positioning
const NODE_W = 160;
const NODE_H = 40;
const NODE_GAP_Y = 14;
const GROUP_PAD_X = 20;
const GROUP_PAD_TOP = 40;
const GROUP_PAD_BOTTOM = 20;
const GROUP_GAP_X = 80;
const GROUP_GAP_Y = 40;

// Group layout: rows of groups, left-to-right flow
const GROUP_ROWS: string[][] = [
  ['pages', 'editor', 'api', 'data'],
  ['build'],
];

function buildFlowData(archData: ArchitectureData, mode: ViewMode) {
  const nodes: Node[] = [];
  const edges: Edge[] = [];
  const getNodeState = (n: { modes: readonly string[] }) => n.modes.includes(mode) ? 'enabled' : 'disabled';

  let groupX = 0;
  let groupY = 0;

  for (const row of GROUP_ROWS) {
    let maxRowHeight = 0;
    let rowX = groupX;

    for (const groupId of row) {
      const group = archData.groups.find((g) => g.id === groupId);
      if (!group) continue;
      const groupNodes = archData.nodes.filter((n) => n.group === groupId);
      const contentH = groupNodes.length * (NODE_H + NODE_GAP_Y) - NODE_GAP_Y;
      const gW = NODE_W + GROUP_PAD_X * 2;
      const gH = GROUP_PAD_TOP + contentH + GROUP_PAD_BOTTOM;
      const allDisabled = groupNodes.every((n) => getNodeState(n) === 'disabled');

      // Group node (parent)
      nodes.push({
        id: `group-${groupId}`,
        type: 'groupNode',
        position: { x: rowX, y: groupY },
        data: { label: group.name, icon: group.icon, disabled: allDisabled },
        style: { width: gW, height: gH },
        draggable: false,
        selectable: false,
      });

      // Child nodes
      groupNodes.forEach((n, i) => {
        const disabled = getNodeState(n) === 'disabled';
        const navigable = !disabled && typeof n.url === 'string' && n.url.length > 0;
        nodes.push({
          id: n.id,
          type: 'archNode',
          position: { x: GROUP_PAD_X, y: GROUP_PAD_TOP + i * (NODE_H + NODE_GAP_Y) },
          parentId: `group-${groupId}`,
          extent: 'parent' as const,
          data: { label: n.name, icon: n.icon, url: n.url, disabled, navigable },
          draggable: false,
        });
      });

      rowX += gW + GROUP_GAP_X;
      maxRowHeight = Math.max(maxRowHeight, gH);
    }

    groupY += maxRowHeight + GROUP_GAP_Y;
  }

  // Edges
  for (const e of archData.edges) {
    const srcNode = archData.nodes.find((n) => n.id === e.source);
    const tgtNode = archData.nodes.find((n) => n.id === e.target);
    if (!srcNode || !tgtNode) continue;
    const srcDisabled = getNodeState(srcNode) === 'disabled';
    const tgtDisabled = getNodeState(tgtNode) === 'disabled';
    const disabled = srcDisabled || tgtDisabled;

    edges.push({
      id: `${e.source}-${e.target}`,
      source: e.source,
      target: e.target,
      type: 'smoothstep',
      animated: !disabled,
      label: e.label,
      style: {
        stroke: 'var(--text-muted)',
        strokeWidth: 1.5,
        opacity: disabled ? 0.2 : 0.6,
      },
      labelStyle: {
        fontSize: 10,
        fill: 'var(--text-muted)',
      },
      labelBgStyle: {
        fill: 'var(--neu-bg)',
        fillOpacity: 0.8,
      },
    });
  }

  return { nodes, edges };
}

function DiagramFlow({ data }: DiagramRendererProps) {
  const [mode, setMode] = useState<ViewMode>('publish');
  const { fitView } = useReactFlow();
  const { nodes, edges } = useMemo(() => buildFlowData(data, mode), [data, mode]);

  useEffect(() => {
    setTimeout(() => fitView({ padding: 0.1, duration: 300 }), 50);
  }, [mode, fitView]);

  return (
    <div style={{ position: 'relative', width: '100%' }}>
      {/* Control panel */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        flexWrap: 'wrap', gap: '0.5rem', marginBottom: '1rem',
      }}>
        <div className="neu-mood-capsule" style={{ display: 'inline-flex', gap: '0.25rem', padding: '0.3rem' }}>
          {(['publish', 'editor'] as const).map((m) => (
            <button
              key={m}
              className={mode === m ? 'neu-mood-item selected' : 'neu-mood-item'}
              onClick={() => setMode(m)}
              style={{ padding: '0.4rem 1rem', fontSize: '0.85rem', border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}
            >
              {m === 'publish' ? '🌐 Publish' : '✏️ Editor'}
            </button>
          ))}
        </div>
        <p className="diagram-mobile-hint" style={{
          display: 'none', textAlign: 'center', fontSize: '0.75rem',
          color: 'var(--text-muted)', margin: 0,
        }}>
          👆 捏合缩放 · 拖动平移
        </p>
      </div>

      {/* React Flow canvas */}
      <div style={{
        width: '100%', height: '70vh', borderRadius: '1rem', overflow: 'hidden',
        boxShadow: 'inset 6px 6px 10px var(--neu-shadow-dark-strong), inset -6px -6px 10px var(--neu-shadow-light-strong)',
      }}>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          fitView
          fitViewOptions={{ padding: 0.1 }}
          nodesDraggable={false}
          nodesConnectable={false}
          elementsSelectable={false}
          panOnScroll
          zoomOnScroll={false}
          zoomOnPinch
          minZoom={0.2}
          maxZoom={2}
          proOptions={{ hideAttribution: true }}
          style={{ background: 'var(--neu-bg)' }}
        >
          <Background color="var(--border-subtle)" gap={20} size={1} />
          <Controls
            showInteractive={false}
            style={{ borderRadius: '12px', overflow: 'hidden',
              boxShadow: '4px 4px 8px var(--neu-shadow-dark), -4px -4px 8px var(--neu-shadow-light)',
            }}
          />
          <MiniMap
            nodeColor={(n) => {
              if (n.type === 'groupNode') return 'transparent';
              return (n.data as any)?.disabled ? 'var(--text-muted)' : 'var(--text-primary)';
            }}
            maskColor="var(--neu-bg)"
            style={{ borderRadius: '12px', overflow: 'hidden',
              boxShadow: '4px 4px 8px var(--neu-shadow-dark), -4px -4px 8px var(--neu-shadow-light)',
            }}
          />
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
