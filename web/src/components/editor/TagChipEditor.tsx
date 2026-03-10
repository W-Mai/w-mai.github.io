import { type FC, useState, useRef, useCallback } from 'react';
import { EDITOR_TOKENS as T } from './editor-tokens';

interface TagChipEditorProps {
  tags: string[];
  onAdd: (tag: string) => void;
  onRemove: (index: number) => void;
}

const TagChipEditor: FC<TagChipEditorProps> = ({ tags, onAdd, onRemove }) => {
  const [input, setInput] = useState('');
  const [warning, setWarning] = useState('');
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showWarning = useCallback((msg: string) => {
    setWarning(msg);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setWarning(''), 3000);
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== 'Enter') return;
    e.preventDefault();
    const tag = input.trim();
    if (!tag) return;

    if (tags.includes(tag)) {
      showWarning(`Tag "${tag}" already exists`);
      return;
    }

    onAdd(tag);
    setInput('');
  };

  return (
    <div>
      {/* Tag chips */}
      <div style={{
        display: 'flex', flexWrap: 'wrap', gap: T.spacingXs,
        marginBottom: tags.length > 0 ? T.spacingSm : 0,
      }}>
        {tags.map((tag, i) => (
          <span key={`${tag}-${i}`} style={{
            display: 'inline-flex', alignItems: 'center', gap: '2px',
            padding: `1px ${T.spacingSm}`,
            background: T.colorBgTertiary,
            borderRadius: T.radiusSm,
            fontSize: T.fontSizeSm,
            fontFamily: T.fontSans,
            color: T.colorText,
            boxShadow: T.shadowBtn,
            transition: `all ${T.transitionFast}`,
          }}>
            {tag}
            <button
              onClick={() => onRemove(i)}
              aria-label={`Remove tag ${tag}`}
              style={{
                background: 'none', border: 'none', cursor: 'pointer',
                padding: '0 2px', lineHeight: 1,
                fontSize: T.fontSizeSm, color: T.colorTextMuted,
                transition: `color ${T.transitionFast}`,
              }}
            >×</button>
          </span>
        ))}
      </div>

      {/* Input for new tags */}
      <input
        type="text"
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Add tag, press Enter"
        style={{
          width: '100%', boxSizing: 'border-box',
          padding: `${T.spacingXs} ${T.spacingSm}`,
          background: T.colorBg,
          border: `1px solid ${T.colorBorderLight}`,
          borderRadius: T.radiusSm,
          fontSize: T.fontSizeSm,
          fontFamily: T.fontSans,
          color: T.colorText,
          boxShadow: T.shadowInset,
          outline: 'none',
          transition: `border-color ${T.transitionFast}`,
        }}
      />

      {/* Duplicate warning */}
      {warning && (
        <div style={{
          marginTop: T.spacingXs,
          padding: `${T.spacingXs} ${T.spacingSm}`,
          background: T.colorWarningBg,
          color: T.colorWarning,
          fontSize: T.fontSizeSm,
          fontFamily: T.fontSans,
          borderRadius: T.radiusSm,
          transition: `opacity ${T.transitionFast}`,
        }}>
          {warning}
        </div>
      )}
    </div>
  );
};

export default TagChipEditor;
