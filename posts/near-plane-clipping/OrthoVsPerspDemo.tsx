import { useState, useCallback, useRef } from 'react';

// Reuse NeuSlider pattern from sibling demos
function NeuSlider({ min, max, value, onChange }: { min: number; max: number; value: number; onChange: (v: number) => void }) {
  const trackRef = useRef<HTMLDivElement>(null);
  const pct = (value - min) / (max - min) * 100;
  const commit = useCallback((clientX: number) => {
    const rect = trackRef.current?.getBoundingClientRect();
    if (!rect) return;
    const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    onChange(Math.round(min + ratio * (max - min)));
  }, [min, max, onChange]);
  const onDown = useCallback((e: React.PointerEvent) => {
    e.preventDefault();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    commit(e.clientX);
  }, [commit]);
  const onMove = useCallback((e: React.PointerEvent) => {
    if (e.buttons === 0) return;
    commit(e.clientX);
  }, [commit]);
  return (
    <div ref={trackRef} onPointerDown={onDown} onPointerMove={onMove}
      style={{ flex: 1, height: '1.25rem', borderRadius: '0.625rem', background: 'var(--neu-bg)', boxShadow: 'inset 2px 2px 4px var(--neu-shadow-dark), inset -2px -2px 4px var(--neu-shadow-light)', position: 'relative', cursor: 'pointer', touchAction: 'none' }}>
      <div style={{ position: 'absolute', left: `${pct}%`, top: '50%', transform: 'translate(-50%, -50%)', width: '1rem', height: '1rem', borderRadius: '50%', background: 'var(--neu-bg)', boxShadow: '2px 2px 4px var(--neu-shadow-dark), -2px -2px 4px var(--neu-shadow-light)' }} />
    </div>
  );
}

// Screen preview: shows what the projection looks like on the actual display
function ScreenView({ cx, cy, size, projHalf, color, flipped, exploded, label }:
  { cx: number; cy: number; size: number; projHalf: number; color: string; flipped: boolean; exploded: boolean; label: string }) {
  const half = size / 2;
  const clipId = `screen-clip-${label}`;
  const screenHalf = half - 2;
  // Map projection to screen: objHalf=35 maps to screenHalf when scale=1
  const baseHalf = 35;
  const ratio = Math.abs(projHalf) / baseHalf;
  const barHalf = ratio * screenHalf;
  const overflow = barHalf > screenHalf;
  const labelStyle: React.CSSProperties = { fontSize: '0.45rem', fontFamily: 'monospace' };

  return (
    <g>
      {/* Screen border */}
      <rect x={cx - half} y={cy - half} width={size} height={size}
        rx={3} ry={3} fill="none" stroke="var(--text-muted, #aaa)" strokeWidth={0.8} opacity={0.5} />
      {/* Screen background */}
      <rect x={cx - half} y={cy - half} width={size} height={size}
        rx={3} ry={3} fill="var(--neu-bg)" opacity={0.3} />
      {/* Clip path for screen bounds */}
      <defs>
        <clipPath id={clipId}>
          <rect x={cx - half} y={cy - half} width={size} height={size} />
        </clipPath>
      </defs>

      {/* Crosshair */}
      <line x1={cx - half} y1={cy} x2={cx + half} y2={cy}
        stroke="var(--text-muted, #aaa)" strokeWidth={0.3} opacity={0.3} />
      <line x1={cx} y1={cy - half} x2={cx} y2={cy + half}
        stroke="var(--text-muted, #aaa)" strokeWidth={0.3} opacity={0.3} />

      {/* Projected object bar (clipped to screen) */}
      {!exploded && (
        <rect x={cx - 4} y={cy - barHalf} width={8} height={barHalf * 2}
          rx={2} fill={flipped ? '#ef4444' : color} opacity={0.8}
          clipPath={`url(#${clipId})`} />
      )}
      {exploded && (
        <text x={cx} y={cy + 2} style={{ ...labelStyle, fill: '#ef4444' }} textAnchor="middle">∞</text>
      )}

      {/* Overflow indicator */}
      {overflow && !exploded && (
        <>
          <line x1={cx - half + 1} y1={cy - half + 1} x2={cx + half - 1} y2={cy - half + 1}
            stroke="#ef4444" strokeWidth={1.5} opacity={0.6} />
          <line x1={cx - half + 1} y1={cy + half - 1} x2={cx + half - 1} y2={cy + half - 1}
            stroke="#ef4444" strokeWidth={1.5} opacity={0.6} />
        </>
      )}

      {/* Label */}
      <text x={cx} y={cy + half + 10} style={{ ...labelStyle, fill: 'var(--text-muted, #888)' }} textAnchor="middle">
        {label}
      </text>
      {/* Scale ratio text */}
      <text x={cx} y={cy + half + 18} style={{ ...labelStyle, fill: color }} textAnchor="middle">
        {exploded ? '∞' : `${ratio.toFixed(2)}×`}
      </text>
    </g>
  );
}

export default function OrthoVsPerspDemo() {
  const [objZ, setObjZ] = useState(120);
  const d = 120;

  // Layout: left side = ray diagram, right side = screen previews
  const diagramW = 400;
  const screenAreaW = 140;
  const W = diagramW + screenAreaW;
  const H = 340;
  const halfH = (H - 20) / 2;
  const panelH = halfH - 2;
  const CY_ortho = panelH / 2;
  const CY_persp = panelH / 2;

  const camX = 40;
  const dScale = 0.45;
  const projPlaneX = camX + d * dScale;
  const objX = projPlaneX + objZ * dScale;
  const objHalf = 35;

  // Perspective projection
  const perspScale = d / (d + objZ);
  const perspProjHalf = objHalf * perspScale;
  const perspClamped = Math.min(panelH / 2 - 8, Math.abs(perspProjHalf));
  const perspSign = perspProjHalf >= 0 ? 1 : -1;
  const perspFlipped = objZ < -d;
  const perspExploded = !isFinite(perspScale) || Math.abs(perspProjHalf) > 500;

  // Orthographic projection: constant size
  const orthoZoom = 1;
  const orthoProjHalf = objHalf * orthoZoom;

  // Screen preview position
  const screenSize = 80;
  const screenCX = diagramW + screenAreaW / 2;
  const screenCY_ortho = CY_ortho;
  const screenCY_persp = halfH + CY_persp;

  // Screen visible range on the projection plane (objHalf = full screen height)
  const screenRangeHalf = objHalf;

  const labelStyle: React.CSSProperties = { fontSize: '0.55rem', fontFamily: 'monospace', fill: 'var(--text-muted, #888)' };
  const titleStyle: React.CSSProperties = { fontSize: '0.65rem', fontFamily: 'monospace', fontWeight: 600 };

  return (
    <div style={{ margin: '1.5rem 0' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted, #888)', fontFamily: 'monospace' }}>物体 z =</span>
        <NeuSlider min={-250} max={400} value={objZ} onChange={setObjZ} />
        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted, #888)', fontFamily: 'monospace', minWidth: '3rem', textAlign: 'right' }}>{objZ}</span>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', background: 'var(--neu-bg)', borderRadius: '1rem', boxShadow: 'inset 4px 4px 8px var(--neu-shadow-dark-strong), inset -4px -4px 8px var(--neu-shadow-light-strong)' }}>
        {/* Divider line */}
        <line x1={0} y1={halfH} x2={W} y2={halfH} stroke="var(--text-muted, #aaa)" strokeWidth={0.5} strokeDasharray="2 2" opacity={0.4} />
        {/* Vertical divider between diagram and screen area */}
        <line x1={diagramW} y1={0} x2={diagramW} y2={H - 20} stroke="var(--text-muted, #aaa)" strokeWidth={0.5} strokeDasharray="2 2" opacity={0.25} />

        {/* ── Top panel: Orthographic ── */}
        <g transform={`translate(0, 0)`}>
          <text x={12} y={16} style={{ ...titleStyle, fill: '#10b981' }}>正交投影</text>

          {/* z axis */}
          <line x1={20} y1={CY_ortho} x2={diagramW - 10} y2={CY_ortho} stroke="var(--text-muted, #aaa)" strokeWidth={0.5} strokeDasharray="4 2" />

          {/* Projection plane */}
          <line x1={projPlaneX} y1={24} x2={projPlaneX} y2={panelH - 8} stroke="#3b82f6" strokeWidth={1.5} />
          <text x={projPlaneX} y={panelH - 2} style={{ ...labelStyle, fill: '#3b82f6' }} textAnchor="middle">投影面（屏幕）</text>

          {/* Screen visible range on projection plane */}
          <rect x={projPlaneX - 6} y={CY_ortho - screenRangeHalf} width={12} height={screenRangeHalf * 2}
            rx={2} fill="#3b82f6" opacity={0.08} />
          <line x1={projPlaneX - 6} y1={CY_ortho - screenRangeHalf} x2={projPlaneX + 6} y2={CY_ortho - screenRangeHalf}
            stroke="#3b82f6" strokeWidth={0.8} opacity={0.5} />
          <line x1={projPlaneX - 6} y1={CY_ortho + screenRangeHalf} x2={projPlaneX + 6} y2={CY_ortho + screenRangeHalf}
            stroke="#3b82f6" strokeWidth={0.8} opacity={0.5} />

          {/* Object */}
          <line x1={objX} y1={CY_ortho - objHalf} x2={objX} y2={CY_ortho + objHalf}
            stroke="#10b981" strokeWidth={4} strokeLinecap="round" opacity={0.9} />
          <text x={objX} y={CY_ortho - objHalf - 6} style={{ ...labelStyle, fill: '#10b981' }} textAnchor="middle">物体</text>

          {/* Parallel projection rays */}
          <line x1={objX} y1={CY_ortho - objHalf} x2={projPlaneX} y2={CY_ortho - objHalf}
            stroke="#10b981" strokeWidth={0.7} opacity={0.4} strokeDasharray="3 2" />
          <line x1={objX} y1={CY_ortho + objHalf} x2={projPlaneX} y2={CY_ortho + objHalf}
            stroke="#10b981" strokeWidth={0.7} opacity={0.4} strokeDasharray="3 2" />
          <polygon points={`${projPlaneX + 6},${CY_ortho - objHalf - 3} ${projPlaneX + 6},${CY_ortho - objHalf + 3} ${projPlaneX},${CY_ortho - objHalf}`}
            fill="#10b981" opacity={0.4} />
          <polygon points={`${projPlaneX + 6},${CY_ortho + objHalf - 3} ${projPlaneX + 6},${CY_ortho + objHalf + 3} ${projPlaneX},${CY_ortho + objHalf}`}
            fill="#10b981" opacity={0.4} />

          {/* Projected segment */}
          <line x1={projPlaneX} y1={CY_ortho - orthoProjHalf} x2={projPlaneX} y2={CY_ortho + orthoProjHalf}
            stroke="#f59e0b" strokeWidth={4} strokeLinecap="round" opacity={0.8} />

          {/* Scale info */}
          <text x={diagramW - 12} y={panelH - 2} style={{ ...labelStyle, fontSize: '0.5rem' }} textAnchor="end">
            scale = {orthoZoom.toFixed(1)} (constant)
          </text>

          {/* Parallel rays label */}
          <text x={(objX + projPlaneX) / 2} y={CY_ortho - objHalf - 4} style={{ ...labelStyle, fontSize: '0.45rem', fill: '#10b981' }} textAnchor="middle">
            平行光线
          </text>
        </g>

        {/* ── Bottom panel: Perspective ── */}
        <g transform={`translate(0, ${halfH})`}>
          <text x={12} y={16} style={{ ...titleStyle, fill: '#6366f1' }}>透视投影</text>

          {/* z axis */}
          <line x1={20} y1={CY_persp} x2={diagramW - 10} y2={CY_persp} stroke="var(--text-muted, #aaa)" strokeWidth={0.5} strokeDasharray="4 2" />

          {/* Camera eye at z=-d */}
          <circle cx={camX} cy={CY_persp} r={4} fill="#6366f1" opacity={0.9} />
          <text x={camX} y={CY_persp - 10} style={{ ...labelStyle, fill: '#6366f1' }} textAnchor="middle">👁 z=-d</text>

          {/* Frustum cone */}
          <line x1={camX} y1={CY_persp} x2={diagramW - 10} y2={28} stroke="#6366f1" strokeWidth={0.5} opacity={0.12} />
          <line x1={camX} y1={CY_persp} x2={diagramW - 10} y2={panelH - 12} stroke="#6366f1" strokeWidth={0.5} opacity={0.12} />

          {/* Projection plane */}
          <line x1={projPlaneX} y1={24} x2={projPlaneX} y2={panelH - 8} stroke="#3b82f6" strokeWidth={1.5} />
          <text x={projPlaneX} y={panelH - 2} style={{ ...labelStyle, fill: '#3b82f6' }} textAnchor="middle">投影面（屏幕）</text>

          {/* Screen visible range on projection plane */}
          <rect x={projPlaneX - 6} y={CY_persp - screenRangeHalf} width={12} height={screenRangeHalf * 2}
            rx={2} fill="#3b82f6" opacity={0.08} />
          <line x1={projPlaneX - 6} y1={CY_persp - screenRangeHalf} x2={projPlaneX + 6} y2={CY_persp - screenRangeHalf}
            stroke="#3b82f6" strokeWidth={0.8} opacity={0.5} />
          <line x1={projPlaneX - 6} y1={CY_persp + screenRangeHalf} x2={projPlaneX + 6} y2={CY_persp + screenRangeHalf}
            stroke="#3b82f6" strokeWidth={0.8} opacity={0.5} />

          {/* Object */}
          <line x1={objX} y1={CY_persp - objHalf} x2={objX} y2={CY_persp + objHalf}
            stroke={perspFlipped ? '#ef4444' : '#6366f1'}
            strokeWidth={4} strokeLinecap="round"
            opacity={perspExploded ? 0.3 : 0.9} />
          <text x={objX} y={CY_persp - objHalf - 6}
            style={{ ...labelStyle, fill: perspFlipped ? '#ef4444' : '#6366f1' }}
            textAnchor="middle">物体</text>

          {/* Converging projection rays */}
          {!perspExploded && (
            <>
              <line x1={camX} y1={CY_persp} x2={objX} y2={CY_persp - objHalf}
                stroke="#f59e0b" strokeWidth={0.7} opacity={0.35} strokeDasharray="3 2" />
              <line x1={camX} y1={CY_persp} x2={objX} y2={CY_persp + objHalf}
                stroke="#f59e0b" strokeWidth={0.7} opacity={0.35} strokeDasharray="3 2" />

              {/* Projected segment */}
              <line x1={projPlaneX} y1={CY_persp - perspClamped * perspSign}
                x2={projPlaneX} y2={CY_persp + perspClamped * perspSign}
                stroke={perspFlipped ? '#ef4444' : '#f59e0b'} strokeWidth={4} strokeLinecap="round" opacity={0.8} />
            </>
          )}

          {/* Converging rays label */}
          {!perspExploded && (
            <text x={(objX + camX) / 2} y={CY_persp - 6} style={{ ...labelStyle, fontSize: '0.45rem', fill: '#6366f1' }} textAnchor="middle">
              汇聚光线
            </text>
          )}

          {/* Scale info */}
          <text x={diagramW - 12} y={panelH - 2} style={{ ...labelStyle, fontSize: '0.5rem' }} textAnchor="end">
            scale = d/(d+z) = {isFinite(perspScale) ? perspScale.toFixed(2) : '∞'}
          </text>

          {perspFlipped && !perspExploded && (
            <text x={projPlaneX + 8} y={CY_persp + 4} style={{ ...labelStyle, fill: '#ef4444' }}>⚠️ 翻转</text>
          )}
        </g>

        {/* ── Screen previews (right side) ── */}
        <ScreenView
          cx={screenCX} cy={screenCY_ortho} size={screenSize}
          projHalf={orthoProjHalf} color="#10b981"
          flipped={false} exploded={false} label="正交屏幕" />
        <ScreenView
          cx={screenCX} cy={screenCY_persp} size={screenSize}
          projHalf={perspProjHalf} color="#6366f1"
          flipped={perspFlipped} exploded={perspExploded} label="透视屏幕" />

        {/* ── Bottom comparison text ── */}
        <text x={12} y={H - 6} style={{ ...labelStyle, fontSize: '0.5rem', fill: '#10b981' }}>
          正交：投影大小 = {(orthoProjHalf * 2).toFixed(0)}px（不变）
        </text>
        <text x={W / 2} y={H - 6} style={{ ...labelStyle, fontSize: '0.5rem', fill: perspFlipped ? '#ef4444' : '#6366f1' }}>
          透视：投影大小 = {isFinite(perspProjHalf) ? (Math.abs(perspProjHalf) * 2).toFixed(0) : '∞'}px{perspFlipped ? '（翻转）' : ''}{!perspFlipped && isFinite(perspScale) ? ` （缩放 ${perspScale.toFixed(2)}×）` : ''}
        </text>
      </svg>
    </div>
  );
}
