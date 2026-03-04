import { useEffect, useRef, useCallback, type FC } from 'react';
import { EditorView, keymap, lineNumbers, highlightActiveLine } from '@codemirror/view';
import { EditorState } from '@codemirror/state';
import { markdown } from '@codemirror/lang-markdown';
import { languages } from '@codemirror/language-data';
import { defaultKeymap, history, historyKeymap } from '@codemirror/commands';
import { searchKeymap, highlightSelectionMatches } from '@codemirror/search';
import { syntaxHighlighting, defaultHighlightStyle, bracketMatching } from '@codemirror/language';

interface MdxEditorProps {
  content: string;
  onChange: (value: string) => void;
  onSave: () => void;
  onScroll?: (ratio: number) => void;
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
    // Already exists — use existing file
    return `./assets/${name}`;
  }
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || `Upload failed: ${name}`);
  }
  return `./assets/${name}`;
}

/** Insert text at the current cursor position in a CodeMirror view */
function insertAtCursor(view: EditorView, text: string) {
  const pos = view.state.selection.main.head;
  view.dispatch({ changes: { from: pos, insert: text } });
}

/** Handle dropped/pasted files: upload and insert references */
async function handleFiles(files: File[], view: EditorView) {
  for (const file of files) {
    // Insert placeholder while uploading
    const placeholder = `![Uploading ${file.name}...]()`;
    const pos = view.state.selection.main.head;
    view.dispatch({ changes: { from: pos, insert: placeholder } });

    try {
      const ref = await uploadAsset(file);
      const imgRef = `![${file.name}](${ref})`;
      // Find and replace the placeholder
      const doc = view.state.doc.toString();
      const idx = doc.indexOf(placeholder);
      if (idx >= 0) {
        view.dispatch({ changes: { from: idx, to: idx + placeholder.length, insert: imgRef } });
      }
    } catch {
      // Remove placeholder on failure
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
    // Move cursor to drop position
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

const MdxEditor: FC<MdxEditorProps> = ({ content, onChange, onSave, onScroll }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const onChangeRef = useRef(onChange);
  const onSaveRef = useRef(onSave);
  const onScrollRef = useRef(onScroll);

  onChangeRef.current = onChange;
  onSaveRef.current = onSave;
  onScrollRef.current = onScroll;

  useEffect(() => {
    if (!containerRef.current) return;

    const saveKeymap = keymap.of([
      {
        key: 'Mod-s',
        run: () => {
          onSaveRef.current();
          return true;
        },
      },
    ]);

    const updateListener = EditorView.updateListener.of((update) => {
      if (update.docChanged) {
        onChangeRef.current(update.state.doc.toString());
      }
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
        saveKeymap,
        keymap.of([...defaultKeymap, ...historyKeymap, ...searchKeymap]),
        updateListener,
        editorTheme,
        EditorView.lineWrapping,
        dropPasteHandler,
      ],
    });

    const view = new EditorView({ state, parent: containerRef.current });
    viewRef.current = view;

    // Scroll sync: emit scroll ratio
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
};

export default MdxEditor;
