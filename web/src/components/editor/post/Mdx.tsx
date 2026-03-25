import { useEffect, useRef, useCallback, useImperativeHandle, forwardRef, useState, type FC } from 'react';
import { EditorView, keymap, lineNumbers, highlightActiveLine } from '@codemirror/view';
import { EditorState, Compartment } from '@codemirror/state';
import { markdown } from '@codemirror/lang-markdown';
import { languages } from '@codemirror/language-data';
import { EDITOR_TOKENS as T } from '~/components/editor/shared/editor-tokens';
import { defaultKeymap, history, historyKeymap } from '@codemirror/commands';
import { searchKeymap, highlightSelectionMatches } from '@codemirror/search';
import { syntaxHighlighting, defaultHighlightStyle, bracketMatching } from '@codemirror/language';
import { oneDark } from '@codemirror/theme-one-dark';
import { editorKeymap } from '~/lib/editor/shortcuts';
import { detectActiveFormats } from '~/lib/editor/formatting';
import { editorAutocomplete } from '~/lib/editor/autocomplete';
import { frontmatterExtension } from '~/lib/editor/frontmatter-ext';

export interface MdxEditorHandle {
  getView: () => EditorView | null;
  insertText: (text: string) => void;
}

interface MdxEditorProps {
  content: string;
  onChange: (value: string) => void;
  onSave: () => void;
  onScroll?: (ratio: number) => void;
  onActiveFormatsChange?: (formats: Set<string>) => void;
  onContextMenu?: (e: { x: number; y: number; hasSelection: boolean }) => void;
  onShowShortcuts?: () => void;
  onFileUpload?: (file: File) => void;
  onStickerOpen?: () => void;
}

const ALLOWED_EXT = /\.(png|jpe?g|gif|svg|webp|avif|ico|pdf)$/i;

// Compartment for dynamic light/dark syntax theme switching
const themeCompartment = new Compartment();

function isDarkMode(): boolean {
  return document.documentElement.classList.contains('dark');
}

function getSyntaxTheme() {
  return isDarkMode()
    ? oneDark
    : syntaxHighlighting(defaultHighlightStyle);
}

const editorTheme = EditorView.theme({
  '&': { height: '100%', fontSize: '14px' },
  '.cm-scroller': {
    fontFamily: "'SF Mono', 'Fira Code', 'Fira Mono', Menlo, monospace",
    overflow: 'auto',
  },
  '.cm-content': { padding: '0.75rem 0' },
  '.cm-gutters': {
    background: 'var(--neu-bg)',
    border: 'none',
    color: 'var(--text-muted)',
  },
  '.cm-activeLineGutter': {
    background: 'var(--editor-bg-secondary)',
    color: 'var(--text-primary)',
  },
  '.cm-activeLine': { background: 'var(--hover-bg)' },
});

const MdxEditor = forwardRef<MdxEditorHandle, MdxEditorProps>(
  ({ content, onChange, onSave, onScroll, onActiveFormatsChange, onContextMenu, onShowShortcuts, onFileUpload, onStickerOpen }, ref) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const viewRef = useRef<EditorView | null>(null);
    const onChangeRef = useRef(onChange);
    const onSaveRef = useRef(onSave);
    const onScrollRef = useRef(onScroll);
    const onActiveFormatsChangeRef = useRef(onActiveFormatsChange);
    const onContextMenuRef = useRef(onContextMenu);
    const onShowShortcutsRef = useRef(onShowShortcuts);
    const onFileUploadRef = useRef(onFileUpload);
    const onStickerOpenRef = useRef(onStickerOpen);

    onChangeRef.current = onChange;
    onSaveRef.current = onSave;
    onScrollRef.current = onScroll;
    onActiveFormatsChangeRef.current = onActiveFormatsChange;
    onContextMenuRef.current = onContextMenu;
    onShowShortcutsRef.current = onShowShortcuts;
    onFileUploadRef.current = onFileUpload;
    onStickerOpenRef.current = onStickerOpen;

    useImperativeHandle(ref, () => ({
      getView: () => viewRef.current,
      insertText: (text: string) => {
        const view = viewRef.current;
        if (!view) return;
        const pos = view.state.selection.main.head;
        view.dispatch({ changes: { from: pos, insert: text } });
      },
    }));

    useEffect(() => {
      if (!containerRef.current) return;

      const shortcuts = editorKeymap({
        onSave: () => onSaveRef.current(),
        onShowShortcuts: () => onShowShortcutsRef.current?.(),
      });

      const stickerShortcut = keymap.of([{
        key: 'Mod-e',
        run: () => { onStickerOpenRef.current?.(); return true; },
      }]);

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

      const dropPasteHandler = EditorView.domEventHandlers({
        drop(event) {
          const files = Array.from(event.dataTransfer?.files || []);
          if (files.length === 0 || !onFileUploadRef.current) return false;
          event.preventDefault();
          for (const file of files) {
            if (ALLOWED_EXT.test(file.name)) onFileUploadRef.current(file);
          }
          return true;
        },
        paste(event) {
          const files = Array.from(event.clipboardData?.files || []);
          if (files.length === 0 || !onFileUploadRef.current) return false;
          event.preventDefault();
          for (const file of files) {
            if (ALLOWED_EXT.test(file.name)) onFileUploadRef.current(file);
          }
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
          themeCompartment.of(getSyntaxTheme()),
          markdown({ codeLanguages: languages }),
          shortcuts,
          keymap.of([...defaultKeymap, ...historyKeymap, ...searchKeymap]),
          updateListener,
          editorTheme,
          EditorView.lineWrapping,
          editorAutocomplete(),
          stickerShortcut,
          dropPasteHandler,
          contextMenuHandler,
          frontmatterExtension(),
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

      // Watch for dark mode toggle and reconfigure syntax theme
      const observer = new MutationObserver(() => {
        if (viewRef.current) {
          viewRef.current.dispatch({
            effects: themeCompartment.reconfigure(getSyntaxTheme()),
          });
        }
      });
      observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });

      return () => {
        observer.disconnect();
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
        style={{
          height: '100%', overflow: 'hidden',
          background: T.colorBg,
          padding: T.spacingLg,
          display: 'flex',
          flexDirection: 'column',
        }}
      />
    );
  },
);

MdxEditor.displayName = 'MdxEditor';

export default MdxEditor;
