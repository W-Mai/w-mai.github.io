import { useState, useRef, useCallback, useMemo, useEffect, type FC } from 'react';
import { Stage, Layer, Group, Rect, Text, Arrow, Line } from 'react-konva';
import type { KonvaEventObject } from 'konva/lib/Node';
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

interface TooltipInfo {
  x: number;
  y: number;
  name: string;
  group: string;
  url?: string;
}

const ZOOM_MIN = 0.3;
const ZOOM_MAX = 2.0;
const ZOOM_STEP = 0.1;

const DiagramRenderer: FC<DiagramRendererProps> = ({ data }) => {
  const [mode, setMode] = useState<ViewMode>('publish');
  const [tooltip, setTooltip] = useState<TooltipInfo | null>(null);
  const [stageSize, setStageSize] = useState({ width: 800, height: 600 });
  const [scale, setScale] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const containerRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<any>(null);

  const layout = useMemo(() => computeLayout(data), [data]);

  // Fit diagram to container on mount
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const updateSize = () => {
      const w = el.clientWidth;
      const h = Math.max(500, window.innerHeight * 0.7);
      setStageSize({ width: w, height: h });
      // Auto-fit: scale to fit diagram in view
      const sx = w / layout.width;
      const sy = h / layout.height;
      const fitScale = Math.min(sx, sy, 1) * 0.92;
      setScale(fitScale);
      setPosition({
        x: (w - layout.width * fitScale) / 2,
        y: (h - layout.height * fitScale) / 2,
      });
    };
    updateSize();
    const ro = new ResizeObserver(updateSize);
    ro.observe(el);
    return () => ro.disconnect();
  }, [layout]);

  // Zoom with Ctrl/Meta + wheel only
  const handleWheel = useCallback((e: KonvaEventObject<WheelEvent>) => {
    const evt = e.evt;
    if (!evt.ctrlKey && !evt.metaKey) return;
    evt.preventDefault();
    const stage = stageRef.current;
    if (!stage) return;
    const pointer = stage.getPointerPosition();
    if (!pointer) return;
    const oldScale = scale;
    const dir = evt.deltaY < 0 ? 1 : -1;
    const newScale = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, oldScale + dir * ZOOM_STEP));
    const mousePointTo = {
      x: (pointer.x - position.x) / oldScale,
      y: (pointer.y - position.y) / oldScale,
    };
    setScale(newScale);
    setPosition({
      x: pointer.x - mousePointTo.x * newScale,
      y: pointer.y - mousePointTo.y * newScale,
    });
  }, [scale, position]);

  const handleDragEnd = useCallback((e: KonvaEventObject<DragEvent>) => {
    setPosition({ x: e.target.x(), y: e.target.y() });
  }, []);

  // Zoom buttons
  const clamp = (s: number) => Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, s));
  const zoomIn = () => {
    const ns = clamp(scale + ZOOM_STEP);
    const cx = stageSize.width / 2;
    const cy = stageSize.height / 2;
    const mp = { x: (cx - position.x) / scale, y: (cy - position.y) / scale };
    setScale(ns);
    setPosition({ x: cx - mp.x * ns, y: cy - mp.y * ns });
  };
  const zoomOut = () => {
    const ns = clamp(scale - ZOOM_STEP);
    const cx = stageSize.width / 2;
    const cy = stageSize.height / 2;
    const mp = { x: (cx - position.x) / scale, y: (cy - position.y) / scale };
    setScale(ns);
    setPosition({ x: cx - mp.x * ns, y: cy - mp.y * ns });
  };
  const resetView = () => {
    const sx = stageSize.width / layout.width;
    const sy = stageSize.height / layout.height;
    const fitScale = Math.min(sx, sy, 1) * 0.92;
    setScale(fitScale);
    setPosition({
      x: (stageSize.width - layout.width * fitScale) / 2,
      y: (stageSize.height - layout.height * fitScale) / 2,
    });
  };

  // Node click
  const handleNodeClick = useCallback((url?: string) => {
    if (!url) return;
    try { window.location.assign(url); } catch { /* noop */ }
  }, []);

  // Find node center for edge drawing
  const findNodeCenter = useCallback((nodeId: string) => {
    for (const g of layout.groups) {
      for (const pn of g.nodes) {
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

  // Read CSS custom properties for canvas colors
  const colors = useMemo(() => {
    if (typeof window === 'undefined') return {
      bg: '#e0e5ec', surface: '#f1f5f9', heading: '#1e293b',
      primary: '#1e293b', muted: '#94a3b8', link: '#475569',
      shadowDark: 'rgba(163,177,198,0.6)', shadowLight: 'rgba(255,255,255,0.5)',
      glass: 'rgba(224,229,236,0.85)',
    };
    const s = getComputedStyle(document.documentElement);
    const g = (v: string) => s.getPropertyValue(v).trim();
    return {
      bg: g('--neu-bg') || '#e0e5ec',
      surface: g('--bg-surface') || '#f1f5f9',
      heading: g('--text-heading') || '#1e293b',
      primary: g('--text-primary') || '#1e293b',
      muted: g('--text-muted') || '#94a3b8',
      link: g('--text-link') || '#475569',
      shadowDark: g('--neu-shadow-dark') || 'rgba(163,177,198,0.6)',
      shadowLight: g('--neu-shadow-light') || 'rgba(255,255,255,0.5)',
      glass: g('--bg-surface-glass') || 'rgba(224,229,236,0.85)',
    };
  }, []);

  // Re-read colors on theme change
  const [colorKey, setColorKey] = useState(0);
  useEffect(() => {
    const obs = new MutationObserver(() => setColorKey((k) => k + 1));
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    return () => obs.disconnect();
  }, []);

  const liveColors = useMemo(() => {
    if (typeof window === 'undefined') return colors;
    const s = getComputedStyle(document.documentElement);
    const g = (v: string) => s.getPropertyValue(v).trim();
    return {
      bg: g('--neu-bg') || '#e0e5ec',
      surface: g('--bg-surface') || '#f1f5f9',
      heading: g('--text-heading') || '#1e293b',
      primary: g('--text-primary') || '#1e293b',
      muted: g('--text-muted') || '#94a3b8',
      link: g('--text-link') || '#475569',
      shadowDark: g('--neu-shadow-dark') || 'rgba(163,177,198,0.6)',
      shadowLight: g('--neu-shadow-light') || 'rgba(255,255,255,0.5)',
      glass: g('--bg-surface-glass') || 'rgba(224,229,236,0.85)',
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [colorKey]);

  const c = liveColors;

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
        <div style={{ display: 'flex', gap: '0.3rem', alignItems: 'center' }}>
          <button className="neu-btn" onClick={zoomOut} style={{ padding: '0.4rem 0.7rem', border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}>−</button>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', minWidth: '3rem', textAlign: 'center' }}>
            {Math.round(scale * 100)}%
          </span>
          <button className="neu-btn" onClick={zoomIn} style={{ padding: '0.4rem 0.7rem', border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}>+</button>
          <button className="neu-btn" onClick={resetView} style={{ padding: '0.4rem 0.7rem', border: 'none', cursor: 'pointer', fontSize: '0.8rem', fontFamily: 'inherit' }}>↺</button>
        </div>
      </div>

      {/* Mobile hint */}
      <p className="diagram-mobile-hint" style={{
        display: 'none', textAlign: 'center', fontSize: '0.75rem',
        color: 'var(--text-muted)', margin: '0 0 0.5rem',
      }}>
        👆 捏合缩放 · 拖动平移
      </p>

      {/* Canvas container */}
      <div
        ref={containerRef}
        style={{
          borderRadius: '1rem', overflow: 'hidden', position: 'relative',
          boxShadow: 'inset 6px 6px 10px var(--neu-shadow-dark-strong), inset -6px -6px 10px var(--neu-shadow-light-strong)',
        }}
      >
        <Stage
          ref={stageRef}
          width={stageSize.width}
          height={stageSize.height}
          scaleX={scale}
          scaleY={scale}
          x={position.x}
          y={position.y}
          draggable
          onDragEnd={handleDragEnd}
          onWheel={handleWheel}
        >
          <Layer>
            {/* Edges */}
            {data.edges.map((edge, i) => {
              const src = findNodeCenter(edge.source);
              const tgt = findNodeCenter(edge.target);
              if (!src || !tgt) return null;
              const state = getEdgeState(edge, data.nodes, mode);
              return (
                <Arrow
                  key={`edge-${i}`}
                  points={[src.x, src.y, (src.x + tgt.x) / 2, src.y, (src.x + tgt.x) / 2, tgt.y, tgt.x, tgt.y]}
                  tension={0.4}
                  stroke={c.muted}
                  strokeWidth={1.5}
                  pointerLength={6}
                  pointerWidth={5}
                  opacity={state === 'disabled' ? 0.2 : 0.5}
                  listening={false}
                />
              );
            })}

            {/* Edge labels */}
            {data.edges.map((edge, i) => {
              if (!edge.label) return null;
              const src = findNodeCenter(edge.source);
              const tgt = findNodeCenter(edge.target);
              if (!src || !tgt) return null;
              const state = getEdgeState(edge, data.nodes, mode);
              return (
                <Text
                  key={`elabel-${i}`}
                  x={(src.x + tgt.x) / 2 - 16}
                  y={(src.y + tgt.y) / 2 - 12}
                  text={edge.label}
                  fontSize={10}
                  fill={c.muted}
                  opacity={state === 'disabled' ? 0.3 : 0.7}
                  listening={false}
                />
              );
            })}

            {/* Groups and nodes */}
            {layout.groups.map((group) => (
              <Group key={group.id} x={group.x} y={group.y}>
                {/* Group shadow */}
                <Rect
                  width={group.width} height={group.height}
                  cornerRadius={16} fill={c.bg}
                  shadowColor={c.shadowDark} shadowBlur={12}
                  shadowOffsetX={6} shadowOffsetY={6} shadowOpacity={0.5}
                />
                <Rect
                  width={group.width} height={group.height}
                  cornerRadius={16} fill={c.bg}
                  shadowColor={c.shadowLight} shadowBlur={12}
                  shadowOffsetX={-6} shadowOffsetY={-6} shadowOpacity={0.5}
                  listening={false}
                />
                {/* Group title */}
                <Text
                  x={0} y={10} width={group.width}
                  text={`${group.icon} ${group.name}`}
                  fontSize={13} fontStyle="bold" fill={c.heading}
                  align="center" listening={false}
                />

                {/* Nodes */}
                {group.nodes.map((pn) => {
                  const nState = getNodeState(pn.node, mode);
                  const navigable = isNavigable(pn.node) && nState === 'enabled';
                  const disabled = nState === 'disabled';
                  return (
                    <Group
                      key={pn.node.id}
                      x={pn.x} y={pn.y}
                      opacity={disabled ? 0.4 : 1}
                      onClick={() => navigable && handleNodeClick(pn.node.url)}
                      onTap={() => navigable && handleNodeClick(pn.node.url)}
                      onMouseEnter={(e) => {
                        const stage = e.target.getStage();
                        if (stage) stage.container().style.cursor = navigable ? 'pointer' : 'default';
                        const pos = stage?.getPointerPosition();
                        if (!pos) return;
                        const grp = data.groups.find((g) => g.id === pn.node.group);
                        setTooltip({
                          x: pos.x, y: pos.y,
                          name: `${pn.node.icon} ${pn.node.name}`,
                          group: grp?.name ?? pn.node.group,
                          url: pn.node.url,
                        });
                      }}
                      onMouseLeave={(e) => {
                        const stage = e.target.getStage();
                        if (stage) stage.container().style.cursor = 'grab';
                        setTooltip(null);
                      }}
                    >
                      {/* Node raised shadow */}
                      {!disabled && (
                        <>
                          <Rect
                            width={LAYOUT.nodeWidth} height={LAYOUT.nodeHeight}
                            cornerRadius={10} fill={c.surface}
                            shadowColor={c.shadowDark} shadowBlur={8}
                            shadowOffsetX={4} shadowOffsetY={4} shadowOpacity={0.4}
                          />
                          <Rect
                            width={LAYOUT.nodeWidth} height={LAYOUT.nodeHeight}
                            cornerRadius={10} fill={c.surface}
                            shadowColor={c.shadowLight} shadowBlur={8}
                            shadowOffsetX={-4} shadowOffsetY={-4} shadowOpacity={0.4}
                            listening={false}
                          />
                        </>
                      )}
                      {/* Node inset for disabled */}
                      {disabled && (
                        <Rect
                          width={LAYOUT.nodeWidth} height={LAYOUT.nodeHeight}
                          cornerRadius={10} fill={c.bg}
                          shadowColor={c.shadowDark} shadowBlur={4}
                          shadowOffsetX={2} shadowOffsetY={2} shadowOpacity={0.3}
                        />
                      )}
                      <Text
                        x={0} y={0}
                        width={LAYOUT.nodeWidth} height={LAYOUT.nodeHeight}
                        text={`${pn.node.icon} ${pn.node.name}`}
                        fontSize={12} fill={disabled ? c.muted : c.primary}
                        align="center" verticalAlign="middle"
                        listening={false}
                      />
                    </Group>
                  );
                })}
              </Group>
            ))}
          </Layer>
        </Stage>

        {/* Tooltip overlay */}
        {tooltip && (
          <div style={{
            position: 'absolute', left: tooltip.x + 12, top: tooltip.y - 8,
            background: c.glass, backdropFilter: 'blur(8px)',
            borderRadius: '0.75rem', padding: '0.5rem 0.75rem',
            boxShadow: `4px 4px 8px ${c.shadowDark}, -4px -4px 8px ${c.shadowLight}`,
            fontSize: '0.75rem', color: c.primary,
            pointerEvents: 'none', zIndex: 20, whiteSpace: 'nowrap',
          }}>
            <div style={{ fontWeight: 600 }}>{tooltip.name}</div>
            <div style={{ color: c.muted, fontSize: '0.7rem' }}>{tooltip.group}</div>
            {tooltip.url && (
              <div style={{ color: c.link, fontSize: '0.7rem' }}>→ {tooltip.url}</div>
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
