import { useEffect, useRef, type FC } from 'react';
import { EDITOR_TOKENS as T } from '~/components/editor/shared/editor-tokens';

interface ContextMenuProps {
  position: { x: number; y: number } | null;
  hasSelection: boolean;
  aiEnabled: boolean;
  onAction: (action: string) => void;
  onClose: () => void;
}

interface MenuItem {
  label: string;
  action: string;
  shortcut?: string;
  disabled?: boolean;
  disabledTip?: string;
}

const DIVIDER = '---';

function getMenuItems(hasSelection: boolean, aiEnabled: boolean): (MenuItem | typeof DIVIDER)[] {
  if (hasSelection) {
    return [
      { label: 'Cut', action: 'cut', shortcut: '⌘X' },
      { label: 'Copy', action: 'copy', shortcut: '⌘C' },
      { label: 'Paste', action: 'paste', shortcut: '⌘V' },
      DIVIDER,
      { label: 'AI Polish', action: 'ai-polish', disabled: !aiEnabled, disabledTip: 'AI not configured' },
      { label: 'AI Simplify', action: 'ai-simplify', disabled: !aiEnabled, disabledTip: 'AI not configured' },
      { label: 'AI Expand', action: 'ai-expand', disabled: !aiEnabled, disabledTip: 'AI not configured' },
      { label: 'AI Translate', action: 'ai-translate', disabled: !aiEnabled, disabledTip: 'AI not configured' },
    ];
  }
  return [
    { label: 'Insert Image', action: 'insert-image', shortcut: '⌘⇧I' },
    { label: 'Insert Link', action: 'insert-link', shortcut: '⌘K' },
    { label: 'Insert Code Block', action: 'insert-code-block', shortcut: '⌘⇧K' },
    { label: 'Insert Table', action: 'insert-table' },
    { label: 'Insert Frontmatter', action: 'insert-frontmatter' },
    DIVIDER,
    { label: '😀 Insert Sticker', action: 'insert-sticker' },
  ];
}

const ContextMenu: FC<ContextMenuProps> = ({ position, hasSelection, aiEnabled, onAction, onClose }) => {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!position) return;
    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) onClose();
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('mousedown', handleClick);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handleClick);
      document.removeEventListener('keydown', handleKey);
    };
  }, [position, onClose]);

  if (!position) return null;

  const items = getMenuItems(hasSelection, aiEnabled);

  return (
    <div
      ref={menuRef}
      style={{
        position: 'fixed', left: position.x, top: position.y,
        background: T.colorBg, border: `1px solid ${T.colorBorder}`,
        borderRadius: T.radiusMd, boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
        padding: `${T.spacingXs} 0`, minWidth: '180px', zIndex: 1000,
        fontFamily: T.fontSans, fontSize: T.fontSizeSm,
      }}
    >
      {items.map((item, i) => {
        if (item === DIVIDER) {
          return <div key={`d-${i}`} style={{ height: '1px', background: T.colorBorderLight, margin: `${T.spacingXs} 0` }} />;
        }
        return (
          <button
            key={item.action}
            onClick={() => { if (!item.disabled) { onAction(item.action); onClose(); } }}
            disabled={item.disabled}
            title={item.disabled ? item.disabledTip : undefined}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              width: '100%', padding: `${T.spacingSm} ${T.spacingLg}`,
              background: 'none', border: 'none', cursor: item.disabled ? 'default' : 'pointer',
              color: item.disabled ? T.colorTextMuted : T.colorText,
              fontSize: T.fontSizeSm, textAlign: 'left',
              transition: `background ${T.transitionFast}`,
            }}
            onMouseEnter={(e) => { if (!item.disabled) e.currentTarget.style.background = T.colorBgTertiary; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'none'; }}
          >
            <span>{item.label}</span>
            {item.shortcut && <span style={{ color: T.colorTextMuted, fontSize: T.fontSizeXs, marginLeft: T.spacingLg }}>{item.shortcut}</span>}
          </button>
        );
      })}
    </div>
  );
};

export default ContextMenu;
