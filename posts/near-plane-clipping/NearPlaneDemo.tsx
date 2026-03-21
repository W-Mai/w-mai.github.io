import { useState, useCallback, useRef } from 'react';

// Neumorphism slider using CSS tokens from tokens.css
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
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
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

export default function NearPlaneDemo() {
  const [objZ, setObjZ] = useState(80);
  const d = 120;
  const W = 520, H = 260, CY = H / 2;

  // Layout: camera on left, projection plane at z=0, object at z=objZ
  // Camera position in SVG x-coords
  const camX = 50;
  // Projection plane at camX + d_scaled
  const dScale = 0.55;
  const projPlaneX = camX + d * dScale;
  // Object x position
  const objX = projPlaneX + objZ * dScale;
  // Clip plane at z = -1.3d (leave room to see flipped projection between -d and -1.3d)
  const clipThreshold = 1.3;
  const clipPlaneX = projPlaneX + (-clipThreshold * d) * dScale;

  // Object half-height in world space
  const objHalf = 40;
  // Perspective scale factor
  const scale = d / (d + objZ);
  // Projected half-height on projection plane
  const projHalf = objHalf * scale;
  // Clamp projected size for display
  const clampedProjHalf = Math.min(CY - 10, Math.abs(projHalf));
  const projSign = projHalf >= 0 ? 1 : -1;

  // Flipped when behind camera, clipped when past clip threshold
  const flipped = objZ < -d;
  const clipped = objZ < -d * clipThreshold;
  const showProjection = !clipped && isFinite(scale);

  const labelStyle: React.CSSProperties = { fontSize: '0.6rem', fontFamily: 'monospace', fill: 'var(--text-muted, #888)' };

  return (
    <div style={{ margin: '1.5rem 0' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted, #888)', fontFamily: 'monospace' }}>物体 z =</span>
        <NeuSlider min={-300} max={500} value={objZ} onChange={setObjZ} />
        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted, #888)', fontFamily: 'monospace', minWidth: '3rem', textAlign: 'right' }}>{objZ}</span>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', background: 'var(--neu-bg)', borderRadius: '1rem', boxShadow: 'inset 4px 4px 8px var(--neu-shadow-dark-strong), inset -4px -4px 8px var(--neu-shadow-light-strong)' }}>
        {/* z axis */}
        <line x1={20} y1={CY} x2={W - 10} y2={CY} stroke="var(--text-muted, #aaa)" strokeWidth={0.5} strokeDasharray="4 2" />
        <text x={W - 8} y={CY + 4} style={labelStyle} textAnchor="start">z</text>

        {/* camera eye */}
        <circle cx={camX} cy={CY} r={5} fill="#6366f1" opacity={0.9} />
        <text x={camX} y={CY - 12} style={{ ...labelStyle, fill: '#6366f1' }} textAnchor="middle">👁 相机</text>

        {/* clip plane */}
        <line x1={clipPlaneX} y1={20} x2={clipPlaneX} y2={H - 20} stroke="#ef4444" strokeWidth={1} strokeDasharray="4 2" />
        <text x={clipPlaneX} y={14} style={{ ...labelStyle, fill: '#ef4444' }} textAnchor="middle">裁剪面 (-{clipThreshold}d)</text>

        {/* projection plane */}
        <line x1={projPlaneX} y1={20} x2={projPlaneX} y2={H - 20} stroke="#3b82f6" strokeWidth={1.5} />
        <text x={projPlaneX} y={14} style={{ ...labelStyle, fill: '#3b82f6' }} textAnchor="middle">投影面 (z=0)</text>

        {/* frustum cone from camera */}
        <line x1={camX} y1={CY} x2={W - 10} y2={30} stroke="#6366f1" strokeWidth={0.5} opacity={0.15} />
        <line x1={camX} y1={CY} x2={W - 10} y2={H - 30} stroke="#6366f1" strokeWidth={0.5} opacity={0.15} />

        {/* object: vertical bar */}
        <line x1={objX} y1={CY - objHalf} x2={objX} y2={CY + objHalf}
          stroke={clipped ? '#ef4444' : flipped ? '#f59e0b' : '#10b981'}
          strokeWidth={4} strokeLinecap="round"
          opacity={clipped ? 0.3 : 0.9} />
        <text x={objX} y={CY - objHalf - 8}
          style={{ ...labelStyle, fill: clipped ? '#ef4444' : flipped ? '#f59e0b' : '#10b981' }}
          textAnchor="middle">物体</text>

        {/* projection rays + projected segment */}
        {showProjection && (
          <>
            {/* rays from camera through object top/bottom */}
            <line x1={camX} y1={CY} x2={objX} y2={CY - objHalf}
              stroke="#f59e0b" strokeWidth={0.7} opacity={0.35} strokeDasharray="3 2" />
            <line x1={camX} y1={CY} x2={objX} y2={CY + objHalf}
              stroke="#f59e0b" strokeWidth={0.7} opacity={0.35} strokeDasharray="3 2" />
            {/* projected segment on projection plane: top projects to CY - projHalf, bottom to CY + projHalf */}
            {/* When flipped (scale < 0), projHalf is negative, so top/bottom swap */}
            <line x1={projPlaneX} y1={CY - clampedProjHalf * projSign}
              x2={projPlaneX} y2={CY + clampedProjHalf * projSign}
              stroke={flipped ? '#ef4444' : '#f59e0b'} strokeWidth={4} strokeLinecap="round" opacity={0.8} />
            {/* small markers showing which end is "top" vs "bottom" of projection */}
            {flipped && (
              <>
                <circle cx={projPlaneX} cy={CY + clampedProjHalf} r={3} fill="#ef4444" opacity={0.8} />
                <text x={projPlaneX + 8} y={CY + clampedProjHalf + 3} style={{ ...labelStyle, fill: '#ef4444', fontSize: '0.5rem' }}>上↓</text>
                <circle cx={projPlaneX} cy={CY - clampedProjHalf} r={3} fill="#ef4444" opacity={0.8} />
                <text x={projPlaneX + 8} y={CY - clampedProjHalf + 3} style={{ ...labelStyle, fill: '#ef4444', fontSize: '0.5rem' }}>下↑</text>
              </>
            )}
            <text x={projPlaneX + 8} y={CY + 4}
              style={{ ...labelStyle, fill: flipped ? '#ef4444' : '#f59e0b' }}>
              投影{flipped ? ' ⚠️翻转' : ''}
            </text>
          </>
        )}

        {clipped && (
          <text x={objX} y={CY + objHalf + 16}
            style={{ ...labelStyle, fill: '#ef4444' }} textAnchor="middle">已裁剪</text>
        )}

        {/* scale factor display */}
        <text x={W - 12} y={H - 8} style={{ ...labelStyle, fontSize: '0.55rem' }} textAnchor="end">
          scale = {isFinite(scale) ? scale.toFixed(2) : '∞'}
        </text>
      </svg>
    </div>
  );
}
