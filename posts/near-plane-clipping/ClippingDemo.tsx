import { useState, useCallback, useRef, useEffect } from 'react';

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

type V3 = [number, number, number];

// Sutherland-Hodgman: clip polygon by near plane (z >= nearZ)
function clipByNearPlane(verts: V3[], nearZ: number): V3[] {
  const out: V3[] = [];
  const n = verts.length;
  for (let i = 0; i < n; i++) {
    const curr = verts[i];
    const next = verts[(i + 1) % n];
    const cIn = curr[2] >= nearZ;
    const nIn = next[2] >= nearZ;
    if (cIn) out.push(curr);
    if (cIn !== nIn) {
      const t = (nearZ - curr[2]) / (next[2] - curr[2]);
      out.push([
        curr[0] + t * (next[0] - curr[0]),
        curr[1] + t * (next[1] - curr[1]),
        nearZ,
      ]);
    }
  }
  return out;
}

// Simple 3D camera: lookAt from elevated position
function makeCamera(eye: V3, target: V3) {
  const sub = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
  const cross = (a: V3, b: V3): V3 => [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0],
  ];
  const norm = (v: V3): V3 => {
    const l = Math.sqrt(v[0] * v[0] + v[1] * v[1] + v[2] * v[2]);
    return l > 0 ? [v[0] / l, v[1] / l, v[2] / l] : [0, 0, 0];
  };
  const dot = (a: V3, b: V3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

  const fwd = norm(sub(target, eye));
  const worldUp: V3 = [0, 1, 0];
  const right = norm(cross(fwd, worldUp));
  const up = cross(right, fwd);

  return (p: V3): V3 => {
    const d = sub(p, eye);
    return [dot(d, right), dot(d, up), dot(d, fwd)];
  };
}

// Screen range in world coords: how wide/tall the screen covers at z=0
const SCREEN_HALF_W = 50;
const SCREEN_HALF_H = 35;
// Scene camera distance (projection plane at z=0, camera at z=-d)
const SCENE_D = 120;

export default function ClippingDemo() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [triZ, setTriZ] = useState(60);
  const nearZ = 30;

  // 3D triangle: y up, z depth (away from scene camera at z=0)
  const tri: V3[] = [
    [-60, 0, triZ + 100],
    [60, 0, triZ + 100],
    [0, 50, triZ],
  ];

  const clipped = clipByNearPlane(tri, nearZ);

  const ASPECT = 520 / 260;
  const SPLIT = 0.62; // left panel ratio

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const draw = () => {
      const dpr = window.devicePixelRatio || 1;
      const cssW = canvas.clientWidth;
      const cssH = Math.round(cssW / ASPECT);
      canvas.width = cssW * dpr;
      canvas.height = cssH * dpr;
      canvas.style.height = `${cssH}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      const W = cssW, H = cssH;
      const leftW = Math.round(W * SPLIT);
      const rightW = W - leftW;

      ctx.clearRect(0, 0, W, H);
      const gridColor = getComputedStyle(canvas).getPropertyValue('--text-muted') || '#aaa';
      const pad = 12;

      // ── Left panel: 3D perspective view ──
      draw3DView(ctx, leftW, H, gridColor, pad, tri, clipped, nearZ);

      // ── Divider ──
      ctx.save();
      ctx.setLineDash([3, 3]);
      ctx.strokeStyle = gridColor;
      ctx.globalAlpha = 0.3;
      ctx.lineWidth = 0.5;
      ctx.beginPath();
      ctx.moveTo(leftW, 0);
      ctx.lineTo(leftW, H);
      ctx.stroke();
      ctx.restore();

      // ── Right panel: Screen preview ──
      drawScreenPreview(ctx, leftW, rightW, H, gridColor, pad, tri, clipped, nearZ);
    };

    draw();
    const ro = new ResizeObserver(draw);
    ro.observe(canvas);
    return () => ro.disconnect();
  }, [triZ]);

  return (
    <div style={{ margin: '1.5rem 0' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted, #888)', fontFamily: 'monospace' }}>前端顶点 z =</span>
        <NeuSlider min={-40} max={120} value={triZ} onChange={setTriZ} />
        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted, #888)', fontFamily: 'monospace', minWidth: '3rem', textAlign: 'right' }}>{triZ}</span>
      </div>
      <canvas ref={canvasRef}
        style={{ width: '100%', background: 'var(--neu-bg)', borderRadius: '1rem', boxShadow: 'inset 4px 4px 8px var(--neu-shadow-dark-strong), inset -4px -4px 8px var(--neu-shadow-light-strong)' }} />
    </div>
  );
}

// ── 3D View Drawing ──

function draw3DView(
  ctx: CanvasRenderingContext2D,
  W: number, H: number,
  gridColor: string, pad: number,
  tri: V3[], clipped: V3[], nearZ: number,
) {
  const viewEye: V3 = [180, 160, -60];
  const viewTarget: V3 = [0, 20, 80];
  const toCam = makeCamera(viewEye, viewTarget);
  const focalLen = 400;

  const project = (p: V3): [number, number] | null => {
    const c = toCam(p);
    if (c[2] < 0.1) return null;
    const scale = focalLen / c[2];
    return [W / 2 + c[0] * scale, H / 2 - 20 - c[1] * scale];
  };

  const fillPoly = (pts: ([number, number] | null)[], fill: string, stroke: string, lw: number, dash?: number[]) => {
    const valid = pts.filter((p): p is [number, number] => p !== null);
    if (valid.length < 2) return;
    ctx.beginPath();
    ctx.moveTo(valid[0][0], valid[0][1]);
    for (let i = 1; i < valid.length; i++) ctx.lineTo(valid[i][0], valid[i][1]);
    ctx.closePath();
    if (fill) { ctx.fillStyle = fill; ctx.fill(); }
    if (stroke) {
      ctx.strokeStyle = stroke; ctx.lineWidth = lw;
      if (dash) ctx.setLineDash(dash);
      ctx.stroke();
      ctx.setLineDash([]);
    }
  };

  const drawLine = (a: V3, b: V3, color: string, lw: number, dash?: number[]) => {
    const pa = project(a), pb = project(b);
    if (!pa || !pb) return;
    ctx.beginPath();
    ctx.moveTo(pa[0], pa[1]); ctx.lineTo(pb[0], pb[1]);
    ctx.strokeStyle = color; ctx.lineWidth = lw;
    if (dash) ctx.setLineDash(dash);
    ctx.stroke();
    ctx.setLineDash([]);
  };

  // Ground grid (y=0 plane)
  ctx.globalAlpha = 0.12;
  for (let x = -160; x <= 160; x += 40) drawLine([x, 0, -20], [x, 0, 220], gridColor, 0.5);
  for (let z = -20; z <= 220; z += 40) drawLine([-160, 0, z], [160, 0, z], gridColor, 0.5);
  ctx.globalAlpha = 1;

  // Z axis
  drawLine([0, 0, -20], [0, 0, 220], gridColor, 0.8, [4, 2]);
  const zLabel = project([0, 0, 225]);
  if (zLabel) {
    ctx.fillStyle = gridColor; ctx.font = '10px monospace'; ctx.textAlign = 'left';
    ctx.fillText('+z', zLabel[0] + 4, zLabel[1]);
  }

  // Projection plane (screen) at z=0 — full quad
  const ppW = 140, ppH = 70;
  const projPlane: V3[] = [[-ppW, 0, 0], [ppW, 0, 0], [ppW, ppH, 0], [-ppW, ppH, 0]];
  fillPoly(projPlane.map(project), 'rgba(59,130,246,0.06)', '#3b82f6', 1.2, [4, 2]);

  // Screen visible range on projection plane (highlighted inner rect)
  const screenQuad: V3[] = [
    [-SCREEN_HALF_W, 0, 0], [SCREEN_HALF_W, 0, 0],
    [SCREEN_HALF_W, SCREEN_HALF_H, 0], [-SCREEN_HALF_W, SCREEN_HALF_H, 0],
  ];
  fillPoly(screenQuad.map(project), 'rgba(59,130,246,0.12)', '#3b82f6', 1.5);

  const ppLabel = project([ppW + 8, ppH * 0.6, 0]);
  if (ppLabel) {
    ctx.fillStyle = '#3b82f6'; ctx.font = '11px monospace'; ctx.textAlign = 'left';
    ctx.fillText('投影面（屏幕）z=0', ppLabel[0], ppLabel[1]);
  }

  // Near plane quad
  const npW = 140, npH = 70;
  const nearQuad: V3[] = [[-npW, 0, nearZ], [npW, 0, nearZ], [npW, npH, nearZ], [-npW, npH, nearZ]];
  fillPoly(nearQuad.map(project), 'rgba(239,68,68,0.08)', '#ef4444', 1.5, [5, 3]);
  const npLabel = project([npW + 8, npH * 0.6, nearZ]);
  if (npLabel) {
    ctx.fillStyle = '#ef4444'; ctx.font = '11px monospace'; ctx.textAlign = 'left';
    ctx.fillText(`近平面 z=${nearZ}`, npLabel[0], npLabel[1]);
  }

  // Original triangle (ghost)
  fillPoly(tri.map(project), 'rgba(99,102,241,0.06)', 'rgba(99,102,241,0.35)', 1.5, [4, 3]);
  tri.forEach(v => {
    const p = project(v);
    if (!p) return;
    ctx.beginPath(); ctx.arc(p[0], p[1], 3, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(99,102,241,0.5)'; ctx.fill();
  });

  // Clipped polygon
  if (clipped.length >= 3) {
    fillPoly(clipped.map(project), 'rgba(16,185,129,0.18)', '#10b981', 2);
    clipped.forEach(v => {
      const p = project(v);
      if (!p) return;
      const isNew = Math.abs(v[2] - nearZ) < 0.01 &&
        !tri.some(t => Math.abs(t[0] - v[0]) < 0.01 && Math.abs(t[2] - v[2]) < 0.01);
      ctx.beginPath(); ctx.arc(p[0], p[1], isNew ? 5 : 3, 0, Math.PI * 2);
      ctx.fillStyle = isNew ? '#ef4444' : '#10b981'; ctx.fill();
      if (isNew) {
        ctx.fillStyle = '#ef4444'; ctx.font = '10px monospace'; ctx.textAlign = 'left';
        ctx.fillText('交点', p[0] + 8, p[1] + 3);
      }
    });
  }

  // Scene camera icon (at z=0)
  const camP = project([0, 8, 0]);
  if (camP) {
    ctx.beginPath(); ctx.arc(camP[0], camP[1], 5, 0, Math.PI * 2);
    ctx.fillStyle = '#6366f1'; ctx.fill();
    ctx.fillStyle = '#6366f1'; ctx.font = '10px monospace'; ctx.textAlign = 'center';
    ctx.fillText('📷 相机', camP[0], camP[1] + 16);
  }

  // Legend
  ctx.textAlign = 'left';
  const ly = H - 46;
  ctx.fillStyle = 'rgba(99,102,241,0.3)'; ctx.fillRect(pad, ly, 10, 10);
  ctx.fillStyle = gridColor; ctx.font = '10px monospace';
  ctx.fillText('原始三角形', pad + 14, ly + 9);
  ctx.fillStyle = 'rgba(16,185,129,0.4)'; ctx.fillRect(pad, ly + 14, 10, 10);
  ctx.fillStyle = gridColor;
  ctx.fillText('裁剪后', pad + 14, ly + 23);
  ctx.beginPath(); ctx.arc(pad + 5, ly + 31, 3, 0, Math.PI * 2);
  ctx.fillStyle = '#ef4444'; ctx.fill();
  ctx.fillStyle = gridColor;
  ctx.fillText('裁剪交点', pad + 14, ly + 34);

  // Status
  const behind = tri.filter(v => v[2] < nearZ).length;
  const msg = behind === 0
    ? '无需裁剪'
    : behind === tri.length
      ? '整个三角形被丢弃'
      : `裁剪为 ${clipped.length} 边形`;
  ctx.fillStyle = gridColor; ctx.font = '10px monospace'; ctx.textAlign = 'right';
  ctx.fillText(msg, W - pad, H - pad);
}

// ── Screen Preview Drawing ──

function drawScreenPreview(
  ctx: CanvasRenderingContext2D,
  leftW: number, rightW: number, H: number,
  gridColor: string, pad: number,
  tri: V3[], clipped: V3[], nearZ: number,
) {
  const cx = leftW + rightW / 2;
  const cy = H / 2;
  // Screen box size (fit within right panel with padding)
  const boxH = H - pad * 6;
  const boxW = boxH * (SCREEN_HALF_W / SCREEN_HALF_H);
  const halfW = boxW / 2;
  const halfH = boxH / 2;

  // Title
  ctx.fillStyle = gridColor; ctx.font = '10px monospace'; ctx.textAlign = 'center';
  ctx.fillText('屏幕投影结果', cx, pad + 10);

  // Screen border
  ctx.save();
  ctx.strokeStyle = gridColor;
  ctx.globalAlpha = 0.4;
  ctx.lineWidth = 0.8;
  ctx.strokeRect(cx - halfW, cy - halfH, boxW, boxH);
  ctx.restore();

  // Screen background (use computed style since canvas doesn't support CSS vars)
  ctx.save();
  const bgColor = getComputedStyle(document.documentElement).getPropertyValue('--neu-bg').trim() || '#e0e5ec';
  ctx.fillStyle = bgColor;
  ctx.globalAlpha = 0.3;
  ctx.fillRect(cx - halfW, cy - halfH, boxW, boxH);
  ctx.restore();

  // Crosshair
  ctx.save();
  ctx.strokeStyle = gridColor;
  ctx.globalAlpha = 0.15;
  ctx.lineWidth = 0.3;
  ctx.beginPath();
  ctx.moveTo(cx - halfW, cy); ctx.lineTo(cx + halfW, cy);
  ctx.moveTo(cx, cy - halfH); ctx.lineTo(cx, cy + halfH);
  ctx.stroke();
  ctx.restore();

  // Clip to screen bounds
  ctx.save();
  ctx.beginPath();
  ctx.rect(cx - halfW, cy - halfH, boxW, boxH);
  ctx.clip();

  // Perspective projection: x' = x * d/(d+z), y' = y * d/(d+z)
  // Map to screen coords: world [-SCREEN_HALF_W, SCREEN_HALF_W] → pixel [-halfW, halfW]
  const scaleX = halfW / SCREEN_HALF_W;
  const scaleY = halfH / SCREEN_HALF_H;

  const projectToScreen = (v: V3): [number, number] => {
    const denom = SCENE_D + v[2];
    if (Math.abs(denom) < 0.5) {
      // Near singularity — push to edge
      const sx = v[0] >= 0 ? 1 : -1;
      const sy = v[1] >= 0 ? -1 : 1;
      return [cx + sx * halfW * 2, cy + sy * halfH * 2];
    }
    const s = SCENE_D / denom;
    const px = v[0] * s;
    const py = v[1] * s;
    // x maps right, y maps up (invert for canvas)
    return [cx + px * scaleX, cy - py * scaleY];
  };

  // Ghost original triangle
  if (tri.length >= 3) {
    const pts = tri.map(projectToScreen);
    ctx.beginPath();
    ctx.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
    ctx.closePath();
    ctx.fillStyle = 'rgba(99,102,241,0.06)';
    ctx.fill();
    ctx.setLineDash([3, 3]);
    ctx.strokeStyle = 'rgba(99,102,241,0.3)';
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.setLineDash([]);
  }

  // Clipped polygon
  if (clipped.length >= 3) {
    const pts = clipped.map(projectToScreen);
    ctx.beginPath();
    ctx.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
    ctx.closePath();
    ctx.fillStyle = 'rgba(16,185,129,0.2)';
    ctx.fill();
    ctx.strokeStyle = '#10b981';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Vertices
    pts.forEach((p, i) => {
      const v = clipped[i];
      const isNew = Math.abs(v[2] - nearZ) < 0.01 &&
        !tri.some(t => Math.abs(t[0] - v[0]) < 0.01 && Math.abs(t[2] - v[2]) < 0.01);
      ctx.beginPath(); ctx.arc(p[0], p[1], isNew ? 4 : 2.5, 0, Math.PI * 2);
      ctx.fillStyle = isNew ? '#ef4444' : '#10b981'; ctx.fill();
    });
  }

  ctx.restore(); // un-clip

  // Screen range label
  ctx.fillStyle = '#3b82f6'; ctx.font = '9px monospace'; ctx.textAlign = 'center';
  ctx.globalAlpha = 0.6;
  ctx.fillText(`${SCREEN_HALF_W * 2}×${SCREEN_HALF_H * 2}`, cx, cy + halfH + 12);
  ctx.globalAlpha = 1;
}
