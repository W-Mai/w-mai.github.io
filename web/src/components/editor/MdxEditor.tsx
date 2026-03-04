import { useEffect, useRef, useCallback, useImperativeHandle, forwardRef, useState, type FC } from 'react';
import { EditorView, keymap, lineNumbers, highlightActiveLine } from '@codemirror/view';
import { EditorState } from '@codemirror/state';
import { markdown } from '@codemirror/lang-markdown';
import { languages } from '@codemirror/language-data';
import { defaultKeymap, history, historyKeymap } from '@codemirror/commands';
import { searchKeymap, highlightSelectionMatches } from '@codemirror/search';
import { syntaxHighlighting, defaultHighlightStyle, bracketMatching } from '@codemirror/language';
import { editorKeymap } from '../../lib/editor-shortcuts';
import { detectActiveFormats } from '../../lib/editor-formatting';

export interface MdxEditorHandle {
  getView: () => EditorView | null;
}

interface MdxEditorProps {
  content: string;
  onChange: (value: string) => void;
  onSave: () => void;
  onScroll?: (ratio: number) => void;
  onActiveFormatsChange?: (formats: Set<string>) => void;
  onContextMenu?: (e: { x: number; y: number; hasSelection: boolean }) => void;
  onShowShortcuts?: () => void;
}

const ALLOWED_EXT = /\.(png|jpe?g|gif|svg|webp|avif|ico|pdf)$/i;

/** Upload a file to the assets API and return the MDX reference string */
async function uploadAsset(file: File): Promise<string> {
  const name = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
  if (!ALLOWED_EXT.test(name)) throw new Error(`Unsupported file type: ${name}`);

  const res = await fetch(`/api/editor/assets/${encodeURIComponent(name)}`, {
    method: 'POST',
    body: file,
  });
  if (res.status === 409) {
    return `./assets/${name}`;
  }
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || `Upload failed: ${name}`);
  }
  return `./assets/${name}`;
}

/** Handle dropped/pasted files: upload and insert references */
async function handleFiles(files: File[], view: EditorView) {
  for (const file of files) {
    const placeholder = `![Uploading ${file.name}...]()`;
    const pos = view.state.selection.main.head;
    view.dispatch({ changes: { from: pos, insert: placeholder } });

    try {
      const ref = await uploadAsset(file);
      const imgRef = `![${file.name}](${ref})`;
      const doc = view.state.doc.toString();
      const idx = doc.indexOf(placeholder);
      if (idx >= 0) {
        view.dispatch({ changes: { from: idx, to: idx + placeholder.length, insert: imgRef } });
      }
    } catch {
      const doc = view.state.doc.toString();
      const idx = doc.indexOf(placeholder);
      if (idx >= 0) {
        view.dispatch({ changes: { from: idx, to: idx + placeholder.length, insert: '' } });
      }
    }
  }
}

/** CodeMirror extension to handle drag-and-drop and paste file uploads */
const dropPasteHandler = EditorView.domEventHandlers({
  drop(event, view) {
    const files = Array.from(event.dataTransfer?.files || []);
    if (files.length === 0) return false;
    event.preventDefault();
    const pos = view.posAtCoords({ x: event.clientX, y: event.clientY });
    if (pos != null) view.dispatch({ selection: { anchor: pos } });
    handleFiles(files, view);
    return true;
  },
  paste(event, view) {
    const files = Array.from(event.clipboardData?.files || []);
    if (files.length === 0) return false;
    event.preventDefault();
    handleFiles(files, view);
    return true;
  },
});

const editorTheme = EditorView.theme({
  '&': { height: '100%', fontSize: '14px' },
  '.cm-scroller': {
    fontFamily: "'SF Mono', 'Fira Code', 'Fira Mono', Menlo, monospace",
    overflow: 'auto',
  },
  '.cm-content': { padding: '0.75rem 0' },
  '.cm-gutters': {
    background: '#fafafa',
    borderRight: '1px solid #e5e7eb',
    color: '#9ca3af',
  },
  '.cm-activeLineGutter': { background: '#f3f4f6' },
  '.cm-activeLine': { background: '#f9fafb' },
});

const MdxEditor = forwardRef<MdxEditorHandle, MdxEditorProps>(
  ({ content, onChange, onSave, onScroll, onActiveFormatsChange, onContextMenu, onShowShortcuts }, ref) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const viewRef = useRef<EditorView | null>(null);
    const onChangeRef = useRef(onChange);
    const onSaveRef = useRef(onSave);
    const onScrollRef = useRef(onScroll);
    const onActiveFormatsChangeRef = useRef(onActiveFormatsChange);
    const onContextMenuRef = useRef(onContextMenu);
    const onShowShortcutsRef = useRef(onShowShortcuts);

    onChangeRef.current = onChange;
    onSaveRef.current = onSave;
    onScrollRef.current = onScroll;
    onActiveFormatsChangeRef.current = onActiveFormatsChange;
    onContextMenuRef.current = onContextMenu;
    onShowShortcutsRef.current = onShowShortcuts;

    useImperativeHandle(ref, () => ({
      getView: () => viewRef.current,
    }));

    useEffect(() => {
      if (!containerRef.current) return;

      const shortcuts = editorKeymap({
        onSave: () => onSaveRef.current(),
        onShowShortcuts: () => onShowShortcutsRef.current?.(),
      });

      const updateListener = EditorView.updateListener.of((update) => {
        if (update.docChanged) {
          onChangeRef.current(update.state.doc.toString());
        }
        if (update.selectionSet || update.docChanged) {
          onActiveFormatsChangeRef.current?.(detectActiveFormats(update.state));
        }
      });

      const contextMenuHandler = EditorView.domEventHandlers({
        contextmenu(event, view) {
          if (!onContextMenuRef.current) return false;
          event.preventDefault();
          const { from, to } = view.state.selection.main;
          onContextMenuRef.current({
            x: event.clientX,
            y: event.clientY,
            hasSelection: from !== to,
          });
          return true;
        },
      });

      const state = EditorState.create({
        doc: content,
        extensions: [
          lineNumbers(),
          highlightActiveLine(),
          history(),
          bracketMatching(),
          highlightSelectionMatches(),
          syntaxHighlighting(defaultHighlightStyle),
          markdown({ codeLanguages: languages }),
          shortcuts,
          keymap.of([...defaultKeymap, ...historyKeymap, ...searchKeymap]),
          updateListener,
          editorTheme,
          EditorView.lineWrapping,
          dropPasteHandler,
          contextMenuHandler,
        ],
      });

      const view = new EditorView({ state, parent: containerRef.current });
      viewRef.current = view;

      // Scroll sync
      const scroller = containerRef.current.querySelector('.cm-scroller');
      const handleScroll = () => {
        if (!scroller || !onScrollRef.current) return;
        const { scrollTop, scrollHeight, clientHeight } = scroller;
        const maxScroll = scrollHeight - clientHeight;
        const ratio = maxScroll > 0 ? scrollTop / maxScroll : 0;
        onScrollRef.current(ratio);
      };
      scroller?.addEventListener('scroll', handleScroll, { passive: true });

      return () => {
        scroller?.removeEventListener('scroll', handleScroll);
        view.destroy();
        viewRef.current = null;
      };
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    // Sync external content changes into the editor
    useEffect(() => {
      const view = viewRef.current;
      if (!view) return;
      const current = view.state.doc.toString();
      if (current !== content) {
        view.dispatch({
          changes: { from: 0, to: current.length, insert: content },
        });
      }
    }, [content]);

    return (
      <div
        ref={containerRef}
        style={{ height: '100%', overflow: 'hidden' }}
      />
    );
  },
);

MdxEditor.displayName = 'MdxEditor';

export default MdxEditor;
