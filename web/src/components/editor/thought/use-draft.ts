import { useState, useEffect, useRef } from 'react';

const DRAFT_KEY = 'thought-editor-draft';

export interface DraftState {
  content: string;
  tagInput: string;
  mood: string;
  editingId: string | null;
}

const EMPTY_DRAFT: DraftState = { content: '', tagInput: '', mood: '', editingId: null };

function load(): DraftState | null {
  try {
    const raw = sessionStorage.getItem(DRAFT_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

function save(draft: DraftState) {
  try { sessionStorage.setItem(DRAFT_KEY, JSON.stringify(draft)); } catch {}
}

function clear() {
  try { sessionStorage.removeItem(DRAFT_KEY); } catch {}
}

/** Persist editor draft to sessionStorage across page refreshes. */
export function useThoughtDraft() {
  const [state, setState] = useState<DraftState>(EMPTY_DRAFT);
  const inited = useRef(false);

  // Restore on mount
  useEffect(() => {
    const draft = load();
    if (draft) setState(draft);
  }, []);

  // Persist on change (skip initial restore)
  useEffect(() => {
    if (!inited.current) { inited.current = true; return; }
    const hasData = state.content || state.tagInput || state.mood || state.editingId;
    hasData ? save(state) : clear();
  }, [state]);

  const update = (patch: Partial<DraftState>) =>
    setState((prev) => ({ ...prev, ...patch }));

  const reset = () => { setState(EMPTY_DRAFT); clear(); };

  return { ...state, update, reset } as const;
}
