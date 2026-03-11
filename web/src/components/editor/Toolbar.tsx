import type { FC } from 'react';
import type { EditorView } from '@codemirror/view';
import { FORMAT_ACTIONS, type FormatAction } from '../../lib/editor-formatting';
import { EDITOR_TOKENS as T } from './editor-tokens';

interface ToolbarProps {
  editorView: EditorView | null;
  activeFormats: Set<string>;
  onStickerOpen?: () => void;
}

interface ToolbarItem {
  action: FormatAction;
  icon: string;
  label: string;
  shortcut?: string;
}

const TOOLBAR_GROUPS: ToolbarItem[][] = [
  [
    { action: 'bold', icon: 'B', label: 'Bold', shortcut: '⌘B' },
    { action: 'italic', icon: 'I', label: 'Italic', shortcut: '⌘I' },
    { action: 'strikethrough', icon: 'S', label: 'Strikethrough' },
    { action: 'code-inline', icon: '<>', label: 'Inline Code' },
  ],
  [
    { action: 'h1', icon: 'H1', label: 'Heading 1' },
    { action: 'h2', icon: 'H2', label: 'Heading 2' },
    { action: 'h3', icon: 'H3', label: 'Heading 3' },
  ],
  [
    { action: 'ul', icon: '•', label: 'Unordered List' },
    { action: 'ol', icon: '1.', label: 'Ordered List' },
    { action: 'blockquote', icon: '❝', label: 'Blockquote' },
  ],
  [
    { action: 'link', icon: '🔗', label: 'Link', shortcut: '⌘K' },
    { action: 'image', icon: '🖼', label: 'Image', shortcut: '⌘⇧I' },
    { action: 'code-block', icon: '{ }', label: 'Code Block', shortcut: '⌘⇧K' },
    { action: 'hr', icon: '—', label: 'Horizontal Rule' },
  ],
];

const Toolbar: FC<ToolbarProps> = ({ editorView, activeFormats, onStickerOpen }) => {
  const handleClick = (action: FormatAction) => {
    if (!editorView) return;
    FORMAT_ACTIONS[action](editorView);
    editorView.focus();
  };

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: T.spacingXs,
      padding: `${T.spacingSm} ${T.spacingLg}`,
      background: T.colorBg,
      flexWrap: 'wrap',
    }}>
      {TOOLBAR_GROUPS.map((group, gi) => (
        <div key={gi} style={{ display: 'flex', alignItems: 'center', gap: '2px' }}>
          {gi > 0 && (
            <div style={{
              width: '1px', height: '18px',
              background: T.colorBorder, margin: `0 ${T.spacingXs}`,
            }} />
          )}
          {group.map((item) => {
            const isActive = activeFormats.has(item.action);
            return (
              <button
                key={item.action}
                onClick={() => handleClick(item.action)}
                disabled={!editorView}
                className={!isActive ? 'editor-btn' : ''}
                title={item.shortcut ? `${item.label} (${item.shortcut})` : item.label}
                style={{
                  background: T.colorBg,
                  border: 'none',
                  borderRadius: T.radiusSm,
                  cursor: editorView ? 'pointer' : 'default',
                  padding: `4px ${T.spacingMd}`,
                  fontSize: T.fontSizeSm,
                  fontWeight: isActive ? 700 : 500,
                  color: isActive ? T.colorText : T.colorTextSecondary,
                  fontFamily: item.action === 'bold' || item.action === 'italic' || item.action === 'strikethrough'
                    ? 'serif' : T.fontSans,
                  fontStyle: item.action === 'italic' ? 'italic' : 'normal',
                  textDecoration: item.action === 'strikethrough' ? 'line-through' : 'none',
                  transition: `all ${T.transitionFast}`,
                  lineHeight: 1.4,
                  minWidth: '28px',
                  textAlign: 'center',
                  opacity: editorView ? 1 : 0.4,
                  boxShadow: isActive ? T.shadowInset : T.shadowBtn,
                }}
              >
                {item.icon}
              </button>
            );
          })}
        </div>
      ))}
      {/* Sticker picker button */}
      <div style={{ display: 'flex', alignItems: 'center' }}>
        <div style={{ width: '1px', height: '18px', background: T.colorBorder, margin: `0 ${T.spacingXs}` }} />
        <button
          onClick={onStickerOpen}
          className="editor-btn"
          title="Insert Sticker"
          style={{
            background: T.colorBg, border: 'none', borderRadius: T.radiusSm,
            cursor: 'pointer', padding: `4px ${T.spacingMd}`,
            fontSize: T.fontSizeSm, color: T.colorTextSecondary,
            transition: `all ${T.transitionFast}`, lineHeight: 1.4,
            minWidth: '28px', textAlign: 'center',
            boxShadow: T.shadowBtn,
          }}
        >😀</button>
      </div>
    </div>
  );
};

export default Toolbar;
