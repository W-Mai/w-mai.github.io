import { useId } from 'react';

// A 6-string, 0-12 fret diagram with labeled notes and optional vector arrows
// between them. Used to visualize how R/3/5 fit into the fretboard for a given
// chord, and how the chord "unfolds" as a chain of inter-string vectors.

const STRING_LABELS = ['6', '5', '4', '3', '2', '1']; // low → high
const INLAY_FRETS = new Set([3, 5, 7, 9, 12]);
const FRETS = 12;

type NoteKind = 'R' | '3' | '5' | '3m' | '7' | 'aux';

type Note = {
  string: number; // 0 = 6th, 5 = 1st
  fret: number;
  label?: string; // e.g. 'R', '3', '5', '♭3'
  kind?: NoteKind;
};

type Step = {
  from: { string: number; fret: number };
  to: { string: number; fret: number };
  hint?: string; // short annotation like "−1" or "+3"
};

type Props = {
  title?: string;
  notes: Note[];
  steps?: Step[];
  // Optional caption beneath the board
  caption?: string;
};

const KIND_COLOR: Record<NoteKind, string> = {
  R: '#ef4444',
  '3': '#3b82f6',
  '3m': '#6366f1',
  '5': '#10b981',
  '7': '#f59e0b',
  aux: '#94a3b8',
};

// Layout constants — tune for compactness and legibility.
const CELL_W = 38; // pixels per fret
const CELL_H = 28; // pixels per string row
const LEFT_GUTTER = 32; // space for string labels
const TOP_GUTTER = 22; // space for fret numbers
const BOARD_W = LEFT_GUTTER + CELL_W * (FRETS + 1);
const BOARD_H = TOP_GUTTER + CELL_H * 6 + 6;

// Returns the pixel center of a (string, fret) cell.
// Strings are rendered high-to-low top-to-bottom for guitarist intuition,
// so string index 5 (high E) is row 0 and string index 0 (low E) is row 5.
function cellCenter(stringIdx: number, fret: number) {
  const row = 5 - stringIdx;
  return {
    x: LEFT_GUTTER + fret * CELL_W + CELL_W / 2,
    y: TOP_GUTTER + row * CELL_H + CELL_H / 2,
  };
}

export default function ChordVectorDemo({ title, notes, steps, caption }: Props) {
  const uid = useId();
  const markerId = `arrow-${uid}`;

  return (
    <div style={{ margin: '1.5rem 0', padding: '1rem', borderRadius: '1rem', background: 'var(--neu-bg)', boxShadow: 'inset 4px 4px 8px var(--neu-shadow-dark-strong), inset -4px -4px 8px var(--neu-shadow-light-strong)', overflowX: 'auto' }}>
      {title && (
        <div style={{ marginBottom: '0.75rem', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary, #333)', fontFamily: 'monospace' }}>
          {title}
        </div>
      )}

      <svg
        viewBox={`0 0 ${BOARD_W} ${BOARD_H}`}
        style={{ width: '100%', maxWidth: `${BOARD_W}px`, minWidth: `${BOARD_W * 0.55}px`, display: 'block' }}
        aria-hidden
      >
        <defs>
          <marker id={markerId} viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
            <path d="M 0 0 L 10 5 L 0 10 z" fill="currentColor" />
          </marker>
        </defs>

        {/* Fret numbers */}
        {Array.from({ length: FRETS + 1 }, (_, f) => (
          <text
            key={`f-${f}`}
            x={LEFT_GUTTER + f * CELL_W + CELL_W / 2}
            y={TOP_GUTTER - 6}
            textAnchor="middle"
            fontSize="10"
            fontFamily="monospace"
            fill={INLAY_FRETS.has(f) ? 'var(--text-primary, #333)' : 'var(--text-muted, #888)'}
            fontWeight={INLAY_FRETS.has(f) ? 600 : 400}
          >
            {f === 0 ? '空' : f}
          </text>
        ))}

        {/* Fret divider lines (lighter on non-inlay frets) */}
        {Array.from({ length: FRETS + 2 }, (_, f) => (
          <line
            key={`fl-${f}`}
            x1={LEFT_GUTTER + f * CELL_W}
            y1={TOP_GUTTER}
            x2={LEFT_GUTTER + f * CELL_W}
            y2={TOP_GUTTER + CELL_H * 6}
            stroke="var(--neu-shadow-dark, #a8b0bb)"
            strokeWidth={f === 0 ? 3 : 1}
            opacity={f === 0 ? 0.8 : 0.3}
          />
        ))}

        {/* Inlay dots (single on 3/5/7/9, double on 12) */}
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
          const stringIdx = 5 - i; // i=0 is high string row
          const y = TOP_GUTTER + i * CELL_H + CELL_H / 2;
          return (
            <g key={`s-${stringIdx}`}>
              <text x={LEFT_GUTTER - 8} y={y + 3} textAnchor="end" fontSize="10" fontFamily="monospace" fill="var(--text-muted, #888)">
                {STRING_LABELS[stringIdx]}弦
              </text>
              <line
                x1={LEFT_GUTTER}
                y1={y}
                x2={LEFT_GUTTER + (FRETS + 1) * CELL_W}
                y2={y}
                stroke="var(--text-muted, #888)"
                strokeWidth={1 + (5 - i) * 0.15}
                opacity={0.5}
              />
            </g>
          );
        })}

        {/* Arrows between notes (drawn before note dots so dots sit on top) */}
        {steps?.map((step, i) => {
          const a = cellCenter(step.from.string, step.from.fret);
          const b = cellCenter(step.to.string, step.to.fret);
          // Shorten endpoints so arrow doesn't collide with dots
          const dx = b.x - a.x;
          const dy = b.y - a.y;
          const len = Math.sqrt(dx * dx + dy * dy) || 1;
          const pad = 13;
          const x1 = a.x + (dx / len) * pad;
          const y1 = a.y + (dy / len) * pad;
          const x2 = b.x - (dx / len) * pad;
          const y2 = b.y - (dy / len) * pad;
          return (
            <g key={`step-${i}`} style={{ color: '#f97316' }}>
              <line x1={x1} y1={y1} x2={x2} y2={y2} stroke="currentColor" strokeWidth={1.5} markerEnd={`url(#${markerId})`} opacity={0.85} />
              {step.hint && (
                <text
                  x={(a.x + b.x) / 2}
                  y={(a.y + b.y) / 2 - 4}
                  textAnchor="middle"
                  fontSize="10"
                  fontFamily="monospace"
                  fontWeight={600}
                  fill="#f97316"
                >
                  {step.hint}
                </text>
              )}
            </g>
          );
        })}

        {/* Notes */}
        {notes.map((note, i) => {
          const { x, y } = cellCenter(note.string, note.fret);
          const color = note.kind ? KIND_COLOR[note.kind] : KIND_COLOR.aux;
          return (
            <g key={`n-${i}`}>
              <circle cx={x} cy={y} r={11} fill={color} stroke="#fff" strokeWidth={1.5} />
              {note.label && (
                <text x={x} y={y + 4} textAnchor="middle" fontSize="10" fontFamily="monospace" fontWeight={700} fill="#fff">
                  {note.label}
                </text>
              )}
            </g>
          );
        })}
      </svg>

      {caption && (
        <div style={{ marginTop: '0.5rem', fontSize: '0.75rem', color: 'var(--text-muted, #888)', fontFamily: 'monospace', lineHeight: 1.6 }}>
          {caption}
        </div>
      )}
    </div>
  );
}
