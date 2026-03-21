import { useState, useCallback, useRef, useEffect } from 'react';

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

type V2 = [number, number];

// Sutherland-Hodgman: clip polygon against line z >= nearZ
// Each vertex is [x, z] in top-down view
function clipByNearPlane(verts: V2[], nearZ: number): V2[] {
  const out: V2[] = [];
  const n = verts.length;
  for (let i = 0; i < n; i++) {
    const curr = verts[i];
    const next = verts[(i + 1) % n];
    const cIn = curr[1] >= nearZ;
    const nIn = next[1] >= nearZ;
    if (cIn) out.push(curr);
    if (cIn !== nIn) {
      const t = (nearZ - curr[1]) / (next[1] - curr[1]);
      out.push([
        curr[0] + t * (next[0] - curr[0]),
        nearZ,
      ]);
    }
  }
  return out;
}

export default function ClippingDemo() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [triZ, setTriZ] = useState(60);

  // Near plane z threshold in world space
  const nearZ = 30;

  // Triangle: two back vertices fixed, front vertex moves with slider
  // [x, z] in world coords; z increases away from camera
  const tri: V2[] = [
    [-70, triZ + 100],
    [70, triZ + 100],
    [0, triZ],
  ];

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const W = canvas.width, H = canvas.height;

    // Top-down orthographic: x → screen x, z → screen y (z=0 at bottom, z increases upward)
    // Map world coords to canvas
    const scaleF = 1.2;
    const cx = W / 2;
    const toScreen = (v: V2): [number, number] => [
      cx + v[0] * scaleF,
      H - 30 - v[1] * scaleF,
    ];

    ctx.clearRect(0, 0, W, H);

    // Camera position (at z=0, bottom of view)
    const camScreen = toScreen([0, 0]);

    // Grid lines
    ctx.strokeStyle = 'var(--text-muted, #aaa)';
    ctx.globalAlpha = 0.08;
    ctx.lineWidth = 0.5;
    for (let x = -200; x <= 200; x += 40) {
      const a = toScreen([x, 0]);
      const b = toScreen([x, 250]);
      ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke();
    }
    for (let z = 0; z <= 250; z += 40) {
      const a = toScreen([-200, z]);
      const b = toScreen([200, z]);
      ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke();
    }
    ctx.globalAlpha = 1;

    // Near plane line
    const npL = toScreen([-200, nearZ]);
    const npR = toScreen([200, nearZ]);
    ctx.strokeStyle = '#ef4444';
    ctx.lineWidth = 2;
    ctx.setLineDash([6, 3]);
    ctx.beginPath(); ctx.moveTo(npL[0], npL[1]); ctx.lineTo(npR[0], npR[1]); ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = '#ef4444';
    ctx.font = '11px monospace';
    ctx.textAlign = 'right';
    ctx.fillText('近平面 z=' + nearZ, npR[0] - 4, npR[1] - 6);

    // Camera icon
    ctx.fillStyle = '#6366f1';
    ctx.beginPath(); ctx.arc(camScreen[0], camScreen[1], 5, 0, Math.PI * 2); ctx.fill();
    ctx.font = '10px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('📷 相机 z=0', camScreen[0], camScreen[1] + 16);

    // Draw original triangle (ghost)
    const origScreen = tri.map(toScreen);
    ctx.beginPath();
    ctx.moveTo(origScreen[0][0], origScreen[0][1]);
    for (let i = 1; i < origScreen.length; i++) ctx.lineTo(origScreen[i][0], origScreen[i][1]);
    ctx.closePath();
    ctx.fillStyle = 'rgba(99, 102, 241, 0.08)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(99, 102, 241, 0.3)';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([4, 3]);
    ctx.stroke();
    ctx.setLineDash([]);

    // Original vertex dots
    origScreen.forEach(p => {
      ctx.beginPath(); ctx.arc(p[0], p[1], 3, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(99, 102, 241, 0.4)'; ctx.fill();
    });

    // Clipped polygon
    const clipped = clipByNearPlane(tri, nearZ);
    if (clipped.length >= 3) {
      const clippedScreen = clipped.map(toScreen);
      ctx.beginPath();
      ctx.moveTo(clippedScreen[0][0], clippedScreen[0][1]);
      for (let i = 1; i < clippedScreen.length; i++) ctx.lineTo(clippedScreen[i][0], clippedScreen[i][1]);
      ctx.closePath();
      ctx.fillStyle = 'rgba(16, 185, 129, 0.2)';
      ctx.fill();
      ctx.strokeStyle = '#10b981';
      ctx.lineWidth = 2;
      ctx.stroke();

      // Vertex dots: red for clipped intersection points, green for original
      clipped.forEach((v, i) => {
        const p = clippedScreen[i];
        const isNewPoint = Math.abs(v[1] - nearZ) < 0.01;
        ctx.beginPath(); ctx.arc(p[0], p[1], isNewPoint ? 5 : 3, 0, Math.PI * 2);
        ctx.fillStyle = isNewPoint ? '#ef4444' : '#10b981'; ctx.fill();
        if (isNewPoint) {
          ctx.font = '9px monospace';
          ctx.fillStyle = '#ef4444';
          ctx.textAlign = 'left';
          ctx.fillText('交点', p[0] + 7, p[1] + 3);
        }
      });
    }

    // Status text
    ctx.fillStyle = 'var(--text-muted, #888)';
    ctx.font = '10px monospace';
    ctx.textAlign = 'right';
    const behind = tri.filter(v => v[1] < nearZ).length;
    const msg = behind === 0
      ? '所有顶点在近平面前方 — 无需裁剪'
      : behind === tri.length
        ? '所有顶点在近平面后方 — 整个三角形被丢弃'
        : `${behind} 个顶点在近平面后方 — 裁剪为 ${clipped.length} 边形`;
    ctx.fillText(msg, W - 8, H - 8);

    // Legend
    ctx.textAlign = 'left';
    ctx.fillStyle = 'rgba(99, 102, 241, 0.3)';
    ctx.fillRect(8, H - 36, 10, 10);
    ctx.fillStyle = 'var(--text-muted, #888)';
    ctx.font = '9px monospace';
    ctx.fillText('原始三角形', 22, H - 27);
    ctx.fillStyle = 'rgba(16, 185, 129, 0.4)';
    ctx.fillRect(8, H - 22, 10, 10);
    ctx.fillStyle = 'var(--text-muted, #888)';
    ctx.fillText('裁剪后', 22, H - 13);
  }, [triZ]);

  return (
    <div style={{ margin: '1.5rem 0' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted, #888)', fontFamily: 'monospace' }}>前端顶点 z =</span>
        <NeuSlider min={-40} max={120} value={triZ} onChange={setTriZ} />
        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted, #888)', fontFamily: 'monospace', minWidth: '3rem', textAlign: 'right' }}>{triZ}</span>
      </div>
      <canvas ref={canvasRef} width={520} height={360}
        style={{ width: '100%', background: 'var(--neu-bg)', borderRadius: '1rem', boxShadow: 'inset 4px 4px 8px var(--neu-shadow-dark-strong), inset -4px -4px 8px var(--neu-shadow-light-strong)' }} />
    </div>
  );
}
