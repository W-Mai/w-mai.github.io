import { useState, useCallback, useRef } from 'react';

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

export default function FlipDemo() {
  const [rectZ, setRectZ] = useState(80);
  const d = 120;

  // Rectangle: front edge at rectZ, back edge at rectZ+80, width 60 centered
  // Rotated ~15° so one corner crosses z=-d first
  const rectDepth = 80;
  const rectW = 60;
  const cx = 0;
  const cz = rectZ + rectDepth / 2;
  const angle = 15 * Math.PI / 180;
  const cosA = Math.cos(angle);
  const sinA = Math.sin(angle);

  // Unrotated corners relative to center
  const raw: [number, number][] = [
    [-rectW / 2, -rectDepth / 2],
    [rectW / 2, -rectDepth / 2],
    [rectW / 2, rectDepth / 2],
    [-rectW / 2, rectDepth / 2],
  ];

  // Rotate and translate to world coords
  const corners: [number, number][] = raw.map(([lx, lz]) => [
    cx + lx * cosA - lz * sinA,
    cz + lx * sinA + lz * cosA,
  ]);

  // Perspective project: x' = x * d/(d+z)
  const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

  // Layout
  const W = 540, H = 240;
  const topViewW = W * 0.48;
  const screenViewW = W - topViewW;
  const labelStyle: React.CSSProperties = { fontSize: '0.5rem', fontFamily: 'monospace', fill: 'var(--text-muted, #888)' };

  // Top-down view mapping: z -> screen y, x -> screen x
  const topCX = topViewW / 2;
  const topCY = H / 2;
  const topScale = 0.45;
  const toTop = (x: number, z: number): [number, number] => [
    topCX + x * topScale,
    topCY - z * topScale,
  ];

  // Screen view: projected x mapped to a square viewport
  const screenCX = topViewW + screenViewW / 2;
  const screenCY = H / 2;
  const screenHalf = 90;
  // Smaller scale so the bowtie stays visible inside the screen box
  const screenScale = 0.6;
  // Screen visible range in world coords (projection result within this range fits on screen)
  const screenWorldRange = 50;

  // Project all corners
  const projected = corners.map(([x, z]) => {
    const scale = d / (d + z);
    const px = x * scale;
    const exploded = !isFinite(scale) || Math.abs(px) > 2000;
    return { px, scale, exploded, behind: z < -d };
  });
  const anyBehind = projected.some(p => p.behind);
  const anyFront = projected.some(p => !p.behind);
  const mixed = anyBehind && anyFront;

  // Status
  const status = projected.every(p => !p.behind)
    ? '✅ 所有角点在相机前方 — 正常投影'
    : projected.every(p => p.behind)
      ? '🔴 所有角点在相机后方 — 完全翻转'
      : '⚠️ 部分角点穿过相机 — 蝴蝶结 / 爆炸';

  return (
    <div style={{ margin: '1.5rem 0' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted, #888)', fontFamily: 'monospace' }}>前边 z =</span>
        <NeuSlider min={-250} max={300} value={rectZ} onChange={setRectZ} />
        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted, #888)', fontFamily: 'monospace', minWidth: '3.5rem', textAlign: 'right' }}>{rectZ}</span>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', background: 'var(--neu-bg)', borderRadius: '1rem', boxShadow: 'inset 4px 4px 8px var(--neu-shadow-dark-strong), inset -4px -4px 8px var(--neu-shadow-light-strong)' }}>

        {/* Vertical divider */}
        <line x1={topViewW} y1={0} x2={topViewW} y2={H} stroke="var(--text-muted, #aaa)" strokeWidth={0.5} strokeDasharray="2 2" opacity={0.3} />

        {/* ── Left: Top-down view ── */}
        <text x={8} y={14} style={{ ...labelStyle, fontSize: '0.55rem', fontWeight: 600 }}>俯视图（x-z 平面）</text>

        {/* z axis (vertical in top-down) */}
        <line x1={topCX} y1={10} x2={topCX} y2={H - 10}
          stroke="var(--text-muted, #aaa)" strokeWidth={0.4} strokeDasharray="3 2" opacity={0.3} />
        <text x={topCX + 4} y={16} style={{ ...labelStyle, fontSize: '0.4rem' }}>+z</text>

        {/* Projection plane (screen) at z=0 — horizontal line */}
        {(() => {
          const [, py] = toTop(0, 0);
          const screenRange = screenWorldRange * topScale;
          return (
            <>
              <line x1={10} y1={py} x2={topViewW - 10} y2={py} stroke="#3b82f6" strokeWidth={1.2} opacity={0.5} />
              {/* Screen visible range */}
              <rect x={topCX - screenRange} y={py - 5} width={screenRange * 2} height={10}
                rx={2} fill="#3b82f6" opacity={0.08} />
              <line x1={topCX - screenRange} y1={py - 5} x2={topCX - screenRange} y2={py + 5}
                stroke="#3b82f6" strokeWidth={0.8} opacity={0.5} />
              <line x1={topCX + screenRange} y1={py - 5} x2={topCX + screenRange} y2={py + 5}
                stroke="#3b82f6" strokeWidth={0.8} opacity={0.5} />
              <text x={topViewW - 10} y={py - 6} style={{ ...labelStyle, fill: '#3b82f6', fontSize: '0.45rem' }} textAnchor="end">投影面（屏幕）</text>
            </>
          );
        })()}

        {/* Camera at z=-d */}
        {(() => {
          const [camSx, camSy] = toTop(0, -d);
          return (
            <>
              <circle cx={camSx} cy={camSy} r={4} fill="#6366f1" opacity={0.9} />
              <text x={camSx + 8} y={camSy + 3} style={{ ...labelStyle, fill: '#6366f1', fontSize: '0.45rem' }}>👁 相机 (z=-d)</text>
            </>
          );
        })()}

        {/* Danger zone behind camera */}
        {(() => {
          const [lx, ly] = toTop(-120, -d);
          const [rx, ry] = toTop(120, -d);
          return (
            <>
              <line x1={lx} y1={ly} x2={rx} y2={ry} stroke="#ef4444" strokeWidth={1} strokeDasharray="4 2" opacity={0.5} />
              <text x={rx + 2} y={ry - 4} style={{ ...labelStyle, fill: '#ef4444', fontSize: '0.4rem' }}>← 穿过此线投影翻转</text>
            </>
          );
        })()}

        {/* Rectangle in 3D space */}
        {(() => {
          const pts = corners.map(([x, z]) => toTop(x, z));
          const d_str = pts.map(p => `${p[0]},${p[1]}`).join(' ');
          return (
            <>
              <polygon points={d_str} fill={mixed ? 'rgba(239,68,68,0.1)' : anyBehind ? 'rgba(239,68,68,0.15)' : 'rgba(99,102,241,0.1)'}
                stroke={mixed ? '#f59e0b' : anyBehind ? '#ef4444' : '#6366f1'} strokeWidth={1.5} />
              {pts.map((p, i) => (
                <circle key={i} cx={p[0]} cy={p[1]} r={3}
                  fill={corners[i][1] < -d ? '#ef4444' : '#6366f1'} opacity={0.8} />
              ))}
            </>
          );
        })()}

        {/* Corner labels */}
        {corners.map(([x, z], i) => {
          const [sx, sy] = toTop(x, z);
          const label = ['FL', 'FR', 'BR', 'BL'][i];
          return (
            <text key={i} x={sx + (x < 0 ? -10 : 6)} y={sy - 5}
              style={{ ...labelStyle, fontSize: '0.4rem', fill: z < -d ? '#ef4444' : '#6366f1' }}>
              {label}
            </text>
          );
        })}

        {/* ── Right: Screen view (projected) ── */}
        <text x={topViewW + 8} y={14} style={{ ...labelStyle, fontSize: '0.55rem', fontWeight: 600 }}>屏幕投影结果</text>

        {/* Screen boundary */}
        <rect x={screenCX - screenHalf} y={screenCY - screenHalf} width={screenHalf * 2} height={screenHalf * 2}
          rx={3} fill="none" stroke="var(--text-muted, #aaa)" strokeWidth={0.8} opacity={0.4} />
        <rect x={screenCX - screenHalf} y={screenCY - screenHalf} width={screenHalf * 2} height={screenHalf * 2}
          rx={3} fill="var(--neu-bg)" opacity={0.2} />

        {/* Crosshair */}
        <line x1={screenCX - screenHalf} y1={screenCY} x2={screenCX + screenHalf} y2={screenCY}
          stroke="var(--text-muted, #aaa)" strokeWidth={0.3} opacity={0.2} />
        <line x1={screenCX} y1={screenCY - screenHalf} x2={screenCX} y2={screenCY + screenHalf}
          stroke="var(--text-muted, #aaa)" strokeWidth={0.3} opacity={0.2} />

        {/* Screen visible range (matches left-side screen range indicator) */}
        {(() => {
          const rangeHalf = screenWorldRange * screenScale;
          return (
            <rect x={screenCX - rangeHalf} y={screenCY - rangeHalf} width={rangeHalf * 2} height={rangeHalf * 2}
              rx={2} fill="#3b82f6" opacity={0.06} stroke="#3b82f6" strokeWidth={0.8} strokeDasharray="3 2" />
          );
        })()}

        {/* Clip path for screen */}
        <defs>
          <clipPath id="flip-screen-clip">
            <rect x={screenCX - screenHalf} y={screenCY - screenHalf} width={screenHalf * 2} height={screenHalf * 2} />
          </clipPath>
        </defs>

        {/* Projected quadrilateral */}
        {(() => {
          // Project corners to screen coords with clamping for visibility
          const maxCoord = screenHalf * 2.5;
          const screenPts = corners.map(([x, z], i) => {
            const denom = d + z;
            if (Math.abs(denom) < 0.5) {
              // Near singularity — push to edge
              const sx = x >= 0 ? 1 : -1;
              return [
                screenCX + clamp(sx * maxCoord, -maxCoord, maxCoord) * screenScale,
                screenCY + clamp((i < 2 ? -1 : 1) * maxCoord, -maxCoord, maxCoord) * screenScale,
              ] as [number, number];
            }
            const scale = d / denom;
            const px = x * scale;
            const py = (i < 2 ? -20 : 20) * scale;
            return [
              screenCX + clamp(px, -maxCoord, maxCoord) * screenScale,
              screenCY + clamp(py, -maxCoord, maxCoord) * screenScale,
            ] as [number, number];
          });

          const pts = screenPts;
          const d_str = pts.map(p => `${p[0]},${p[1]}`).join(' ');

          return (
            <g clipPath="url(#flip-screen-clip)">
              <polygon points={d_str}
                fill={mixed ? 'rgba(245,158,11,0.15)' : anyBehind ? 'rgba(239,68,68,0.15)' : 'rgba(99,102,241,0.12)'}
                stroke={mixed ? '#f59e0b' : anyBehind ? '#ef4444' : '#6366f1'}
                strokeWidth={1.5} />
              {pts.map((p, i) => (
                <circle key={i} cx={p[0]} cy={p[1]} r={3}
                  fill={corners[i][1] < -d ? '#ef4444' : '#6366f1'} opacity={0.8} />
              ))}
              {pts.map((p, i) => {
                const label = ['FL', 'FR', 'BR', 'BL'][i];
                return (
                  <text key={`l${i}`} x={p[0] + 5} y={p[1] - 4}
                    style={{ ...labelStyle, fontSize: '0.4rem', fill: corners[i][1] < -d ? '#ef4444' : '#6366f1' }}>
                    {label}
                  </text>
                );
              })}
            </g>
          );
        })()}

        {/* Status text */}
        <text x={W / 2} y={H - 6} style={{ ...labelStyle, fontSize: '0.5rem' }} textAnchor="middle">
          {status}
        </text>
      </svg>
    </div>
  );
}
