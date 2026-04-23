import { useState, useMemo } from 'react';

// Standard tuning, 6th string (low E) → 1st string (high E).
// MIDI pitch numbers so we can do semitone math directly.
const OPEN_STRINGS_MIDI = [40, 45, 50, 55, 59, 64];
const STRING_LABELS = ['6', '5', '4', '3', '2', '1'];
const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

const FRETS_SHOWN = 12;
// Classic inlay dots on frets 3, 5, 7, 9; double dot on 12.
const INLAY_FRETS = new Set([3, 5, 7, 9, 12]);

// Layout constants — aligned with ChordVectorDemo so the two boards read as
// the same visual system. Slightly taller rows to fit the clickable note labels.
const CELL_W = 38;
const CELL_H = 30;
const LEFT_GUTTER = 34;
const TOP_GUTTER = 22;
const BOARD_W = LEFT_GUTTER + CELL_W * (FRETS_SHOWN + 1);
const BOARD_H = TOP_GUTTER + CELL_H * 6 + 6;

const HIGHLIGHT_COLOR = {
  root: '#ef4444',
  third: '#3b82f6',
  fifth: '#10b981',
} as const;

type Highlight = keyof typeof HIGHLIGHT_COLOR | null;

function noteName(midi: number) {
  return NOTE_NAMES[midi % 12];
}

// Fold an absolute semitone distance into the 0..11 chroma space — the root note
// can sit on any string/fret, so we care about the pitch-class interval, not raw distance.
function chromaInterval(rootMidi: number, targetMidi: number) {
  return ((targetMidi - rootMidi) % 12 + 12) % 12;
}

// Pixel center of a (string, fret) cell. High string (index 5) is row 0,
// matching ChordVectorDemo.
function cellCenter(stringIdx: number, fret: number) {
  const row = 5 - stringIdx;
  return {
    x: LEFT_GUTTER + fret * CELL_W + CELL_W / 2,
    y: TOP_GUTTER + row * CELL_H + CELL_H / 2,
  };
}

export default function FretboardDemo() {
  // Default root: A at 6th string, 5th fret. Picking a non-open position up-front
  // communicates that this demo is about arbitrary positions, not just open chords.
  const [rootString, setRootString] = useState(5); // 5 = 6th string (low E)
  const [rootFret, setRootFret] = useState(5);

  const rootMidi = OPEN_STRINGS_MIDI[rootString] + rootFret;
  const rootNote = noteName(rootMidi);

  const cells = useMemo(() => {
    const out: { stringIdx: number; fret: number; note: string; highlight: Highlight }[] = [];
    for (let s = 0; s < 6; s++) {
      for (let f = 0; f <= FRETS_SHOWN; f++) {
        const midi = OPEN_STRINGS_MIDI[s] + f;
        const interval = chromaInterval(rootMidi, midi);
        const highlight: Highlight =
          interval === 0 ? 'root' : interval === 4 ? 'third' : interval === 7 ? 'fifth' : null;
        out.push({ stringIdx: s, fret: f, note: noteName(midi), highlight });
      }
    }
    return out;
  }, [rootMidi]);

  const label: React.CSSProperties = { fontSize: '0.7rem', color: 'var(--text-muted, #888)', fontFamily: 'monospace' };

  return (
    <div style={{ margin: '1.5rem 0', padding: '1rem', borderRadius: '1rem', background: 'var(--neu-bg)', boxShadow: 'inset 4px 4px 8px var(--neu-shadow-dark-strong), inset -4px -4px 8px var(--neu-shadow-light-strong)', overflowX: 'auto' }}>
      <div style={{ marginBottom: '0.75rem', ...label, lineHeight: 1.6, fontSize: '0.75rem' }}>
        点任意品格把它设为根音 R，整块指板会按它重算音程。红=根音，蓝=大三度，绿=纯五度。任意 R 位置，这三个颜色就画出了对应的大三和弦——看那些红蓝绿点怎么分布，就是那个和弦。
      </div>

      <svg
        viewBox={`0 0 ${BOARD_W} ${BOARD_H}`}
        style={{ width: '100%', maxWidth: `${BOARD_W}px`, minWidth: `${BOARD_W * 0.55}px`, display: 'block' }}
        role="group"
        aria-label="Fretboard — click a fret to set root"
      >
        {/* Open-string column backdrop */}
        <rect
          x={LEFT_GUTTER}
          y={TOP_GUTTER}
          width={CELL_W}
          height={CELL_H * 6}
          fill="var(--text-muted, #94a3b8)"
          opacity={0.12}
        />

        {/* Fret numbers */}
        {Array.from({ length: FRETS_SHOWN + 1 }, (_, f) => (
          <text
            key={`f-${f}`}
            x={LEFT_GUTTER + f * CELL_W + CELL_W / 2}
            y={TOP_GUTTER - 6}
            textAnchor="middle"
            fontSize="10"
            fontFamily="monospace"
            fill={f === 0 || INLAY_FRETS.has(f) ? 'var(--text-primary, #333)' : 'var(--text-muted, #888)'}
            fontWeight={f === 0 || INLAY_FRETS.has(f) ? 600 : 400}
          >
            {f === 0 ? '空' : f}
          </text>
        ))}

        {/* Fret divider lines. f=1 is the nut — thicker so the open column is
            visually fenced off. f=0 is the board's left edge. */}
        {Array.from({ length: FRETS_SHOWN + 2 }, (_, f) => {
          const isNut = f === 1;
          const isLeftEdge = f === 0;
          return (
            <line
              key={`fl-${f}`}
              x1={LEFT_GUTTER + f * CELL_W}
              y1={TOP_GUTTER}
              x2={LEFT_GUTTER + f * CELL_W}
              y2={TOP_GUTTER + CELL_H * 6}
              stroke="var(--neu-shadow-dark, #a8b0bb)"
              strokeWidth={isNut ? 3.5 : isLeftEdge ? 3 : 1}
              opacity={isNut ? 0.9 : isLeftEdge ? 0.8 : 0.3}
            />
          );
        })}

        {/* Inlay dots */}
        {Array.from(INLAY_FRETS).map((f) => {
          const x = LEFT_GUTTER + f * CELL_W + CELL_W / 2;
          const midY = TOP_GUTTER + CELL_H * 3;
          if (f === 12) {
            return (
              <g key={`inlay-${f}`}>
                <circle cx={x} cy={midY - CELL_H * 0.6} r={3} fill="var(--neu-shadow-dark, #a8b0bb)" opacity={0.4} />
                <circle cx={x} cy={midY + CELL_H * 0.6} r={3} fill="var(--neu-shadow-dark, #a8b0bb)" opacity={0.4} />
              </g>
            );
          }
          return <circle key={`inlay-${f}`} cx={x} cy={midY} r={4} fill="var(--neu-shadow-dark, #a8b0bb)" opacity={0.35} />;
        })}

        {/* Strings */}
        {Array.from({ length: 6 }, (_, i) => {
          const stringIdx = 5 - i; // i=0 is the high-string row
          const y = TOP_GUTTER + i * CELL_H + CELL_H / 2;
          return (
            <g key={`s-${stringIdx}`}>
              <text x={LEFT_GUTTER - 8} y={y + 3} textAnchor="end" fontSize="10" fontFamily="monospace" fill="var(--text-muted, #888)">
                {STRING_LABELS[stringIdx]}弦
              </text>
              <line
                x1={LEFT_GUTTER}
                y1={y}
                x2={LEFT_GUTTER + (FRETS_SHOWN + 1) * CELL_W}
                y2={y}
                stroke="var(--text-muted, #888)"
                strokeWidth={1 + (5 - i) * 0.15}
                opacity={0.5}
              />
            </g>
          );
        })}

        {/* Clickable note cells — a transparent rect per cell handles the hit
            area, and a small circle + label renders on top when highlighted. */}
        {cells.map(({ stringIdx, fret, note, highlight }) => {
          const { x, y } = cellCenter(stringIdx, fret);
          const isRoot = stringIdx === rootString && fret === rootFret;
          const color = highlight ? HIGHLIGHT_COLOR[highlight] : null;
          return (
            <g
              key={`c-${stringIdx}-${fret}`}
              style={{ cursor: 'pointer' }}
              onClick={() => {
                setRootString(stringIdx);
                setRootFret(fret);
              }}
            >
              {/* Hit target — covers the full cell, transparent but receives clicks */}
              <rect
                x={x - CELL_W / 2}
                y={y - CELL_H / 2}
                width={CELL_W}
                height={CELL_H}
                fill="transparent"
              />
              {color ? (
                <>
                  <circle
                    cx={x}
                    cy={y}
                    r={11}
                    fill={color}
                    stroke={isRoot ? '#000' : '#fff'}
                    strokeWidth={isRoot ? 2 : 1.5}
                  />
                  <text
                    x={x}
                    y={y + 4}
                    textAnchor="middle"
                    fontSize="10"
                    fontFamily="monospace"
                    fontWeight={700}
                    fill="#fff"
                    pointerEvents="none"
                  >
                    {note}
                  </text>
                </>
              ) : (
                <text
                  x={x}
                  y={y + 3}
                  textAnchor="middle"
                  fontSize="9"
                  fontFamily="monospace"
                  fill="var(--text-muted, #888)"
                  opacity={0.7}
                  pointerEvents="none"
                >
                  {note}
                </text>
              )}
            </g>
          );
        })}
      </svg>

      <div style={{ marginTop: '0.75rem', padding: '0.5rem 0.75rem', borderRadius: '0.625rem', background: 'var(--neu-bg)', boxShadow: 'inset 2px 2px 4px var(--neu-shadow-dark), inset -2px -2px 4px var(--neu-shadow-light)', fontFamily: 'monospace', fontSize: '0.8rem', color: 'var(--text-primary, #333)' }}>
        R = <b>{rootNote}</b>（{STRING_LABELS[rootString]}弦 {rootFret === 0 ? '空弦' : `${rootFret}品`}）
        &nbsp;·&nbsp; 大三（3）= {noteName(rootMidi + 4)}
        &nbsp;·&nbsp; 纯五（5）= {noteName(rootMidi + 7)}
        &nbsp;·&nbsp; 构成 <b>{rootNote} 大三和弦</b>
      </div>

      <div style={{ marginTop: '0.5rem', ...label, fontSize: '0.7rem' }}>
        每一格的淡色音名是该品位的实际音；被红/蓝/绿圆点圈住的，就是相对当前 R 的根/三度/五度。当前根音用黑色描边标出。
      </div>
    </div>
  );
}
