import {
  WidgetType,
  Decoration,
  ViewPlugin,
  EditorView,
  type DecorationSet,
} from '@codemirror/view';
import { StateField, StateEffect, type Extension } from '@codemirror/state';
import { createRoot, type Root } from 'react-dom/client';
import { createElement } from 'react';

import {
  detectFrontmatterRange,
  parseFrontmatter,
  serializeFrontmatter,
  type FrontmatterData,
  type FrontmatterRange,
  type ParseResult,
} from './frontmatter';
import FrontmatterPanel from '../components/editor/post/FrontmatterPanel';
import { EDITOR_TOKENS as T } from '../../components/editor/shared/editor-tokens';
import { CATEGORIES } from '../../data/categories';

// StateEffect to inject the EditorView reference into the state field
const setViewEffect = StateEffect.define<EditorView>();

// Current post slug for co-located image resolution
let activeSlug: string | null = null;

// Mutable category list — initialized from CATEGORIES, synced via API
let activeCategoryList: string[] = [...CATEGORIES];

/** Persist category list to categories.ts via editor API */
function handleCategoriesChange(cats: string[]): void {
  activeCategoryList = cats;
  fetch('/api/editor/categories', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(cats),
  }).catch(() => {});
}

/** Update the active slug for frontmatter panel image resolution */
export function setFrontmatterSlug(slug: string | null): void {
  activeSlug = slug;
}

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

  // Always return false so CM6 calls updateDOM() for in-place React re-render
  // instead of destroy()+toDOM() which would lose input focus.
  eq(_other: FrontmatterWidget): boolean {
    return false;
  }

  toDOM(): HTMLElement {
    const container = document.createElement('div');
    container.style.fontFamily = T.fontSans;

    if (!this.parseResult.ok) {
      this.renderError(container, this.parseResult.error, this.range.yamlText);
      return container;
    }

    this.root = createRoot(container);
    this.renderPanel();
    return container;
  }

  /** Re-render the React panel with fresh data read from the document */
  updateDOM(): boolean {
    if (!this.root || !this.parseResult.ok) return false;
    this.renderPanel();
    return true;
  }

  destroy(): void {
    const root = this.root;
    if (root) {
      this.root = null;
      setTimeout(() => { try { root.unmount(); } catch {} }, 0);
    }
  }

  private renderPanel(): void {
    if (!this.root) return;
    this.root.render(
      createElement(FrontmatterPanel, {
        slug: activeSlug ?? undefined,
        data: this.data,
        onChange: this.handleFieldChange,
        allCategories: [...activeCategoryList],
        onCategoriesChange: handleCategoriesChange,
      }),
    );
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
      // Read current data from the document instead of using stale snapshot
      const currentRange = detectFrontmatterRange(this.view.state.doc);
      if (!currentRange) return;

      const currentParse = parseFrontmatter(currentRange.yamlText);
      const baseData = currentParse.ok
        ? currentParse.data
        : this.data;

      const updatedData = { ...baseData, [field]: value };
      const yaml = serializeFrontmatter(updatedData);

      this.view.dispatch({
        changes: {
          from: currentRange.from,
          to: currentRange.to,
          insert: yaml,
        },
      });
    } catch (e) {
      console.error('[frontmatter-extension] dispatch failed:', e);
    }
  }
}

// ── StateField for block-level decorations ───────────────────────────

/** Build decorations from a document snapshot + view reference for dispatch */
function buildDecorations(doc: import('@codemirror/state').Text, view: EditorView): DecorationSet {
  const range = detectFrontmatterRange(doc);
  if (!range) return Decoration.none;

  const parseResult = parseFrontmatter(range.yamlText);
  const data: FrontmatterData = parseResult.ok
    ? parseResult.data
    : { title: '', description: '', pubDate: '', tags: [] };

  const widget = new FrontmatterWidget(data, parseResult, range, view);
  const deco = Decoration.replace({ widget, block: true });
  return Decoration.set([deco.range(range.from, range.to)]);
}

/** Stores the current EditorView reference for dispatch access */
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
        // Use tr.state.doc (the NEW document after this transaction)
        return buildDecorations(tr.state.doc, activeView);
      }
    }
    // Rebuild on any doc change using the NEW document state
    if (tr.docChanged && activeView) {
      return buildDecorations(tr.state.doc, activeView);
    }
    return decos;
  },
  provide(field) {
    return EditorView.decorations.from(field);
  },
});

// ViewPlugin that injects the EditorView reference and cleans up on destroy
const viewRefPlugin = ViewPlugin.define((view) => {
  queueMicrotask(() => {
    view.dispatch({ effects: setViewEffect.of(view) });
  });
  return {
    update() {},
    destroy() {
      // Clear stale reference when the editor is destroyed
      if (activeView === view) activeView = null;
    },
  };
});

/**
 * CM6 extension that replaces the frontmatter YAML region
 * with a visual editing panel.
 */
export function frontmatterExtension(): Extension {
  return [frontmatterDecoField, viewRefPlugin];
}
