import { useState, useMemo } from 'react';

// Standard tuning, 6th string (low E) → 1st string (high E).
// MIDI pitch numbers so we can do semitone math directly.
const OPEN_STRINGS_MIDI = [40, 45, 50, 55, 59, 64];
const STRING_LABELS = ['6', '5', '4', '3', '2', '1'];
const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

const FRETS_SHOWN = 12;
// Classic inlay dots on frets 3, 5, 7, 9; double dot on 12.
const INLAY_FRETS = new Set([3, 5, 7, 9, 12]);

function noteName(midi: number) {
  return NOTE_NAMES[midi % 12];
}

// Fold an absolute semitone distance into the 0..11 chroma space — the root note
// can sit on any string/fret, so we care about the pitch-class interval, not raw distance.
function chromaInterval(rootMidi: number, targetMidi: number) {
  return ((targetMidi - rootMidi) % 12 + 12) % 12;
}

export default function FretboardDemo() {
  // Default root: A at 6th string, 5th fret. Picking a non-open position up-front
  // communicates that this demo is about arbitrary positions, not just open chords.
  const [rootString, setRootString] = useState(5); // index into OPEN_STRINGS_MIDI; 5 = 6th string
  const [rootFret, setRootFret] = useState(5);

  const rootMidi = OPEN_STRINGS_MIDI[rootString] + rootFret;
  const rootNote = noteName(rootMidi);

  const cells = useMemo(() => {
    const rows: { stringIdx: number; frets: { fret: number; midi: number; note: string; interval: number }[] }[] = [];
    for (let s = 0; s < 6; s++) {
      const frets = [];
      for (let f = 0; f <= FRETS_SHOWN; f++) {
        const midi = OPEN_STRINGS_MIDI[s] + f;
        frets.push({ fret: f, midi, note: noteName(midi), interval: chromaInterval(rootMidi, midi) });
      }
      rows.push({ stringIdx: s, frets });
    }
    return rows;
  }, [rootMidi]);

  const label: React.CSSProperties = { fontSize: '0.7rem', color: 'var(--text-muted, #888)', fontFamily: 'monospace' };

  function CellButton({ active, highlight, onClick, children }: { active: boolean; highlight: 'root' | 'third' | 'fifth' | null; onClick: () => void; children: React.ReactNode }) {
    const bg = highlight === 'root' ? '#ef4444' : highlight === 'third' ? '#3b82f6' : highlight === 'fifth' ? '#10b981' : 'var(--neu-bg)';
    const color = highlight ? '#fff' : 'var(--text-primary, #333)';
    const shadow = active
      ? 'inset 2px 2px 4px var(--neu-shadow-dark-strong), inset -2px -2px 4px var(--neu-shadow-light-strong)'
      : '2px 2px 4px var(--neu-shadow-dark), -2px -2px 4px var(--neu-shadow-light)';
    return (
      <button
        type="button"
        onClick={onClick}
        style={{
          width: '1.75rem',
          height: '1.5rem',
          borderRadius: '0.375rem',
          border: 'none',
          background: bg,
          color,
          boxShadow: shadow,
          fontFamily: 'monospace',
          fontSize: '0.65rem',
          fontWeight: 600,
          cursor: 'pointer',
          transition: 'all 150ms ease',
          padding: 0,
          flex: '0 0 auto',
        }}
      >
        {children}
      </button>
    );
  }

  return (
    <div style={{ margin: '1.5rem 0', padding: '1rem', borderRadius: '1rem', background: 'var(--neu-bg)', boxShadow: 'inset 4px 4px 8px var(--neu-shadow-dark-strong), inset -4px -4px 8px var(--neu-shadow-light-strong)', overflowX: 'auto' }}>
      <div style={{ marginBottom: '0.75rem', ...label, lineHeight: 1.6, fontSize: '0.75rem' }}>
        点任意品格把它设为根音 R，整块指板会按它重算音程。红=根音，蓝=大三度，绿=纯五度。任意 R 位置，这三个颜色就画出了对应的大三和弦——看那些红蓝绿点怎么分布，就是那个和弦。
      </div>

      <div style={{ minWidth: 'fit-content' }}>
        {/* Fret numbers header */}
        <div style={{ display: 'flex', gap: '0.15rem', marginLeft: '1.75rem', marginBottom: '0.25rem' }}>
          {Array.from({ length: FRETS_SHOWN + 1 }, (_, f) => (
            <div key={f} style={{ width: '1.75rem', textAlign: 'center', ...label, color: INLAY_FRETS.has(f) ? 'var(--text-primary, #333)' : 'var(--text-muted, #888)', fontWeight: INLAY_FRETS.has(f) ? 600 : 400 }}>
              {f === 0 ? '空' : f}
            </div>
          ))}
        </div>

        {/* Strings top-down: high string (1) at top for guitarist intuition */}
        {cells.slice().reverse().map(({ stringIdx, frets }) => (
          <div key={stringIdx} style={{ display: 'flex', alignItems: 'center', gap: '0.15rem', marginBottom: '0.2rem' }}>
            <div style={{ width: '1.5rem', ...label, textAlign: 'right' }}>{STRING_LABELS[stringIdx]}弦</div>
            {frets.map(({ fret, note, interval }) => {
              const isRoot = stringIdx === rootString && fret === rootFret;
              const highlight =
                interval === 0 ? 'root' : interval === 4 ? 'third' : interval === 7 ? 'fifth' : null;
              return (
                <CellButton
                  key={fret}
                  active={isRoot}
                  highlight={highlight}
                  onClick={() => {
                    setRootString(stringIdx);
                    setRootFret(fret);
                  }}
                >
                  {note}
                </CellButton>
              );
            })}
          </div>
        ))}
      </div>

      <div style={{ marginTop: '0.75rem', padding: '0.5rem 0.75rem', borderRadius: '0.625rem', background: 'var(--neu-bg)', boxShadow: 'inset 2px 2px 4px var(--neu-shadow-dark), inset -2px -2px 4px var(--neu-shadow-light)', fontFamily: 'monospace', fontSize: '0.8rem', color: 'var(--text-primary, #333)' }}>
        R = <b>{rootNote}</b>（{STRING_LABELS[rootString]}弦 {rootFret === 0 ? '空弦' : `${rootFret}品`}）
        &nbsp;·&nbsp; 大三（3）= {noteName(rootMidi + 4)}
        &nbsp;·&nbsp; 纯五（5）= {noteName(rootMidi + 7)}
        &nbsp;·&nbsp; 构成 <b>{rootNote} 大三和弦</b>
      </div>

      <div style={{ marginTop: '0.5rem', ...label, fontSize: '0.7rem' }}>
        每一格显示的是该品位的实际音名；它相对 R 的音程，靠颜色指示。
      </div>
    </div>
  );
}
