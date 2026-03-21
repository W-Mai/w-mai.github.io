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

export default function ScaleFactorDemo() {
  const [z, setZ] = useState(100);
  const d = 200;
  const scale = d / (d + z);
  const danger = z < -d;
  const nearDanger = z < -d * 0.95 && z >= -d;
  const absScale = Math.abs(scale);
  const barW = isFinite(absScale)
    ? Math.min(50, (absScale <= 1 ? absScale * 25 : 25 + Math.log2(absScale) * 8))
    : 50;
  const barColor = danger ? '#ef4444' : nearDanger ? '#f59e0b' : '#3b82f6';
  const label: React.CSSProperties = { fontSize: '0.75rem', color: 'var(--text-muted, #888)', fontFamily: 'monospace' };

  return (
    <div style={{ margin: '1.5rem 0', padding: '1rem', borderRadius: '1rem', background: 'var(--neu-bg)', boxShadow: 'inset 4px 4px 8px var(--neu-shadow-dark-strong), inset -4px -4px 8px var(--neu-shadow-light-strong)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.75rem' }}>
        <span style={label}>z =</span>
        <NeuSlider min={-500} max={400} value={z} onChange={setZ} />
        <span style={{ ...label, minWidth: '3.5rem', textAlign: 'right' }}>{z}</span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
        <span style={label}>scale = d/(d+z) =</span>
        <span style={{ fontFamily: 'monospace', fontWeight: 600, color: barColor, fontSize: '0.9rem' }}>
          {isFinite(scale) ? scale.toFixed(3) : (z === -d ? '∞' : scale > 0 ? '+∞' : '-∞')}
        </span>
      </div>
      <div style={{ marginTop: '0.5rem', height: '1.5rem', background: 'var(--neu-bg)', borderRadius: '0.5rem', position: 'relative', overflow: 'hidden', boxShadow: 'inset 2px 2px 4px var(--neu-shadow-dark), inset -2px -2px 4px var(--neu-shadow-light)' }}>
        <div style={{
          position: 'absolute', top: 0, height: '100%', borderRadius: '0.25rem',
          background: barColor, opacity: 0.7,
          width: `${barW}%`,
          left: scale >= 0 ? '50%' : `${50 - barW}%`,
        }} />
        <div style={{ position: 'absolute', left: '50%', top: 0, bottom: 0, width: '1px', background: 'var(--text-muted, #888)' }} />
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '0.25rem' }}>
        <span style={{ ...label, fontSize: '0.65rem' }}>翻转（z &lt; -d）</span>
        <span style={{ ...label, fontSize: '0.65rem' }}>0</span>
        <span style={{ ...label, fontSize: '0.65rem' }}>正常缩小</span>
      </div>
      {danger && <div style={{ marginTop: '0.5rem', padding: '0.375rem 0.5rem', borderRadius: '0.5rem', background: 'var(--neu-bg)', color: '#dc2626', fontSize: '0.75rem', boxShadow: 'inset 2px 2px 4px var(--neu-shadow-dark), inset -2px -2px 4px var(--neu-shadow-light)' }}>⚠️ z &lt; -d：缩放因子为负，投影翻转</div>}
      {nearDanger && <div style={{ marginTop: '0.5rem', padding: '0.375rem 0.5rem', borderRadius: '0.5rem', background: 'var(--neu-bg)', color: '#d97706', fontSize: '0.75rem', boxShadow: 'inset 2px 2px 4px var(--neu-shadow-dark), inset -2px -2px 4px var(--neu-shadow-light)' }}>⚠️ 接近奇点，投影坐标趋向无穷大</div>}
    </div>
  );
}
