// Layout computation and mode filtering for architecture diagram

import type { ArchitectureData, ArchNode, ArchEdge } from '~/data/architecture';

export const LAYOUT = {
  groupPadding: 24,
  groupGap: 60,
  nodeWidth: 140,
  nodeHeight: 48,
  nodeGap: 16,
  groupHeaderHeight: 40,
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

/** Compute positioned groups and nodes arranged as columns */
export function computeLayout(data: ArchitectureData): ComputedLayout {
  const { groupPadding, groupGap, nodeWidth, nodeHeight, nodeGap, groupHeaderHeight } = LAYOUT;

  let cursorX = groupPadding;
  let maxHeight = 0;
  const groups: PositionedGroup[] = [];

  for (const group of data.groups) {
    const groupNodes = data.nodes.filter((n) => n.group === group.id);
    const contentHeight = groupNodes.length * nodeHeight + Math.max(0, groupNodes.length - 1) * nodeGap;
    const groupWidth = nodeWidth + groupPadding * 2;
    const groupHeight = groupHeaderHeight + contentHeight + groupPadding * 2;

    const positioned: PositionedNode[] = groupNodes.map((node, i) => ({
      node,
      x: cursorX + groupPadding,
      y: groupHeaderHeight + groupPadding + i * (nodeHeight + nodeGap),
    }));

    groups.push({
      id: group.id,
      name: group.name,
      icon: group.icon,
      x: cursorX,
      y: 0,
      width: groupWidth,
      height: groupHeight,
      nodes: positioned,
    });

    cursorX += groupWidth + groupGap;
    maxHeight = Math.max(maxHeight, groupHeight);
  }

  return {
    groups,
    width: cursorX - groupGap + groupPadding,
    height: maxHeight,
  };
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
