import { useEffect, useRef, type FC } from 'react';
import AttachmentPanel from './Attachment';
import { EDITOR_TOKENS as T } from '~/components/editor/shared/editor-tokens';

interface Props {
  slug: string;
  title: string;
  isOpen: boolean;
  canInsert: boolean;
  refreshKey: number;
  onClose: () => void;
  onInsert: (markdown: string) => void;
  onChanged: () => void;
}

/** A native modal keeps keyboard focus inside the current post's attachments. */
const PostAttachments: FC<Props> = ({ slug, title, isOpen, canInsert, refreshKey, onClose, onInsert, onChanged }) => {
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (isOpen && !dialog.open) dialog.showModal();
    if (!isOpen && dialog.open) dialog.close();
  }, [isOpen]);

  return (
    <dialog
      ref={dialogRef}
      className="post-attachments-dialog"
      aria-label="当前文章附件管理"
      onCancel={(event) => { event.preventDefault(); onClose(); }}
      onClick={(event) => {
        if (event.target !== event.currentTarget) return;
        const bounds = event.currentTarget.getBoundingClientRect();
        if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) onClose();
      }}
      style={{
        width: 'min(840px, 92vw)', maxWidth: '92vw', height: 'min(760px, 82dvh)',
        maxHeight: '90dvh', margin: 'auto', padding: 0, border: 'none', borderRadius: T.radiusXl,
        background: T.colorBg, color: T.colorText, boxShadow: T.shadowRaised,
        overflow: 'hidden',
      }}
    >
      <style>{`
        .post-attachments-dialog::backdrop { background: var(--editor-overlay-bg); }
        .post-attachments-dialog button:focus-visible {
          outline: none;
          box-shadow: ${T.shadowInset};
        }
      `}</style>
      {isOpen && (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>
          <header style={{ display: 'flex', alignItems: 'center', gap: T.spacingLg, padding: T.spacing3xl }}>
            <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: T.fontSizeLg, fontWeight: 600 }} title={title}>{title}</span>
            <button
              type="button"
              className="editor-btn"
              onClick={onClose}
              aria-label="关闭文章附件"
              style={{
                flexShrink: 0, background: T.colorBg, color: T.colorTextSecondary,
                border: 'none', borderRadius: T.radiusMd, boxShadow: T.shadowBtn,
                padding: T.spacingMd, minWidth: '2.25rem', minHeight: '2.25rem',
                cursor: 'pointer', fontSize: T.fontSizeLg, transition: `all ${T.transitionFast}`,
              }}
            >✕</button>
          </header>
          <div style={{ flex: 1, minHeight: 0, overflow: 'hidden' }}>
            <AttachmentPanel
              key={slug}
              scope={{ kind: 'post', slug }}
              canInsert={canInsert}
              refreshKey={refreshKey}
              onInsert={onInsert}
              onChanged={onChanged}
            />
          </div>
        </div>
      )}
    </dialog>
  );
};

export default PostAttachments;
