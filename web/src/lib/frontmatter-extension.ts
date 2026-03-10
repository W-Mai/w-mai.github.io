import {
  WidgetType,
  Decoration,
  ViewPlugin,
  type ViewUpdate,
  EditorView,
  type DecorationSet,
} from '@codemirror/view';
import type { Extension } from '@codemirror/state';
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

// ── Task 6.1: FrontmatterWidget ──────────────────────────────────────

class FrontmatterWidget extends WidgetType {
  private root: Root | null = null;

  constructor(
    private data: FrontmatterData,
    private parseResult: ParseResult,
    private range: FrontmatterRange,
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
      // Render error banner with raw YAML fallback
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
    if (this.root) {
      this.root.unmount();
      this.root = null;
    }
  }

  /** Render error banner and raw YAML text as fallback */
  private renderError(container: HTMLElement, error: string, rawYaml: string): void {
    // Error banner
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

    // Raw YAML fallback
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

  // ── Task 6.3: Panel → Document bidirectional sync ──────────────────

  /** Per-field debounce timers */
  private fieldTimers = new Map<string, ReturnType<typeof setTimeout>>();

  /** Flag to prevent re-entrant updates from our own dispatches */
  private dispatching = false;

  get isDispatching(): boolean {
    return this.dispatching;
  }

  private handleFieldChange = (
    field: keyof FrontmatterData,
    value: FrontmatterData[keyof FrontmatterData],
  ): void => {
    // Clear existing timer for this field
    const existing = this.fieldTimers.get(field);
    if (existing != null) clearTimeout(existing);

    // Debounce per-field (300ms)
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

      // Re-detect range from current doc state to avoid stale offsets
      const currentRange = detectFrontmatterRange(this.view.state.doc);
      if (!currentRange) return;

      this.dispatching = true;
      this.view.dispatch({
        changes: {
          from: currentRange.from,
          to: currentRange.to,
          insert: yaml,
        },
      });
      this.dispatching = false;
    } catch (e) {
      this.dispatching = false;
      console.error('[frontmatter-extension] dispatch failed:', e);
    }
  }
}

// ── Task 6.2: frontmatterPlugin ViewPlugin ───────────────────────────

/** Build a DecorationSet from the current document state */
function buildDecorations(view: EditorView): { decorations: DecorationSet; widget: FrontmatterWidget | null } {
  const range = detectFrontmatterRange(view.state.doc);
  if (!range) {
    return { decorations: Decoration.none, widget: null };
  }

  const parseResult = parseFrontmatter(range.yamlText);
  const data: FrontmatterData = parseResult.ok
    ? parseResult.data
    : { title: '', description: '', pubDate: '', tags: [] };

  const widget = new FrontmatterWidget(data, parseResult, range, view);

  const deco = Decoration.replace({
    widget,
    block: true,
  });

  return {
    decorations: Decoration.set([deco.range(range.from, range.to)]),
    widget,
  };
}

const frontmatterPlugin = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet;
    private currentWidget: FrontmatterWidget | null = null;

    constructor(view: EditorView) {
      const result = buildDecorations(view);
      this.decorations = result.decorations;
      this.currentWidget = result.widget;
    }

    update(update: ViewUpdate): void {
      // Skip re-entrant updates triggered by our own dispatch
      if (this.currentWidget?.isDispatching) return;

      if (update.docChanged) {
        const result = buildDecorations(update.view);
        this.decorations = result.decorations;
        this.currentWidget = result.widget;
      }
    }

    destroy(): void {
      this.currentWidget = null;
    }
  },
  {
    decorations: (v) => v.decorations,
  },
);

// ── Task 6.4: frontmatterExtension() factory ─────────────────────────

/**
 * Create a CM6 extension that replaces the frontmatter YAML region
 * with a visual editing panel. Add to the MdxEditor extensions array.
 */
export function frontmatterExtension(): Extension {
  return frontmatterPlugin;
}
