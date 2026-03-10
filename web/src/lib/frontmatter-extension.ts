import {
  WidgetType,
  Decoration,
  ViewPlugin,
  EditorView,
  type DecorationSet,
} from '@codemirror/view';
import { StateField, StateEffect, type Extension, type Transaction } from '@codemirror/state';
import { createRoot, type Root } from 'react-dom/client';
import { createElement } from 'react';

import {
  detectFrontmatterRange,
  parseFrontmatter,
  serializeFrontmatter,
  type FrontmatterData,
  type FrontmatterRange,
  type ParseResult,
} from './frontmatter-utils';
import FrontmatterPanel from '../components/editor/FrontmatterPanel';
import { EDITOR_TOKENS as T } from '../components/editor/editor-tokens';

// Module-level flag to prevent re-entrant updates from widget dispatches
let dispatching = false;

// StateEffect to inject the EditorView reference into the state field
const setViewEffect = StateEffect.define<EditorView>();

// ── FrontmatterWidget ────────────────────────────────────────────────

class FrontmatterWidget extends WidgetType {
  private root: Root | null = null;

  constructor(
    readonly data: FrontmatterData,
    readonly parseResult: ParseResult,
    readonly range: FrontmatterRange,
    private view: EditorView,
  ) {
    super();
  }

  eq(other: FrontmatterWidget): boolean {
    return JSON.stringify(this.data) === JSON.stringify(other.data)
      && this.parseResult.ok === other.parseResult.ok;
  }

  toDOM(): HTMLElement {
    const container = document.createElement('div');
    container.style.fontFamily = T.fontSans;

    if (!this.parseResult.ok) {
      this.renderError(container, this.parseResult.error, this.range.yamlText);
      return container;
    }

    this.root = createRoot(container);
    this.root.render(
      createElement(FrontmatterPanel, {
        data: this.data,
        onChange: this.handleFieldChange,
      }),
    );
    return container;
  }

  destroy(): void {
    const root = this.root;
    if (root) {
      this.root = null;
      setTimeout(() => { try { root.unmount(); } catch {} }, 0);
    }
  }

  private renderError(container: HTMLElement, error: string, rawYaml: string): void {
    const banner = document.createElement('div');
    banner.style.cssText = `
      padding: ${T.spacingMd} ${T.spacingLg};
      background: ${T.colorErrorBg};
      color: ${T.colorError};
      font-size: ${T.fontSizeSm};
      font-family: ${T.fontSans};
      border-radius: ${T.radiusMd};
      margin-bottom: ${T.spacingMd};
    `;
    banner.textContent = `YAML parse error: ${error}`;
    container.appendChild(banner);

    const pre = document.createElement('pre');
    pre.style.cssText = `
      padding: ${T.spacingMd} ${T.spacingLg};
      background: ${T.colorBg};
      font-size: ${T.fontSizeSm};
      font-family: ${T.fontMono};
      border-radius: ${T.radiusMd};
      white-space: pre-wrap;
      word-break: break-word;
      margin: 0;
    `;
    pre.textContent = rawYaml;
    container.appendChild(pre);
  }

  // ── Panel → Document sync ──────────────────────────────────────────

  private fieldTimers = new Map<string, ReturnType<typeof setTimeout>>();

  private handleFieldChange = (
    field: keyof FrontmatterData,
    value: FrontmatterData[keyof FrontmatterData],
  ): void => {
    const existing = this.fieldTimers.get(field);
    if (existing != null) clearTimeout(existing);

    const timer = setTimeout(() => {
      this.fieldTimers.delete(field);
      this.dispatchUpdate(field, value);
    }, 300);
    this.fieldTimers.set(field, timer);
  };

  private dispatchUpdate(
    field: keyof FrontmatterData,
    value: FrontmatterData[keyof FrontmatterData],
  ): void {
    try {
      const updatedData = { ...this.data, [field]: value };
      const yaml = serializeFrontmatter(updatedData);
      const currentRange = detectFrontmatterRange(this.view.state.doc);
      if (!currentRange) return;

      dispatching = true;
      this.view.dispatch({
        changes: {
          from: currentRange.from,
          to: currentRange.to,
          insert: yaml,
        },
      });
    } catch (e) {
      console.error('[frontmatter-extension] dispatch failed:', e);
    } finally {
      dispatching = false;
    }
  }
}

// ── StateField for block-level decorations ───────────────────────────

/** Build decorations from document state + view reference */
function buildDecorations(view: EditorView): DecorationSet {
  const range = detectFrontmatterRange(view.state.doc);
  if (!range) return Decoration.none;

  const parseResult = parseFrontmatter(range.yamlText);
  const data: FrontmatterData = parseResult.ok
    ? parseResult.data
    : { title: '', description: '', pubDate: '', tags: [] };

  const widget = new FrontmatterWidget(data, parseResult, range, view);
  const deco = Decoration.replace({ widget, block: true });
  return Decoration.set([deco.range(range.from, range.to)]);
}

/** Stores the current EditorView reference for decoration building */
let activeView: EditorView | null = null;

const frontmatterDecoField = StateField.define<DecorationSet>({
  create() {
    return Decoration.none;
  },
  update(decos, tr) {
    // Capture view reference from effect
    for (const e of tr.effects) {
      if (e.is(setViewEffect)) {
        activeView = e.value;
        return buildDecorations(activeView);
      }
    }
    // Skip re-entrant updates
    if (dispatching) return decos;
    // Rebuild on doc changes
    if (tr.docChanged && activeView) {
      return buildDecorations(activeView);
    }
    return decos;
  },
  provide(field) {
    return EditorView.decorations.from(field);
  },
});

// ViewPlugin that injects the EditorView reference on creation
const viewRefPlugin = ViewPlugin.define((view) => {
  // Dispatch the view reference so the StateField can build decorations
  queueMicrotask(() => {
    view.dispatch({ effects: setViewEffect.of(view) });
  });
  return { update() {} };
});

/**
 * CM6 extension that replaces the frontmatter YAML region
 * with a visual editing panel.
 */
export function frontmatterExtension(): Extension {
  return [frontmatterDecoField, viewRefPlugin];
}
