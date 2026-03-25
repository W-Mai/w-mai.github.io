import { useState, useEffect, useCallback, useRef, type FC } from 'react';
import { createPortal } from 'react-dom';
import { EDITOR_TOKENS as T } from '~/components/editor/shared/editor-tokens';

interface PendingPost {
  slug: string;
  title: string;
  files: string[];
  action: 'add' | 'update' | 'delete';
}

interface GitCommitModalProps {
  isOpen: boolean;
  pending: PendingPost[];
  aiEnabled: boolean;
  onCommit: (messages: Record<string, string>) => void;
  onCancel: () => void;
}

/** Default commit message template */
function defaultMsg(title: string, action: 'add' | 'update' | 'delete'): string {
  return `📝(post): ${action} "${title}"`;
}

const GitCommitModal: FC<GitCommitModalProps> = ({
  isOpen, pending, aiEnabled, onCommit, onCancel,
}) => {
  const [messages, setMessages] = useState<Record<string, string>>({});
  const [aiLoading, setAiLoading] = useState<Record<string, boolean>>({});

  // Reset messages only when modal first opens
  const prevOpen = useRef(false);
  useEffect(() => {
    if (isOpen && !prevOpen.current) {
      const defaults: Record<string, string> = {};
      for (const p of pending) defaults[p.slug] = defaultMsg(p.title, p.action);
      setMessages(defaults);
      setAiLoading({});
    }
    prevOpen.current = isOpen;
  }, [isOpen, pending]);

  const updateMessage = useCallback((slug: string, msg: string) => {
    setMessages((prev) => ({ ...prev, [slug]: msg }));
  }, []);

  // AI-generate commit message from diff content
  const handleAISuggest = useCallback(async (slug: string, title: string, action: string) => {
    setAiLoading((prev) => ({ ...prev, [slug]: true }));
    try {
      // Fetch diff for this post
      const diffRes = await fetch(`/api/editor/git?diff=${encodeURIComponent(slug)}`);
      if (!diffRes.ok) throw new Error('Failed to get diff');
      const { diff } = await diffRes.json();

      // Truncate diff to 3000 chars to stay within token limits
      const diffTruncated = diff?.slice(0, 3000) || '(no diff available)';

      const res = await fetch('/api/editor/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'suggest-commit-msg',
          content: `Title: ${title}\nAction: ${action}\n\nDiff:\n${diffTruncated}`,
        }),
      });
      if (!res.ok) throw new Error('AI request failed');

      const reader = res.body?.getReader();
      if (!reader) throw new Error('No response body');

      const decoder = new TextDecoder();
      let buffer = '';
      let fullText = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const parsed = JSON.parse(line.slice(6));
              if (parsed.chunk) fullText += parsed.chunk;
              if (parsed.result) fullText = parsed.result;
            } catch {}
          }
        }
      }

      if (fullText.trim()) {
        updateMessage(slug, fullText.trim().replace(/^["']|["']$/g, ''));
      }
    } catch {
      // Silently fail, keep existing message
    } finally {
      setAiLoading((prev) => ({ ...prev, [slug]: false }));
    }
  }, [updateMessage]);

  const handleSubmit = useCallback(() => {
    onCommit(messages);
  }, [messages, onCommit]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Escape') onCancel();
  }, [onCancel]);

  if (!isOpen || pending.length === 0) return null;

  return createPortal(
    <div
      onClick={(e) => { if (e.target === e.currentTarget) onCancel(); }}
      onKeyDown={handleKeyDown}
      style={{
        position: 'fixed', inset: 0, zIndex: 2000,
        background: 'rgba(0,0,0,0.3)', display: 'flex',
        alignItems: 'center', justifyContent: 'center',
      }}
    >
      <div style={{
        background: T.colorBg, borderRadius: T.radiusLg,
        boxShadow: '0 8px 24px rgba(0,0,0,0.15)',
        padding: T.spacingXl, width: '520px', maxHeight: '80vh',
        fontFamily: T.fontSans, display: 'flex', flexDirection: 'column',
      }}>
        <div style={{ fontSize: T.fontSizeBase, fontWeight: 600, color: T.colorText, marginBottom: T.spacingLg }}>
          📦 Commit {pending.length} post{pending.length > 1 ? 's' : ''}
        </div>

        <div style={{ flex: 1, overflow: 'auto', display: 'flex', flexDirection: 'column', gap: T.spacingLg }}>
          {pending.map((post) => (
            <div key={post.slug} style={{
              border: `1px solid ${T.colorBorder}`, borderRadius: T.radiusMd,
              padding: T.spacingMd,
            }}>
              {/* Post header */}
              <div style={{
                display: 'flex', alignItems: 'center', gap: T.spacingSm,
                marginBottom: T.spacingSm,
              }}>
                <span style={{ fontSize: T.fontSizeSm, fontWeight: 600, color: T.colorText, flex: 1 }}>
                  {post.title}
                </span>
                <span style={{ fontSize: T.fontSizeXs, color: T.colorTextMuted, fontFamily: T.fontMono }}>
                  {post.files.length} file{post.files.length > 1 ? 's' : ''}
                </span>
                {aiEnabled && (
                  <button
                    onClick={() => handleAISuggest(post.slug, post.title, post.action)}
                    disabled={!!aiLoading[post.slug]}
                    title="AI-generate commit message"
                    style={{
                      background: 'none', border: `1px solid ${T.colorBorder}`,
                      borderRadius: T.radiusSm, padding: '0 0.4rem',
                      fontSize: T.fontSizeXs,
                      color: aiLoading[post.slug] ? T.colorTextMuted : T.colorAccent,
                      cursor: aiLoading[post.slug] ? 'wait' : 'pointer',
                      lineHeight: '1.6', transition: `all ${T.transitionFast}`,
                    }}
                  >
                    {aiLoading[post.slug] ? '⏳' : '✨ AI'}
                  </button>
                )}
              </div>

              {/* Commit message textarea */}
              <textarea
                value={messages[post.slug] || ''}
                onChange={(e) => updateMessage(post.slug, e.target.value)}
                rows={3}
                style={{
                  width: '100%', padding: T.spacingSm,
                  border: `1px solid ${T.colorBorder}`, borderRadius: T.radiusSm,
                  fontSize: T.fontSizeSm, fontFamily: T.fontMono,
                  resize: 'vertical', outline: 'none',
                  boxSizing: 'border-box',
                  transition: `border-color ${T.transitionFast}`,
                }}
              />

              {/* File list */}
              <div style={{ marginTop: T.spacingXs }}>
                {post.files.map((f) => (
                  <div key={f} style={{
                    fontSize: T.fontSizeXs, color: T.colorTextMuted,
                    fontFamily: T.fontMono, lineHeight: 1.6,
                  }}>
                    {f}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Actions */}
        <div style={{
          display: 'flex', justifyContent: 'flex-end', gap: T.spacingMd,
          marginTop: T.spacingLg, paddingTop: T.spacingMd,
          borderTop: `1px solid ${T.colorBorder}`,
        }}>
          <button
            onClick={onCancel}
            style={{
              padding: `${T.spacingSm} ${T.spacingLg}`, background: 'none',
              border: `1px solid ${T.colorBorder}`, borderRadius: T.radiusSm,
              fontSize: T.fontSizeSm, color: T.colorTextSecondary, cursor: 'pointer',
              transition: `all ${T.transitionFast}`,
            }}
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            style={{
              padding: `${T.spacingSm} ${T.spacingLg}`,
              background: '#059669', color: '#fff',
              border: 'none', borderRadius: T.radiusSm,
              fontSize: T.fontSizeSm, fontWeight: 500, cursor: 'pointer',
              transition: `all ${T.transitionFast}`,
            }}
          >
            Commit
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
};

export default GitCommitModal;
