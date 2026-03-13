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
  type OnNodesChange,
  Position,
  Handle,
  useReactFlow,
  ReactFlowProvider,
  BaseEdge,
  applyNodeChanges,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import type { ArchitectureData, ArchGroupTheme, DiagramLayoutData } from '~/data/architecture';
import type { ViewMode } from '~/lib/diagram-layout';

interface DiagramRendererProps {
  data: ArchitectureData;
  savedLayout?: DiagramLayoutData;
  editorMode?: boolean;
}

const GROUP_THEMES: Record<string, ArchGroupTheme> = {};

function getTheme(groupId: string): ArchGroupTheme {
  return GROUP_THEMES[groupId] ?? {
    accent: '#94a3b8', accentMuted: 'rgba(148,163,184,0.08)',
    border: 'rgba(148,163,184,0.3)', bg: 'rgba(148,163,184,0.04)',
    gradient: 'linear-gradient(135deg, #94a3b8, #cbd5e1)',
  };
}

/* ------------------------------------------------------------------ */
/*  Arch node                                                         */
/* ------------------------------------------------------------------ */

function ArchNodeComponent({ data }: NodeProps) {
  const d = data as {
    label: string; icon: string; url?: string;
    disabled: boolean; navigable: boolean; groupId: string;
    sourceHandles: string[]; targetHandles: string[];
    intraSourceHandles: string[]; intraTargetHandles: string[];
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

  const srcHandles = d.sourceHandles ?? [];
  const tgtHandles = d.targetHandles ?? [];

  const getOffsets = (count: number) => {
    if (count <= 1) return ['50%'];
    const step = 60 / (count + 1);
    return Array.from({ length: count }, (_, i) => `${20 + step * (i + 1)}%`);
  };

  const srcOffsets = getOffsets(srcHandles.length);
  const tgtOffsets = getOffsets(tgtHandles.length);

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
      {tgtHandles.map((hId, i) => (
        <Handle key={hId} id={hId} type="target" position={Position.Left}
          style={{ background: theme.accent, width: 6, height: 6, border: '2px solid var(--neu-bg)', top: tgtOffsets[i] }} />
      ))}
      {tgtHandles.length === 0 && (
        <Handle type="target" position={Position.Left}
          style={{ background: theme.accent, width: 6, height: 6, border: '2px solid var(--neu-bg)' }} />
      )}

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

      {srcHandles.map((hId, i) => (
        <Handle key={hId} id={hId} type="source" position={Position.Right}
          style={{ background: theme.accent, width: 6, height: 6, border: '2px solid var(--neu-bg)', top: srcOffsets[i] }} />
      ))}
      {srcHandles.length === 0 && (
        <Handle type="source" position={Position.Right}
          style={{ background: theme.accent, width: 6, height: 6, border: '2px solid var(--neu-bg)' }} />
      )}

      {/* Left handles for intra-group source (near bottom of node) */}
      {(d.intraSourceHandles ?? []).map((hId, i, arr) => {
        const baseTop = 75;
        const step = arr.length > 1 ? 15 / arr.length : 0;
        return (
          <Handle key={hId} id={hId} type="source" position={Position.Left}
            style={{ background: theme.accent, width: 5, height: 5, border: '2px solid var(--neu-bg)', top: `${baseTop + i * step}%` }} />
        );
      })}
      {/* Left handles for intra-group target (near top of node) */}
      {(d.intraTargetHandles ?? []).map((hId, i, arr) => {
        const baseTop = 25;
        const step = arr.length > 1 ? 15 / arr.length : 0;
        return (
          <Handle key={hId} id={hId} type="target" position={Position.Left}
            style={{ background: theme.accent, width: 5, height: 5, border: '2px solid var(--neu-bg)', top: `${baseTop + i * step}%` }} />
        );
      })}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Group node                                                        */
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
/*  Custom orthogonal edge with FrameworkDrawer-style offset           */
/* ------------------------------------------------------------------ */

function ColoredEdge({ id, sourceX, sourceY, targetX, targetY, data, style }: EdgeProps) {
  const d = data as {
    label?: string; disabled?: boolean; color?: string;
    midXOffset?: number; intraGroup?: boolean; bypassK?: number;
  } | undefined;
  const disabled = d?.disabled ?? false;
  const color = d?.color ?? '#94a3b8';
  const offset = d?.midXOffset ?? 0;
  const intraGroup = d?.intraGroup ?? false;

  let edgePath: string;

  if (intraGroup) {
    // FrameworkDrawer algorithm: route left out → down → left back in
    // bypassK = per-source offset distance (BASE + edgeIndex * STEP)
    const k = d?.bypassK ?? 30;
    const bypassX = Math.min(sourceX, targetX) - k;
    const r = 8;
    const dirY = targetY > sourceY ? 1 : -1;
    edgePath = [
      `M ${sourceX} ${sourceY}`,
      `L ${bypassX + r} ${sourceY}`,
      `Q ${bypassX} ${sourceY} ${bypassX} ${sourceY + r * dirY}`,
      `L ${bypassX} ${targetY - r * dirY}`,
      `Q ${bypassX} ${targetY} ${bypassX + r} ${targetY}`,
      `L ${targetX} ${targetY}`,
    ].join(' ');
  } else if (Math.abs(targetY - sourceY) < 1) {
    edgePath = `M ${sourceX} ${sourceY} L ${targetX} ${targetY}`;
  } else {
    const midX = (sourceX + targetX) / 2 + offset;
    const r = Math.min(10, Math.abs(targetY - sourceY) / 2, Math.abs(midX - sourceX), Math.abs(targetX - midX));
    const dirY = targetY > sourceY ? 1 : -1;
    edgePath = [
      `M ${sourceX} ${sourceY}`,
      `L ${midX - r} ${sourceY}`,
      `Q ${midX} ${sourceY} ${midX} ${sourceY + r * dirY}`,
      `L ${midX} ${targetY - r * dirY}`,
      `Q ${midX} ${targetY} ${midX + r} ${targetY}`,
      `L ${targetX} ${targetY}`,
    ].join(' ');
  }

  const labelX = intraGroup ? Math.min(sourceX, targetX) - (d?.bypassK ?? 30) - 20 : (sourceX + targetX) / 2 + offset;
  const labelY = (sourceY + targetY) / 2;

  return (
    <>
      <BaseEdge id={id} path={edgePath} style={{
        ...style, stroke: color,
        strokeWidth: disabled ? 1 : 1.5,
        opacity: disabled ? 0.15 : 0.5,
      }} />
      {!disabled && (
        <circle r="2" fill={color} opacity="0.9">
          <animateMotion dur="3s" repeatCount="indefinite" path={edgePath} />
        </circle>
      )}
      {d?.label && (
        <g transform={`translate(${labelX}, ${labelY})`}>
          <rect x="-18" y="-9" width="36" height="18" rx="4"
            fill="var(--neu-bg)" fillOpacity="0.9"
            stroke={color} strokeWidth="0.5" strokeOpacity="0.3" />
          <text textAnchor="middle" dominantBaseline="central"
            style={{ fontSize: '9px', fontWeight: 600, fill: color, opacity: disabled ? 0.4 : 0.8 }}>
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
const edgeTypes = { colored: ColoredEdge as any };

/* ------------------------------------------------------------------ */
/*  Layout: build nodes + edges from arch data + saved positions      */
/* ------------------------------------------------------------------ */

const NODE_W = 170;
const NODE_H = 44;
const NODE_GAP = 10;
const GROUP_PAD = 16;
const GROUP_HEADER_H = 36;
const DEFAULT_COL_GAP = 100;
const DEFAULT_ROW_GAP = 50;

// Default grid for initial layout when no saved positions exist
const DEFAULT_GRID: { id: string; col: number; row: number }[] = [
  { id: 'pages', col: 0, row: 0 },
  { id: 'data', col: 1, row: 0 },
  { id: 'editor', col: 0, row: 1 },
  { id: 'api', col: 1, row: 1 },
  { id: 'build', col: 1, row: 2 },
];

function computeGroupSize(archData: ArchitectureData, groupId: string) {
  const count = archData.nodes.filter((n) => n.group === groupId).length;
  const contentH = count * NODE_H + Math.max(0, count - 1) * NODE_GAP;
  return {
    w: NODE_W + GROUP_PAD * 2,
    h: GROUP_HEADER_H + GROUP_PAD + contentH + GROUP_PAD,
    count,
  };
}

/** Generate default group positions from grid layout */
function defaultGroupPositions(archData: ArchitectureData): Record<string, { x: number; y: number }> {
  const sizes = new Map<string, { w: number; h: number }>();
  for (const g of archData.groups) {
    const s = computeGroupSize(archData, g.id);
    sizes.set(g.id, { w: s.w, h: s.h });
  }

  const rowHeights = new Map<number, number>();
  const colWidths = new Map<number, number>();
  for (const cell of DEFAULT_GRID) {
    const s = sizes.get(cell.id);
    if (!s) continue;
    rowHeights.set(cell.row, Math.max(rowHeights.get(cell.row) ?? 0, s.h));
    colWidths.set(cell.col, Math.max(colWidths.get(cell.col) ?? 0, s.w));
  }

  const colX = new Map<number, number>();
  let cx = 0;
  for (let c = 0; c <= Math.max(...colWidths.keys()); c++) {
    colX.set(c, cx);
    cx += (colWidths.get(c) ?? 0) + DEFAULT_COL_GAP;
  }

  const rowY = new Map<number, number>();
  let ry = 0;
  for (let r = 0; r <= Math.max(...rowHeights.keys()); r++) {
    rowY.set(r, ry);
    ry += (rowHeights.get(r) ?? 0) + DEFAULT_ROW_GAP;
  }

  const positions: Record<string, { x: number; y: number }> = {};
  for (const cell of DEFAULT_GRID) {
    positions[cell.id] = { x: colX.get(cell.col) ?? 0, y: rowY.get(cell.row) ?? 0 };
  }
  return positions;
}

function buildLayout(
  archData: ArchitectureData,
  mode: ViewMode,
  groupPositions: Record<string, { x: number; y: number }>,
): { nodes: Node[]; edges: Edge[] } {
  for (const g of archData.groups) GROUP_THEMES[g.id] = g.theme;

  const getNodeState = (n: { modes: readonly string[] }) =>
    n.modes.includes(mode) ? 'enabled' : 'disabled';

  // Pre-compute handle assignments per node
  // Separate maps for inter-group (right/left) and intra-group (bottom/top) handles
  const srcMap = new Map<string, string[]>();
  const tgtMap = new Map<string, string[]>();
  const intraSrcMap = new Map<string, string[]>();
  const intraTgtMap = new Map<string, string[]>();

  for (const e of archData.edges) {
    const srcNode = archData.nodes.find((n) => n.id === e.source);
    const tgtNode = archData.nodes.find((n) => n.id === e.target);
    if (!srcNode || !tgtNode) continue;

    if (srcNode.group === tgtNode.group) {
      if (!intraSrcMap.has(e.source)) intraSrcMap.set(e.source, []);
      if (!intraTgtMap.has(e.target)) intraTgtMap.set(e.target, []);
      intraSrcMap.get(e.source)!.push(`isrc-${intraSrcMap.get(e.source)!.length}`);
      intraTgtMap.get(e.target)!.push(`itgt-${intraTgtMap.get(e.target)!.length}`);
    } else {
      if (!srcMap.has(e.source)) srcMap.set(e.source, []);
      if (!tgtMap.has(e.target)) tgtMap.set(e.target, []);
      srcMap.get(e.source)!.push(`src-${srcMap.get(e.source)!.length}`);
      tgtMap.get(e.target)!.push(`tgt-${tgtMap.get(e.target)!.length}`);
    }
  }

  // Place groups and child nodes
  const nodes: Node[] = [];
  for (const group of archData.groups) {
    const pos = groupPositions[group.id] ?? { x: 0, y: 0 };
    const size = computeGroupSize(archData, group.id);
    const groupNodes = archData.nodes.filter((n) => n.group === group.id);
    const allDisabled = groupNodes.every((n) => getNodeState(n) === 'disabled');

    nodes.push({
      id: `group-${group.id}`, type: 'groupNode',
      position: { x: pos.x, y: pos.y },
      data: { label: group.name, icon: group.icon, disabled: allDisabled, groupId: group.id, nodeCount: size.count },
      style: { width: size.w, height: size.h },
      draggable: true, selectable: false,
    });

    groupNodes.forEach((archNode, i) => {
      const disabled = getNodeState(archNode) === 'disabled';
      const navigable = !disabled && typeof archNode.url === 'string' && archNode.url.length > 0;
      nodes.push({
        id: archNode.id, type: 'archNode',
        position: { x: GROUP_PAD, y: GROUP_HEADER_H + GROUP_PAD + i * (NODE_H + NODE_GAP) },
        parentId: `group-${group.id}`, extent: 'parent' as const,
        data: {
          label: archNode.name, icon: archNode.icon, url: archNode.url,
          disabled, navigable, groupId: group.id,
          sourceHandles: srcMap.get(archNode.id) ?? [],
          targetHandles: tgtMap.get(archNode.id) ?? [],
          intraSourceHandles: intraSrcMap.get(archNode.id) ?? [],
          intraTargetHandles: intraTgtMap.get(archNode.id) ?? [],
        },
        draggable: false,
      });
    });
  }

  // Separate intra-group vs inter-group edges
  const interGroupEdges: typeof archData.edges[number][] = [];
  const intraGroupEdges: typeof archData.edges[number][] = [];
  for (const e of archData.edges) {
    const srcNode = archData.nodes.find((n) => n.id === e.source);
    const tgtNode = archData.nodes.find((n) => n.id === e.target);
    if (!srcNode || !tgtNode) continue;
    (srcNode.group === tgtNode.group ? intraGroupEdges : interGroupEdges).push(e);
  }

  // Compute absolute Y for each node (for FrameworkDrawer-style offset sorting)
  const nodeAbsY = new Map<string, number>();
  for (const group of archData.groups) {
    const gy = groupPositions[group.id]?.y ?? 0;
    archData.nodes.filter((n) => n.group === group.id).forEach((n, i) => {
      nodeAbsY.set(n.id, gy + GROUP_HEADER_H + GROUP_PAD + i * (NODE_H + NODE_GAP) + NODE_H / 2);
    });
  }

  // FrameworkDrawer-style offset: sort by source Y within each lane
  // Top source → largest offset (rightmost), bottom → smallest (leftmost)
  const LANE_STEP = 8;
  const laneMap = new Map<string, typeof interGroupEdges>();
  for (const e of interGroupEdges) {
    const srcNode = archData.nodes.find((n) => n.id === e.source)!;
    const tgtNode = archData.nodes.find((n) => n.id === e.target)!;
    const srcX = groupPositions[srcNode.group]?.x ?? 0;
    const tgtX = groupPositions[tgtNode.group]?.x ?? 0;
    // Lane key based on which two groups the edge connects
    const laneKey = srcX < tgtX ? `${srcNode.group}-${tgtNode.group}` : `${tgtNode.group}-${srcNode.group}`;
    if (!laneMap.has(laneKey)) laneMap.set(laneKey, []);
    laneMap.get(laneKey)!.push(e);
  }

  const edgeOffsets = new Map<string, number>();
  for (const [, laneEdgeList] of laneMap) {
    laneEdgeList.sort((a, b) => (nodeAbsY.get(a.source) ?? 0) - (nodeAbsY.get(b.source) ?? 0));
    const count = laneEdgeList.length;
    laneEdgeList.forEach((e, i) => {
      const offset = ((count - 1) / 2 - i) * LANE_STEP;
      edgeOffsets.set(`${e.source}-${e.target}`, offset);
    });
  }

  // Build edge objects
  const edges: Edge[] = [];
  const srcCounter = new Map<string, number>();
  const tgtCounter = new Map<string, number>();
  const intraSrcCounter = new Map<string, number>();
  const intraTgtCounter = new Map<string, number>();

  // Build intra-group edges with FrameworkDrawer algorithm:
  // k = BASE + edgeIndexWithinSource * STEP (per-source independent calculation)
  // Each source node's edges get their own k sequence, no global sorting needed.
  // Different sources naturally don't cross because their Y positions differ.
  const INTRA_BASE = 30;
  const INTRA_STEP = 12;
  const perSourceCounter = new Map<string, number>();

  for (const e of intraGroupEdges) {
    const srcNode = archData.nodes.find((n) => n.id === e.source)!;
    const tgtNode = archData.nodes.find((n) => n.id === e.target)!;
    const disabled = getNodeState(srcNode) === 'disabled' || getNodeState(tgtNode) === 'disabled';
    const sIdx = intraSrcCounter.get(e.source) ?? 0;
    const tIdx = intraTgtCounter.get(e.target) ?? 0;
    intraSrcCounter.set(e.source, sIdx + 1);
    intraTgtCounter.set(e.target, tIdx + 1);
    const srcEdgeIdx = perSourceCounter.get(e.source) ?? 0;
    perSourceCounter.set(e.source, srcEdgeIdx + 1);
    const bypassK = e.bypassK ?? (INTRA_BASE + srcEdgeIdx * INTRA_STEP);
    edges.push({
      id: `${e.source}-${e.target}`, source: e.source, target: e.target,
      sourceHandle: `isrc-${sIdx}`, targetHandle: `itgt-${tIdx}`, type: 'colored',
      data: { label: e.label, disabled, color: getTheme(srcNode.group).accent, intraGroup: true, bypassK },
    });
  }

  for (const e of interGroupEdges) {
    const srcNode = archData.nodes.find((n) => n.id === e.source)!;
    const tgtNode = archData.nodes.find((n) => n.id === e.target)!;
    const disabled = getNodeState(srcNode) === 'disabled' || getNodeState(tgtNode) === 'disabled';
    const sIdx = srcCounter.get(e.source) ?? 0;
    const tIdx = tgtCounter.get(e.target) ?? 0;
    srcCounter.set(e.source, sIdx + 1);
    tgtCounter.set(e.target, tIdx + 1);
    edges.push({
      id: `${e.source}-${e.target}`, source: e.source, target: e.target,
      sourceHandle: `src-${sIdx}`, targetHandle: `tgt-${tIdx}`, type: 'colored',
      data: {
        label: e.label, disabled, color: getTheme(srcNode.group).accent,
        midXOffset: edgeOffsets.get(`${e.source}-${e.target}`) ?? 0,
      },
    });
  }

  return { nodes, edges };
}

/* ------------------------------------------------------------------ */
/*  Save layout to server (editor mode only)                          */
/* ------------------------------------------------------------------ */

async function saveLayout(positions: Record<string, { x: number; y: number }>) {
  const res = await fetch('/api/editor/diagram-layout', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ groups: positions }),
  });
  return res.ok;
}

/* ------------------------------------------------------------------ */
/*  Main flow component                                               */
/* ------------------------------------------------------------------ */

function DiagramFlow({ data, savedLayout, editorMode }: DiagramRendererProps) {
  const [mode, setMode] = useState<ViewMode>('publish');
  const [nodes, setNodes] = useState<Node[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const { fitView } = useReactFlow();

  // Track current group positions (mutable ref to avoid re-renders on every drag)
  const [groupPositions, setGroupPositions] = useState<Record<string, { x: number; y: number }>>(() => {
    const saved = savedLayout?.groups;
    if (saved && Object.keys(saved).length > 0) return saved;
    return defaultGroupPositions(data);
  });

  // Rebuild layout when mode changes (not on every drag)
  useEffect(() => {
    const result = buildLayout(data, mode, groupPositions);
    setNodes(result.nodes);
    setEdges(result.edges);
    setTimeout(() => fitView({ padding: 0.12, duration: 300 }), 50);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, mode, fitView]);

  // Handle node changes (drag group nodes)
  const onNodesChange: OnNodesChange = useCallback((changes) => {
    setNodes((nds) => applyNodeChanges(changes, nds));

    // Track group position changes for save
    for (const change of changes) {
      if (change.type === 'position' && change.position) {
        const nodeId = change.id;
        if (nodeId.startsWith('group-') && !change.dragging) {
          const groupId = nodeId.replace('group-', '');
          setGroupPositions((prev) => ({
            ...prev,
            [groupId]: { x: change.position!.x, y: change.position!.y },
          }));
          setDirty(true);
        }
      }
    }
  }, []);

  const handleSave = useCallback(async () => {
    setSaving(true);
    const ok = await saveLayout(groupPositions);
    setSaving(false);
    if (ok) setDirty(false);
  }, [groupPositions]);

  return (
    <div style={{ position: 'relative', width: '100%' }}>
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

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          {editorMode && (
            <button className="neu-editor-btn" onClick={handleSave}
              disabled={saving || !dirty}
              style={{
                padding: '0.4rem 1rem', fontSize: '0.85rem',
                border: 'none', cursor: dirty ? 'pointer' : 'default',
                fontFamily: 'inherit', opacity: dirty ? 1 : 0.4,
              }}>
              {saving ? '💾 保存中...' : dirty ? '💾 保存布局' : '✅ 已保存'}
            </button>
          )}
          <p className="diagram-mobile-hint" style={{
            display: 'none', textAlign: 'center', fontSize: '0.75rem',
            color: 'var(--text-muted)', margin: 0,
          }}>👆 捏合缩放 · 拖动平移</p>
        </div>
      </div>

      <div style={{
        width: '100%', height: '70vh', borderRadius: '1rem', overflow: 'hidden',
        boxShadow: 'inset 6px 6px 10px var(--neu-shadow-dark-strong), inset -6px -6px 10px var(--neu-shadow-light-strong)',
      }}>
        <ReactFlow
          nodes={nodes} edges={edges}
          onNodesChange={onNodesChange}
          nodeTypes={nodeTypes} edgeTypes={edgeTypes}
          fitView fitViewOptions={{ padding: 0.12 }}
          nodesConnectable={false} elementsSelectable={false}
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

const DiagramRenderer: FC<DiagramRendererProps> = ({ data, savedLayout, editorMode }) => (
  <ReactFlowProvider>
    <DiagramFlow data={data} savedLayout={savedLayout} editorMode={editorMode} />
  </ReactFlowProvider>
);

export default DiagramRenderer;
