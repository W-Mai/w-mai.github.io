import { keymap, type Extension } from '@codemirror/view';
import { indentMore, indentLess } from '@codemirror/commands';
import { FORMAT_ACTIONS, toggleComment } from './editor-formatting';

export interface ShortcutDef {
  key: string;
  label: string;
  action: string;
  category: 'formatting' | 'editing' | 'navigation' | 'ai';
}

/** All shortcut definitions for display in ShortcutPanel */
export const SHORTCUTS: ShortcutDef[] = [
  { key: 'Mod-b', label: 'Bold', action: 'bold', category: 'formatting' },
  { key: 'Mod-i', label: 'Italic', action: 'italic', category: 'formatting' },
  { key: 'Mod-k', label: 'Insert Link', action: 'link', category: 'formatting' },
  { key: 'Mod-Shift-k', label: 'Code Block', action: 'code-block', category: 'formatting' },
  { key: 'Mod-Shift-i', label: 'Insert Image', action: 'image', category: 'formatting' },
  { key: 'Mod-/', label: 'Toggle Comment', action: 'toggle-comment', category: 'editing' },
  { key: 'Mod-s', label: 'Save', action: 'save', category: 'editing' },
  { key: 'Tab', label: 'Indent', action: 'indent', category: 'editing' },
  { key: 'Shift-Tab', label: 'Dedent', action: 'dedent', category: 'editing' },
  { key: 'Mod-Shift-?', label: 'Shortcut Reference', action: 'show-shortcuts', category: 'navigation' },
  { key: 'Mod-e', label: 'Insert Sticker', action: 'sticker', category: 'formatting' },
];

/** CodeMirror keymap extension with all editor shortcuts */
export function editorKeymap(handlers: {
  onSave: () => void;
  onShowShortcuts: () => void;
}): Extension {
  return keymap.of([
    { key: 'Mod-b', run: (view) => FORMAT_ACTIONS.bold(view) },
    { key: 'Mod-i', run: (view) => FORMAT_ACTIONS.italic(view) },
    { key: 'Mod-k', run: (view) => FORMAT_ACTIONS.link(view) },
    { key: 'Mod-Shift-k', run: (view) => FORMAT_ACTIONS['code-block'](view) },
    { key: 'Mod-Shift-i', run: (view) => FORMAT_ACTIONS.image(view) },
    { key: 'Mod-/', run: (view) => toggleComment(view) },
    {
      key: 'Mod-s',
      run: () => {
        handlers.onSave();
        return true;
      },
    },
    { key: 'Tab', run: indentMore },
    { key: 'Shift-Tab', run: indentLess },
    {
      key: 'Mod-Shift-?',
      run: () => {
        handlers.onShowShortcuts();
        return true;
      },
    },
  ]);
}
