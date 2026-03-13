// Layout computation and mode filtering for architecture diagram

import type { ArchitectureData, ArchNode, ArchEdge } from '~/data/architecture';

export const LAYOUT = {
  padding: 40,
  groupPadding: 24,
  groupGapX: 60,
  groupGapY: 50,
  nodeWidth: 140,
  nodeHeight: 44,
  nodeGap: 12,
  groupHeaderHeight: 36,
  columns: 3,
} as const;

export interface PositionedNode {
  node: ArchNode;
  x: number;
  y: number;
}

export interface PositionedGroup {
  id: string;
  name: string;
  icon: string;
  x: number;
  y: number;
  width: number;
  height: number;
  nodes: PositionedNode[];
}

export interface ComputedLayout {
  groups: PositionedGroup[];
  width: number;
  height: number;
}

/** Compute positioned groups and nodes in a multi-row grid */
export function computeLayout(data: ArchitectureData): ComputedLayout {
  const { padding, groupPadding, groupGapX, groupGapY, nodeWidth, nodeHeight, nodeGap, groupHeaderHeight, columns } = LAYOUT;

  // Pre-compute each group's dimensions
  const groupMetas = data.groups.map((group) => {
    const groupNodes = data.nodes.filter((n) => n.group === group.id);
    const contentH = groupNodes.length * nodeHeight + Math.max(0, groupNodes.length - 1) * nodeGap;
    const w = nodeWidth + groupPadding * 2;
    const h = groupHeaderHeight + contentH + groupPadding * 2;
    return { group, groupNodes, width: w, height: h };
  });

  // Arrange in grid rows
  const groups: PositionedGroup[] = [];
  let totalWidth = 0;
  let totalHeight = 0;
  let rowY = padding;

  for (let rowStart = 0; rowStart < groupMetas.length; rowStart += columns) {
    const rowItems = groupMetas.slice(rowStart, rowStart + columns);
    const rowHeight = Math.max(...rowItems.map((m) => m.height));
    let cursorX = padding;

    for (const meta of rowItems) {
      const positioned: PositionedNode[] = meta.groupNodes.map((node, i) => ({
        node,
        x: groupPadding,
        y: groupHeaderHeight + groupPadding + i * (nodeHeight + nodeGap),
      }));

      groups.push({
        id: meta.group.id,
        name: meta.group.name,
        icon: meta.group.icon,
        x: cursorX,
        y: rowY,
        width: meta.width,
        height: meta.height,
        nodes: positioned,
      });

      cursorX += meta.width + groupGapX;
    }

    totalWidth = Math.max(totalWidth, cursorX - groupGapX + padding);
    rowY += rowHeight + groupGapY;
  }

  totalHeight = rowY - groupGapY + padding;

  return { groups, width: totalWidth, height: totalHeight };
}

// --- Mode filtering utilities ---

export type ViewMode = 'publish' | 'editor';
export type NodeState = 'enabled' | 'disabled';

/** Determine if a node is enabled or disabled in the given mode */
export function getNodeState(node: ArchNode, mode: ViewMode): NodeState {
  return node.modes.includes(mode) ? 'enabled' : 'disabled';
}

/** Determine edge state based on connected node states */
export function getEdgeState(
  edge: ArchEdge,
  nodes: readonly ArchNode[],
  mode: ViewMode,
): NodeState {
  const src = nodes.find((n) => n.id === edge.source);
  const tgt = nodes.find((n) => n.id === edge.target);
  if (!src || !tgt) return 'disabled';
  if (getNodeState(src, mode) === 'disabled' || getNodeState(tgt, mode) === 'disabled') {
    return 'disabled';
  }
  return 'enabled';
}

/** Check if a node has a navigable URL */
export function isNavigable(node: ArchNode): boolean {
  return typeof node.url === 'string' && node.url.length > 0;
}
