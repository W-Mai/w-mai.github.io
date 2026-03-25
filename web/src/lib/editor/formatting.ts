import type { EditorView } from '@codemirror/view';
import type { EditorState } from '@codemirror/state';

export type FormatAction =
  | 'bold' | 'italic' | 'strikethrough'
  | 'h1' | 'h2' | 'h3'
  | 'code-inline' | 'code-block'
  | 'link' | 'image'
  | 'ul' | 'ol' | 'blockquote' | 'hr';

/** Wrap selection with markers, or insert placeholder if no selection */
export function wrapSelection(
  view: EditorView,
  before: string,
  after: string,
  placeholder: string,
): boolean {
  const { from, to } = view.state.selection.main;
  const selected = view.state.sliceDoc(from, to);

  if (selected.length > 0) {
    view.dispatch({
      changes: { from, to, insert: `${before}${selected}${after}` },
      selection: { anchor: from + before.length, head: from + before.length + selected.length },
    });
  } else {
    const text = `${before}${placeholder}${after}`;
    view.dispatch({
      changes: { from, insert: text },
      selection: { anchor: from + before.length, head: from + before.length + placeholder.length },
    });
  }
  return true;
}

/** Toggle line prefix (e.g., heading, list, blockquote) on current line(s) */
export function toggleLinePrefix(view: EditorView, prefix: string): boolean {
  const { from, to } = view.state.selection.main;
  const doc = view.state.doc;

  const startLine = doc.lineAt(from).number;
  const endLine = doc.lineAt(to).number;

  const changes: { from: number; to: number; insert: string }[] = [];

  for (let i = startLine; i <= endLine; i++) {
    const line = doc.line(i);
    if (line.text.startsWith(prefix)) {
      // Remove prefix
      changes.push({ from: line.from, to: line.from + prefix.length, insert: '' });
    } else {
      // Add prefix
      changes.push({ from: line.from, to: line.from, insert: prefix });
    }
  }

  view.dispatch({ changes });
  return true;
}

/** Insert a block template at cursor, ensuring blank lines before/after */
export function insertBlock(view: EditorView, template: string): boolean {
  const { from } = view.state.selection.main;
  const doc = view.state.doc;
  const line = doc.lineAt(from);

  let prefix = '';
  let suffix = '';

  // Ensure blank line before if current line is not empty and not at doc start
  if (line.number > 1) {
    const prevLine = doc.line(line.number - 1);
    if (prevLine.text.trim() !== '' || line.text.trim() !== '') {
      prefix = line.text.trim() === '' ? '' : '\n';
      if (prevLine.text.trim() !== '' && line.text.trim() === '') {
        prefix = '';
      }
    }
  }

  // Ensure blank line after
  if (line.number < doc.lines) {
    const nextLine = doc.line(line.number + 1);
    if (nextLine.text.trim() !== '') {
      suffix = '\n';
    }
  }

  // If inserting at a non-empty line, move to end of line first
  const insertPos = line.text.trim() === '' ? line.from : line.to;
  const insertPrefix = line.text.trim() === '' ? prefix : `\n${prefix}`;

  const text = `${insertPrefix}${template}\n${suffix}`;
  view.dispatch({
    changes: { from: insertPos, to: line.text.trim() === '' ? line.to : insertPos, insert: text },
  });
  return true;
}

/** Toggle HTML comment wrapper around selected text or current line */
export function toggleComment(view: EditorView): boolean {
  const { from, to } = view.state.selection.main;
  const doc = view.state.doc;

  let selFrom = from;
  let selTo = to;

  // If no selection, use the current line
  if (selFrom === selTo) {
    const line = doc.lineAt(selFrom);
    selFrom = line.from;
    selTo = line.to;
  }

  const text = view.state.sliceDoc(selFrom, selTo);
  const commentStart = '<!-- ';
  const commentEnd = ' -->';

  if (text.startsWith(commentStart) && text.endsWith(commentEnd)) {
    // Unwrap comment
    const inner = text.slice(commentStart.length, text.length - commentEnd.length);
    view.dispatch({
      changes: { from: selFrom, to: selTo, insert: inner },
      selection: { anchor: selFrom, head: selFrom + inner.length },
    });
  } else {
    // Wrap with comment
    const wrapped = `${commentStart}${text}${commentEnd}`;
    view.dispatch({
      changes: { from: selFrom, to: selTo, insert: wrapped },
      selection: { anchor: selFrom, head: selFrom + wrapped.length },
    });
  }
  return true;
}

/** Detect active markdown formats at the current cursor position */
export function detectActiveFormats(state: EditorState): Set<string> {
  const formats = new Set<string>();
  const { from } = state.selection.main;
  const line = state.doc.lineAt(from);
  const lineText = line.text;

  // Check line-level formats
  if (/^### /.test(lineText)) formats.add('h3');
  else if (/^## /.test(lineText)) formats.add('h2');
  else if (/^# /.test(lineText)) formats.add('h1');

  if (/^- /.test(lineText)) formats.add('ul');
  if (/^1\. /.test(lineText)) formats.add('ol');
  if (/^> /.test(lineText)) formats.add('blockquote');

  // Check inline formats by scanning text around cursor
  const docText = state.doc.toString();
  const cursor = from;

  if (isInsideMarker(docText, cursor, '**', '**')) formats.add('bold');
  if (isInsideMarker(docText, cursor, '~~', '~~')) formats.add('strikethrough');
  if (isInsideSingleBacktick(docText, cursor)) formats.add('code-inline');
  if (isInsideItalic(docText, cursor)) formats.add('italic');

  return formats;
}

/** Check if cursor is between symmetric markers (e.g., ** ... **) */
function isInsideMarker(text: string, cursor: number, open: string, close: string): boolean {
  // Find the nearest opening marker before cursor
  const before = text.lastIndexOf(open, cursor - 1);
  if (before === -1) return false;

  // Find the nearest closing marker after cursor
  const after = text.indexOf(close, cursor);
  if (after === -1) return false;

  // Ensure the opening marker is not the same as the closing marker
  if (before + open.length > cursor) return false;

  // Verify no line break between markers (inline format)
  const segment = text.slice(before, after + close.length);
  if (segment.includes('\n')) return false;

  return true;
}

/** Check if cursor is inside single backtick code span */
function isInsideSingleBacktick(text: string, cursor: number): boolean {
  // Avoid matching ``` (code block fences)
  const before = text.lastIndexOf('`', cursor - 1);
  if (before === -1) return false;
  if (before > 0 && text[before - 1] === '`') return false;

  const after = text.indexOf('`', cursor);
  if (after === -1) return false;
  if (after + 1 < text.length && text[after + 1] === '`') return false;

  const segment = text.slice(before, after + 1);
  if (segment.includes('\n')) return false;

  return true;
}

/** Check if cursor is inside italic markers (* or _) but not bold (**) */
function isInsideItalic(text: string, cursor: number): boolean {
  // Check *text* (single asterisk, not double)
  const beforeStar = text.lastIndexOf('*', cursor - 1);
  if (beforeStar !== -1) {
    const isBoldBefore = beforeStar > 0 && text[beforeStar - 1] === '*';
    if (!isBoldBefore) {
      const afterStar = text.indexOf('*', cursor);
      if (afterStar !== -1) {
        const isBoldAfter = afterStar + 1 < text.length && text[afterStar + 1] === '*';
        if (!isBoldAfter) {
          const segment = text.slice(beforeStar, afterStar + 1);
          if (!segment.includes('\n')) return true;
        }
      }
    }
  }

  // Check _text_
  const beforeUnderscore = text.lastIndexOf('_', cursor - 1);
  if (beforeUnderscore !== -1) {
    const afterUnderscore = text.indexOf('_', cursor);
    if (afterUnderscore !== -1) {
      const segment = text.slice(beforeUnderscore, afterUnderscore + 1);
      if (!segment.includes('\n')) return true;
    }
  }

  return false;
}

/** Mapping of each format action to its implementation */
export const FORMAT_ACTIONS: Record<FormatAction, (view: EditorView) => boolean> = {
  bold: (view) => wrapSelection(view, '**', '**', 'bold text'),
  italic: (view) => wrapSelection(view, '*', '*', 'italic text'),
  strikethrough: (view) => wrapSelection(view, '~~', '~~', 'strikethrough text'),
  'code-inline': (view) => wrapSelection(view, '`', '`', 'code'),
  link: (view) => wrapSelection(view, '[', '](url)', 'link text'),
  image: (view) => wrapSelection(view, '![', '](url)', 'alt text'),
  h1: (view) => toggleLinePrefix(view, '# '),
  h2: (view) => toggleLinePrefix(view, '## '),
  h3: (view) => toggleLinePrefix(view, '### '),
  ul: (view) => toggleLinePrefix(view, '- '),
  ol: (view) => toggleLinePrefix(view, '1. '),
  blockquote: (view) => toggleLinePrefix(view, '> '),
  'code-block': (view) => insertBlock(view, '```\n\n```'),
  hr: (view) => insertBlock(view, '---'),
};
