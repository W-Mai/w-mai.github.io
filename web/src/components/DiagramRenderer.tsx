import { useState, useRef, useCallback, useMemo, type FC } from 'react';
import type { ArchitectureData } from '~/data/architecture';
import {
  computeLayout,
  getNodeState,
  getEdgeState,
  isNavigable,
  LAYOUT,
  type ViewMode,
} from '~/lib/diagram-layout';

interface DiagramRendererProps {
  data: ArchitectureData;
}

interface ViewState {
  scale: number;
  translateX: number;
  translateY: number;
}

interface TooltipInfo {
  x: number;
  y: number;
  name: string;
  group: string;
  url?: string;
}

const INITIAL_VIEW: ViewState = { scale: 1, translateX: 0, translateY: 0 };
const ZOOM_MIN = 0.3;
const ZOOM_MAX = 2.0;
const ZOOM_STEP = 0.1;

const DiagramRenderer: FC<DiagramRendererProps> = ({ data }) => {
  const [mode, setMode] = useState<ViewMode>('publish');
  const [view, setView] = useState<ViewState>(INITIAL_VIEW);
  const [isResetting, setIsResetting] = useState(false);
  const [tooltip, setTooltip] = useState<TooltipInfo | null>(null);
  const [dragging, setDragging] = useState(false);
  const dragStart = useRef<{ x: number; y: number } | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const layout = useMemo(() => computeLayout(data), [data]);

  // --- Zoom handlers ---
  const clampScale = (s: number) => Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, s));

  const handleWheel = useCallback((e: React.WheelEvent) => {
    // Only zoom on pinch (ctrlKey) or meta+scroll; let normal scroll pass through
    if (!e.ctrlKey && !e.metaKey) return;
    e.preventDefault();
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    setView((v) => {
      const dir = e.deltaY < 0 ? 1 : -1;
      const newScale = clampScale(v.scale + dir * ZOOM_STEP);
      const ratio = newScale / v.scale;
      return {
        scale: newScale,
        translateX: mx - ratio * (mx - v.translateX),
        translateY: my - ratio * (my - v.translateY),
      };
    });
  }, []);

  // --- Pan handlers ---
  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    if (e.button !== 0) return;
    setDragging(true);
    dragStart.current = { x: e.clientX - view.translateX, y: e.clientY - view.translateY };
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
  }, [view.translateX, view.translateY]);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!dragging || !dragStart.current) return;
    setView((v) => ({
      ...v,
      translateX: e.clientX - dragStart.current!.x,
      translateY: e.clientY - dragStart.current!.y,
    }));
  }, [dragging]);

  const handlePointerUp = useCallback(() => {
    setDragging(false);
    dragStart.current = null;
  }, []);

  // --- Zoom buttons ---
  const zoomIn = () => setView((v) => ({ ...v, scale: clampScale(v.scale + ZOOM_STEP) }));
  const zoomOut = () => setView((v) => ({ ...v, scale: clampScale(v.scale - ZOOM_STEP) }));
  const resetView = () => {
    setIsResetting(true);
    setView(INITIAL_VIEW);
    setTimeout(() => setIsResetting(false), 300);
  };

  // --- Node click ---
  const handleNodeClick = useCallback((url?: string) => {
    if (!url) return;
    try { window.location.assign(url); } catch { /* noop */ }
  }, []);

  // --- Edge path computation ---
  const getEdgePath = useCallback((srcX: number, srcY: number, tgtX: number, tgtY: number) => {
    const midX = (srcX + tgtX) / 2;
    return `M ${srcX} ${srcY} C ${midX} ${srcY}, ${midX} ${tgtY}, ${tgtX} ${tgtY}`;
  }, []);

  // --- Find node center position ---
  const findNodeCenter = useCallback((nodeId: string) => {
    for (const g of layout.groups) {
      for (const pn of g.nodes) 
{
        if (pn.node.id === nodeId) {
          return {
            x: g.x + pn.x + LAYOUT.nodeWidth / 2,
            y: g.y + pn.y + LAYOUT.nodeHeight / 2,
          };
        }
      }
    }
    return null;
  }, [layout]);

  const transitionStyle = isResetting ? 'transform 300ms ease' : 'none';

  return (
    <div style={{ position: 'relative', width: '100%' }}>
      {/* Control panel */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        flexWrap: 'wrap', gap: '0.5rem', marginBottom: '1rem',
      }}>
        {/* Mode toggle */}
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

        {/* Zoom controls */}
        <div style={{ display: 'flex', gap: '0.3rem', alignItems: 'center' }}>
          <button className="neu-btn" onClick={zoomOut} style={{ padding: '0.4rem 0.7rem', border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}>−</button>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', minWidth: '3rem', textAlign: 'center' }}>
            {Math.round(view.scale * 100)}%
          </span>
          <button className="neu-btn" onClick={zoomIn} style={{ padding: '0.4rem 0.7rem', border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}>+</button>
          <button className="neu-btn" onClick={resetView} style={{ padding: '0.4rem 0.7rem', border: 'none', cursor: 'pointer', fontSize: '0.8rem', fontFamily: 'inherit' }}>↺</button>
        </div>
      </div>

      {/* Mobile gesture hint */}
      <p className="diagram-mobile-hint" style={{
        display: 'none', textAlign: 'center', fontSize: '0.75rem',
        color: 'var(--text-muted)', margin: '0 0 0.5rem',
      }}>
        👆 捏合缩放 · 拖动平移
      </p>

      {/* SVG container */}
      <div
        ref={containerRef}
        onWheel={handleWheel}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
        style={{
          overflow: 'hidden', borderRadius: '1rem',
          width: '100%', height: '70vh', cursor: dragging ? 'grabbing' : 'grab',
          touchAction: 'pan-y', position: 'relative',
          boxShadow: 'inset 6px 6px 10px var(--neu-shadow-dark-strong), inset -6px -6px 10px var(--neu-shadow-light-strong)',
        }}
      >
        <svg
          width="100%" height="100%"
          viewBox={`0 0 ${layout.width} ${layout.height}`}
          preserveAspectRatio="xMidYMid meet"
          style={{ display: 'block' }}
        >
          <defs>
            <filter id="neu-raised" x="-20%" y="-20%" width="140%" height="140%">
              <feDropShadow dx="4" dy="4" stdDeviation="6" floodOpacity="0.3" floodColor="var(--neu-shadow-dark)" />
              <feDropShadow dx="-4" dy="-4" stdDeviation="6" floodOpacity="0.3" floodColor="var(--neu-shadow-light)" />
            </filter>
            <filter id="neu-inset-svg" x="-20%" y="-20%" width="140%" height="140%">
              <feDropShadow dx="2" dy="2" stdDeviation="3" floodOpacity="0.2" floodColor="var(--neu-shadow-dark-strong)" />
            </filter>
            <marker id="arrowhead" markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto">
              <polygon points="0 0, 8 3, 0 6" fill="var(--text-muted)" />
            </marker>
          </defs>

          <g
            transform={`translate(${view.translateX}, ${view.translateY}) scale(${view.scale})`}
            style={{ transition: transitionStyle }}
          >
            {/* Edges */}
            {data.edges.map((edge, i) => {
              const src = findNodeCenter(edge.source);
              const tgt = findNodeCenter(edge.target);
              if (!src || !tgt) return null;
              const state = getEdgeState(edge, data.nodes, mode);
              const midX = (src.x + tgt.x) / 2;
              const midY = (src.y + tgt.y) / 2;
              return (
                <g key={`edge-${i}`} style={{
                  opacity: state === 'disabled' ? 0.2 : 0.6,
                  transition: 'opacity 250ms ease',
                }}>
                  <path
                    d={getEdgePath(src.x, src.y, tgt.x, tgt.y)}
                    fill="none" stroke="var(--text-muted)" strokeWidth={1.5}
                    markerEnd="url(#arrowhead)"
                  />
                  {edge.label && (
                    <text x={midX} y={midY - 6} textAnchor="middle"
                      style={{ fontSize: '10px', fill: 'var(--text-muted)' }}>
                      {edge.label}
                    </text>
                  )}
                </g>
              );
            })}

            {/* Groups and nodes */}
            {layout.groups.map((group) => (
              <g key={group.id} transform={`translate(${group.x}, ${group.y})`}>
                {/* Group background */}
                <rect
                  x={0} y={0} width={group.width} height={group.height}
                  rx={16} ry={16}
                  fill="var(--neu-bg)" filter="url(#neu-raised)"
                />
                {/* Group title */}
                <text x={group.width / 2} y={28} textAnchor="middle"
                  style={{ fontSize: '13px', fontWeight: 700, fill: 'var(--text-heading)' }}>
                  {group.icon} {group.name}
                </text>

                {/* Nodes */}
                {group.nodes.map((pn) => {
                  const nState = getNodeState(pn.node, mode);
                  const navigable = isNavigable(pn.node) && nState === 'enabled';
                  return (
                    <g
                      key={pn.node.id}
                      transform={`translate(${pn.x}, ${pn.y})`}
                      style={{
                        opacity: nState === 'disabled' ? 0.45 : 1,
                        cursor: navigable ? 'pointer' : 'default',
                        transition: 'opacity 250ms ease',
                      }}
                      onClick={() => navigable && handleNodeClick(pn.node.url)}
                      onMouseEnter={(e) => {
                        const rect = containerRef.current?.getBoundingClientRect();
                        if (!rect) return;
                        const grp = data.groups.find((g) => g.id === pn.node.group);
                        setTooltip({
                          x: e.clientX - rect.left,
                          y: e.clientY - rect.top,
                          name: `${pn.node.icon} ${pn.node.name}`,
                          group: grp?.name ?? pn.node.group,
                          url: pn.node.url,
                        });
                      }}
                      onMouseLeave={() => setTooltip(null)}
                    >
                      <rect
                        width={LAYOUT.nodeWidth} height={LAYOUT.nodeHeight}
                        rx={10} ry={10}
                        fill="var(--bg-surface)"
                        filter={nState === 'disabled' ? 'url(#neu-inset-svg)' : 'url(#neu-raised)'}
                      />
                      <text
                        x={LAYOUT.nodeWidth / 2} y={LAYOUT.nodeHeight / 2 + 1}
                        textAnchor="middle" dominantBaseline="middle"
                        style={{ fontSize: '12px', fill: 'var(--text-primary)', pointerEvents: 'none' }}
                      >
                        {pn.node.icon} {pn.node.name}
                      </text>
                    </g>
                  );
                })}
              </g>
            ))}
          </g>
        </svg>

        {/* Tooltip */}
        {tooltip && (
          <div style={{
            position: 'absolute', left: tooltip.x + 12, top: tooltip.y - 8,
            background: 'var(--bg-surface-glass)', backdropFilter: 'blur(8px)',
            borderRadius: '0.75rem', padding: '0.5rem 0.75rem',
            boxShadow: '4px 4px 8px var(--neu-shadow-dark), -4px -4px 8px var(--neu-shadow-light)',
            fontSize: '0.75rem', color: 'var(--text-primary)',
            pointerEvents: 'none', zIndex: 20, whiteSpace: 'nowrap',
          }}>
            <div style={{ fontWeight: 600 }}>{tooltip.name}</div>
            <div style={{ color: 'var(--text-muted)', fontSize: '0.7rem' }}>{tooltip.group}</div>
            {tooltip.url && (
              <div style={{ color: 'var(--text-link)', fontSize: '0.7rem' }}>→ {tooltip.url}</div>
            )}
          </div>
        )}
      </div>

      <style>{`
        @media (max-width: 768px) {
          .diagram-mobile-hint { display: block !important; }
        }
      `}</style>
    </div>
  );
};

export default DiagramRenderer;
