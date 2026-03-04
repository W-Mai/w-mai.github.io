import { useEffect, type FC } from 'react';
import { createPortal } from 'react-dom';
import { SHORTCUTS } from '../../lib/editor-shortcuts';
import { EDITOR_TOKENS as T } from './editor-tokens';

interface ShortcutPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

/** Format CodeMirror key notation to display label */
function formatKey(key: string): string {
  return key
    .replace('Mod', '⌘')
    .replace('Shift', '⇧')
    .replace('Tab', '⇥')
    .replace(/-/g, '');
}

const categories = ['formatting', 'editing', 'navigation', 'ai'] as const;
const categoryLabels: Record<string, string> = {
  formatting: 'Formatting',
  editing: 'Editing',
  navigation: 'Navigation',
  ai: 'AI',
};

const ShortcutPanel: FC<ShortcutPanelProps> = ({ isOpen, onClose }) => {
  useEffect(() => {
    if (!isOpen) return;
    const handleKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return createPortal(
    <div
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      style={{
        position: 'fixed', inset: 0, zIndex: 2000,
        background: 'rgba(0,0,0,0.3)', display: 'flex',
        alignItems: 'center', justifyContent: 'center',
      }}
    >
      <div style={{
        background: T.colorBg, borderRadius: T.radiusLg,
        boxShadow: '0 8px 24px rgba(0,0,0,0.15)',
        padding: T.spacingXl, width: '340px', maxHeight: '80vh', overflow: 'auto',
        fontFamily: T.fontSans,
      }}>
        <div style={{ fontSize: T.fontSizeBase, fontWeight: 600, color: T.colorText, marginBottom: T.spacingLg }}>
          Keyboard Shortcuts
        </div>
        {categories.map((cat) => {
          const items = SHORTCUTS.filter((s) => s.category === cat);
          if (items.length === 0) return null;
          return (
            <div key={cat} style={{ marginBottom: T.spacingLg }}>
              <div style={{ fontSize: T.fontSizeXs, fontWeight: 600, color: T.colorTextMuted, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: T.spacingXs }}>
                {categoryLabels[cat]}
              </div>
              {items.map((s) => (
                <div key={s.action} style={{ display: 'flex', justifyContent: 'space-between', padding: `${T.spacingXs} 0`, fontSize: T.fontSizeSm }}>
                  <span style={{ color: T.colorText }}>{s.label}</span>
                  <kbd style={{
                    background: T.colorBgTertiary, border: `1px solid ${T.colorBorder}`,
                    borderRadius: T.radiusSm, padding: `0 ${T.spacingSm}`,
                    fontSize: T.fontSizeXs, fontFamily: T.fontSans, color: T.colorTextSecondary,
                  }}>
                    {formatKey(s.key)}
                  </kbd>
                </div>
              ))}
            </div>
          );
        })}
      </div>
    </div>,
    document.body,
  );
};

export default ShortcutPanel;
