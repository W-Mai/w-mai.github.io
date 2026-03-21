import { useState, useCallback, useRef, useEffect, useMemo } from 'react';

// Neumorphism slider (reused pattern)
function NeuSlider({ min, max, step, value, onChange }: { min: number; max: number; step?: number; value: number; onChange: (v: number) => void }) {
  const trackRef = useRef<HTMLDivElement>(null);
  const pct = (value - min) / (max - min) * 100;
  const s = step ?? 1;
  const commit = useCallback((clientX: number) => {
    const rect = trackRef.current?.getBoundingClientRect();
    if (!rect) return;
    const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    onChange(Math.round((min + ratio * (max - min)) / s) * s);
  }, [min, max, s, onChange]);
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

type ModelKey = 'linear' | 'exponential' | 'quadratic';
const MODELS: { key: ModelKey; color: string; label: string }[] = [
  { key: 'linear', color: '#ef4444', label: '线性衰减' },
  { key: 'exponential', color: '#3b82f6', label: '粘滞阻力' },
  { key: 'quadratic', color: '#a855f7', label: '二次阻力' },
];

// Per-frame snapshot for one model
interface Snapshot { vel: number; pos: number; }

// Pre-compute the entire timeline: vel/pos per model per frame
// Animation stops when ALL models drop below threshold
function buildTimeline(v0: number, friction: number) {
  const c = v0 * (1 - friction);
  const b = (1 - friction) / v0;
  const threshold = 0.3;

  const timeline: Record<ModelKey, Snapshot[]> = {
    linear: [{ vel: v0, pos: 0 }],
    exponential: [{ vel: v0, pos: 0 }],
    quadratic: [{ vel: v0, pos: 0 }],
  };

  let vL = v0, vE = v0, vQ = v0;
  let pL = 0, pE = 0, pQ = 0;

  for (let i = 0; i < 500; i++) {
    // Decay velocity
    vL = Math.max(0, vL - c);
    vE *= friction;
    vQ = vQ / (1 + b * vQ);

    // Once below threshold, clamp to 0
    if (vL < threshold) vL = 0;
    if (vE < threshold) vE = 0;
    if (vQ < threshold) vQ = 0;

    pL += vL; pE += vE; pQ += vQ;

    timeline.linear.push({ vel: vL, pos: pL });
    timeline.exponential.push({ vel: vE, pos: pE });
    timeline.quadratic.push({ vel: vQ, pos: pQ });

    // Stop when all are zero
    if (vL === 0 && vE === 0 && vQ === 0) break;
  }

  return timeline;
}

export default function DecayCompareDemo() {
  const [friction, setFriction] = useState(0.85);
  const [v0, setV0] = useState(10);
  const [frame, setFrame] = useState(0);
  const [phase, setPhase] = useState<'idle' | 'running' | 'done'>('idle');

  const rafRef = useRef(0);
  const lastTsRef = useRef(0);
  const accumRef = useRef(0);
  const frameRef = useRef(0);

  // Single source of truth: pre-computed timeline
  const timeline = useMemo(() => buildTimeline(v0, friction), [v0, friction]);
  const totalFrames = timeline.linear.length - 1;

  // Calibrated: v0∈[2,10] × friction∈[0.70,0.90], worst case (10,0.90) → 90% track
  const SCALE = 0.26;
  const FRAME_MS = 16.67;

  useEffect(() => {
    if (phase !== 'running') return;
    const tick = (ts: number) => {
      if (lastTsRef.current === 0) lastTsRef.current = ts;
      accumRef.current += ts - lastTsRef.current;
      lastTsRef.current = ts;
      const steps = Math.floor(accumRef.current / FRAME_MS);
      if (steps > 0) {
        accumRef.current -= steps * FRAME_MS;
        const next = Math.min(frameRef.current + steps, totalFrames);
        frameRef.current = next;
        setFrame(next);
        if (next >= totalFrames) { setPhase('done'); return; }
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [phase, totalFrames]);

  const start = () => {
    frameRef.current = 0;
    lastTsRef.current = 0;
    accumRef.current = 0;
    setFrame(0);
    setPhase('running');
  };
  const stop = () => {
    cancelAnimationFrame(rafRef.current);
    frameRef.current = 0;
    setFrame(0);
    setPhase('idle');
  };

  // Current snapshot from timeline
  const snap = (key: ModelKey) => timeline[key][Math.min(frame, totalFrames)];
  const ballPct = (key: ModelKey) => Math.min(snap(key).pos * SCALE, 92);
  const mono: React.CSSProperties = { fontSize: '0.75rem', fontFamily: 'monospace', color: 'var(--text-muted, #888)' };

  return (
    <div style={{ margin: '1.5rem 0', padding: '1rem', borderRadius: '1rem', background: 'var(--neu-bg)', boxShadow: 'inset 4px 4px 8px var(--neu-shadow-dark-strong), inset -4px -4px 8px var(--neu-shadow-light-strong)' }}>
      {/* Controls */}
      <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', marginBottom: '0.75rem', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flex: 1, minWidth: '9rem' }}>
          <span style={mono}>friction</span>
          <NeuSlider min={0.70} max={0.90} step={0.01} value={friction} onChange={v => { stop(); setFriction(v); }} />
          <span style={{ ...mono, minWidth: '2.5rem', textAlign: 'right' }}>{friction.toFixed(2)}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flex: 1, minWidth: '9rem' }}>
          <span style={mono}>v₀</span>
          <NeuSlider min={2} max={10} step={1} value={v0} onChange={v => { stop(); setV0(v); }} />
          <span style={{ ...mono, minWidth: '1.5rem', textAlign: 'right' }}>{v0}</span>
        </div>
        <button onClick={phase === 'running' ? stop : start} style={{
          padding: '0.35rem 0.9rem', borderRadius: '0.625rem', border: 'none', cursor: 'pointer',
          background: 'var(--neu-bg)', fontFamily: 'monospace', fontSize: '0.75rem',
          color: 'var(--text-primary, #333)',
          boxShadow: phase === 'running'
            ? 'inset 2px 2px 4px var(--neu-shadow-dark), inset -2px -2px 4px var(--neu-shadow-light)'
            : '3px 3px 6px var(--neu-shadow-dark), -3px -3px 6px var(--neu-shadow-light)',
        }}>
          {phase === 'running' ? '⏹ 停止' : phase === 'done' ? '↻ 重来' : '▶ 推一下'}
        </button>
      </div>

      {/* Ball tracks */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
        {MODELS.map(({ key, color, label }) => (
          <div key={key} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span style={{ ...mono, fontSize: '0.65rem', minWidth: '4.5rem', textAlign: 'right', color }}>{label}</span>
            <div style={{
              flex: 1, height: '1.5rem', borderRadius: '0.75rem', position: 'relative', overflow: 'hidden',
              background: 'var(--neu-bg)',
              boxShadow: 'inset 2px 2px 4px var(--neu-shadow-dark), inset -2px -2px 4px var(--neu-shadow-light)',
            }}>
              <div style={{
                position: 'absolute', left: 0, top: 0, bottom: 0,
                width: `${ballPct(key) + 2}%`,
                background: `linear-gradient(90deg, transparent 0%, ${color}15 60%, ${color}30 100%)`,
                borderRadius: '0.75rem',
              }} />
              <div style={{
                position: 'absolute',
                left: `calc(${ballPct(key)}% + 0.5rem)`,
                top: '50%', transform: 'translate(-50%, -50%)',
                width: '1rem', height: '1rem', borderRadius: '50%',
                background: color, opacity: 0.9,
                boxShadow: `0 0 6px ${color}66`,
              }} />
            </div>
            <span style={{ ...mono, fontSize: '0.6rem', minWidth: '2.5rem', textAlign: 'right', color, opacity: phase !== 'idle' ? 1 : 0.4 }}>
              {snap(key).vel.toFixed(1)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
