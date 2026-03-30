// Rehype plugin: convert Mermaid code blocks to inline SVG.
// Finds <pre><code class="language-mermaid"> elements, renders via
// beautiful-mermaid → SVG, replaces with inline SVG (no PNG needed).

import { visit } from 'unist-util-visit';
import type { Root, Element, Text } from 'hast';
import { renderMermaidSVG } from 'beautiful-mermaid';

function hasClass(node: Element, className: string): boolean {
  const cls = node.properties?.className;
  if (Array.isArray(cls)) return cls.some((c) => String(c) === className);
  if (typeof cls === 'string') return cls.split(/\s+/).includes(className);
  return false;
}

function textContent(node: Element | Text): string {
  if (node.type === 'text') return node.value;
  if ('children' in node) {
    return node.children
      .filter((c): c is Element | Text => c.type === 'text' || c.type === 'element')
      .map(textContent)
      .join('');
  }
  return '';
}

function errorPlaceholder(source: string, error: string): Element {
  return {
    type: 'element',
    tagName: 'div',
    properties: {
      style:
        'border: 2px solid #dc2626; background: #fef2f2; padding: 12px; border-radius: 6px; font-family: monospace; font-size: 13px; white-space: pre-wrap; margin: 16px 0;',
    },
    children: [{ type: 'text', value: `⚠ Mermaid Error: ${error}\n\n${source}` }],
  };
}

/** Parse hex color to [r, g, b] */
function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  const n = parseInt(h.length === 3 ? h.split('').map(c => c + c).join('') : h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** Mix fg into bg at given percentage, return hex */
function mix(fg: string, bg: string, pct: number): string {
  const [fr, fg2, fb] = hexToRgb(fg);
  const [br, bg2, bb] = hexToRgb(bg);
  const p = pct / 100;
  const r = Math.round(fr * p + br * (1 - p));
  const g = Math.round(fg2 * p + bg2 * (1 - p));
  const b = Math.round(fb * p + bb * (1 - p));
  return `#${((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1)}`;
}

/** Replace CSS variables and color-mix() in SVG with hardcoded colors */
function inlineMermaidColors(svg: string, bg: string, fg: string): string {
  // Pre-compute all derived colors matching beautiful-mermaid's MIX percentages
  const resolved: Record<string, string> = {
    '--bg': bg,
    '--fg': fg,
    '--_text': fg,
    '--_text-sec': mix(fg, bg, 60),
    '--_text-muted': mix(fg, bg, 40),
    '--_text-faint': mix(fg, bg, 25),
    '--_line': mix(fg, bg, 50),
    '--_arrow': mix(fg, bg, 85),
    '--_node-fill': mix(fg, bg, 3),
    '--_node-stroke': mix(fg, bg, 20),
    '--_group-fill': bg,
    '--_group-hdr': mix(fg, bg, 5),
    '--_inner-stroke': mix(fg, bg, 12),
    '--_key-badge': mix(fg, bg, 10),
  };

  // Replace var(--xxx) references with resolved values
  let result = svg;
  for (const [varName, value] of Object.entries(resolved)) {
    result = result.replaceAll(`var(${varName})`, value);
  }
  // Remove any remaining color-mix() that might not have been caught
  result = result.replace(/color-mix\(in srgb,\s*[^)]+\)/g, fg);
  // Remove the now-unnecessary style variable declarations
  result = result.replace(/<style[^>]*>[\s\S]*?<\/style>/, (styleBlock) => {
    return styleBlock
      .replace(/--_[\w-]+:\s*[^;]+;/g, '')
      .replace(/--bg:\s*[^;]+;/g, '')
      .replace(/--fg:\s*[^;]+;/g, '');
  });
  return result;
}

export interface RehypeMermaidSvgOptions {
  /** Options passed to beautiful-mermaid renderMermaidSVG */
  mermaidOptions?: Record<string, unknown>;
}

export default function rehypeMermaidSvg(options?: RehypeMermaidSvgOptions) {
  const mermaidOpts = options?.mermaidOptions ?? {};
  return async (tree: Root) => {
    const tasks: Array<{
      node: Element;
      index: number;
      parent: Element | Root;
    }> = [];

    visit(tree, 'element', (node: Element, index, parent) => {
      if (index == null || !parent) return;
      if (node.tagName !== 'pre') return;

      const codeChild = node.children.find(
        (c): c is Element =>
          c.type === 'element' &&
          c.tagName === 'code' &&
          hasClass(c, 'language-mermaid'),
      );
      if (codeChild) {
        tasks.push({ node, index, parent: parent as Element | Root });
      }
    });

    for (const task of tasks.reverse()) {
      const { node, index, parent } = task;

      try {
        const codeChild = node.children.find(
          (c): c is Element => c.type === 'element' && c.tagName === 'code',
        )!;
        const source = textContent(codeChild).trim();

        if (!source) {
          parent.children.splice(index, 1, errorPlaceholder('', 'Empty Mermaid code block'));
          continue;
        }

        let svg: string;
        try {
          svg = renderMermaidSVG(source, mermaidOpts);
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          parent.children.splice(index, 1, errorPlaceholder(source, msg));
          continue;
        }

        // Inject --bg/--fg CSS variables into SVG so colors resolve in any context.
        // Also inline all CSS variable references for environments without color-mix() support (e.g. WeChat).
        if (mermaidOpts.bg || mermaidOpts.fg) {
          const bg = (mermaidOpts.bg as string) || '#ffffff';
          const fg = (mermaidOpts.fg as string) || '#27272a';
          svg = inlineMermaidColors(svg, bg, fg);
        }

        // Wrap SVG in a section with diagram class
        const wrapper: Element = {
          type: 'element',
          tagName: 'section',
          properties: {
            className: ['diagram'],
          },
          children: [{ type: 'raw', value: svg } as any],
        };

        parent.children.splice(index, 1, wrapper);
      } catch {
        // Catch-all: keep original node
      }
    }
  };
}
