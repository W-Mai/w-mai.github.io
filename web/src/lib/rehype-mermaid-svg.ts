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

export default function rehypeMermaidSvg() {
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
          svg = renderMermaidSVG(source);
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          parent.children.splice(index, 1, errorPlaceholder(source, msg));
          continue;
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
