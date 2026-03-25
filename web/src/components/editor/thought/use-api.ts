import { useState, useCallback, useEffect, useRef } from 'react';

interface SaveParams {
  content: string;
  tags?: string[];
  mood?: string;
  editingId: string | null;
}

/** Encapsulates all ThoughtEditor API interactions. */
export function useThoughtApi(onSaved?: () => void) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [suggestingTags, setSuggestingTags] = useState(false);
  const [committing, setCommitting] = useState(false);
  const [commitResult, setCommitResult] = useState<string | null>(null);
  const [hasPending, setHasPending] = useState(false);
  const [previewHtml, setPreviewHtml] = useState('');
  const previewTimer = useRef<ReturnType<typeof setTimeout>>(null);

  const clearError = () => setError(null);

  // Check pending git changes
  const checkPending = useCallback(async () => {
    try {
      const res = await fetch('/api/editor/thoughts-git');
      const data = await res.json();
      setHasPending(data.pending?.length > 0);
    } catch { setHasPending(false); }
  }, []);

  useEffect(() => { checkPending(); }, [checkPending]);

  // Debounced markdown preview
  const updatePreview = useCallback((content: string) => {
    if (!content) { setPreviewHtml(''); return; }
    if (previewTimer.current) clearTimeout(previewTimer.current);
    previewTimer.current = setTimeout(async () => {
      try {
        const res = await fetch('/api/editor/thoughts-preview', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ content }),
        });
        const data = await res.json();
        if (data.html) setPreviewHtml(data.html);
      } catch { /* keep stale preview */ }
    }, 300);
  }, []);

  // Cleanup preview timer
  useEffect(() => () => {
    if (previewTimer.current) clearTimeout(previewTimer.current);
  }, []);

  const save = useCallback(async ({ content, tags, mood, editingId }: SaveParams) => {
    if (!content.trim()) { setError('Content is required'); return false; }
    setSaving(true);
    setError(null);
    try {
      const body = { content: content.trim(), tags, mood: mood || undefined };
      const url = editingId ? `/api/editor/thoughts/${editingId}` : '/api/editor/thoughts';
      const method = editingId ? 'PUT' : 'POST';
      const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Save failed');
      if (onSaved) onSaved(); else window.location.reload();
      checkPending();
      return true;
    } catch (err: any) {
      setError(err.message);
      return false;
    } finally {
      setSaving(false);
    }
  }, [onSaved, checkPending]);

  const remove = useCallback(async (id: string) => {
    if (!confirm('Delete this thought?')) return;
    try {
      const res = await fetch(`/api/editor/thoughts/${id}`, { method: 'DELETE' });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error || 'Delete failed'); }
      if (onSaved) onSaved(); else window.location.reload();
    } catch (err: any) {
      setError(err.message);
    }
  }, [onSaved]);

  const suggestTags = useCallback(async (content: string, currentTags: string[], existingTags: string[]) => {
    if (!content.trim()) return null;
    setSuggestingTags(true);
    setError(null);
    try {
      const res = await fetch('/api/editor/suggest-thought-tags', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: content.trim(), existingTags }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Tag suggestion failed');
      const merged = [...new Set([...currentTags, ...(data.tags || [])])];
      return { tags: merged, mood: data.mood as string | undefined };
    } catch (err: any) {
      setError(err.message);
      return null;
    } finally {
      setSuggestingTags(false);
    }
  }, []);

  const commit = useCallback(async () => {
    setCommitting(true);
    setError(null);
    setCommitResult(null);
    try {
      const res = await fetch('/api/editor/thoughts-git', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Commit failed');
      setCommitResult(`✓ ${data.hash}: ${data.message}`);
      setHasPending(false);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setCommitting(false);
    }
  }, []);

  return {
    saving, error, clearError,
    suggestingTags, committing, commitResult,
    hasPending, previewHtml,
    save, remove, suggestTags, commit, updatePreview,
  } as const;
}
