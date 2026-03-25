// Layout utilities for layered architecture diagram

import type { ArchNode, ArchEdge } from '~/data/architecture';

export const LAYOUT = {
  layerPadX: 24,
  layerPadTop: 36,
  layerPadBottom: 16,
  layerGapY: 40,
  nodeWidth: 160,
  nodeHeight: 40,
  nodeGapX: 14,
  nodeGapY: 10,
  layerHeaderHeight: 28,
} as const;

/** Determine if a node is editor-only */
export function isEditorOnly(node: ArchNode): boolean {
  return node.editorOnly === true;
}

/** Check if a node has a navigable URL */
export function isNavigable(node: ArchNode): boolean {
  return typeof node.url === 'string' && node.url.length > 0;
}

/** Get all nodes connected to a given node (upstream + downstream, recursive) */
export function getConnectedNodes(
  nodeId: string,
  edges: readonly ArchEdge[],
): Set<string> {
  const connected = new Set<string>();

  // BFS downstream (source -> target)
  const qDown = [nodeId];
  const visitedDown = new Set<string>();
  while (qDown.length > 0) {
    const cur = qDown.shift()!;
    if (visitedDown.has(cur)) continue;
    visitedDown.add(cur);
    connected.add(cur);
    for (const e of edges) {
      if (e.source === cur && !visitedDown.has(e.target)) qDown.push(e.target);
    }
  }

  // BFS upstream (target -> source)
  const qUp = [nodeId];
  const visitedUp = new Set<string>();
  while (qUp.length > 0) {
    const cur = qUp.shift()!;
    if (visitedUp.has(cur)) continue;
    visitedUp.add(cur);
    connected.add(cur);
    for (const e of edges) {
      if (e.target === cur && !visitedUp.has(e.source)) qUp.push(e.source);
    }
  }

  return connected;
}
