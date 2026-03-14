// Rehype plugin: convert Mermaid code blocks to PNG base64 images.
// Finds <pre><code class="language-mermaid"> elements, renders via
// beautiful-mermaid → SVG → resvg PNG, replaces with <img> tags.

import { visit } from 'unist-util-visit';
import type { Root, Element, Text } from 'hast';
import { renderMermaidSVG } from 'beautiful-mermaid';
import { svgToPngDataUri } from './svg-to-png.js';

/** Check if an element has a specific CSS class. */
function hasClass(node: Element, className: string): boolean {
  const cls = node.properties?.className;
  if (Array.isArray(cls)) return cls.some((c) => String(c) === className);
  if (typeof cls === 'string') return cls.split(/\s+/).includes(className);
  return false;
}

/** Recursively extract text content from a HAST node. */
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

/** Build a red-bordered error placeholder div for Mermaid failures. */
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

export default function rehypeMermaidPng() {
  return async (tree: Root) => {
    // Collect <pre> nodes whose child is <code class="language-mermaid">
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

    // Process in reverse order to preserve indices during replacement
    for (const task of tasks.reverse()) {
      const { node, index, parent } = task;

      try {
        // Extract Mermaid source from the code element
        const codeChild = node.children.find(
          (c): c is Element => c.type === 'element' && c.tagName === 'code',
        )!;
        const source = textContent(codeChild).trim();

        if (!source) {
          parent.children.splice(index, 1, errorPlaceholder('', 'Empty Mermaid code block'));
          continue;
        }

        // Render Mermaid → SVG via beautiful-mermaid
        let svg: string;
        try {
          svg = renderMermaidSVG(source);
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          parent.children.splice(index, 1, errorPlaceholder(source, msg));
          continue;
        }

        // Convert SVG → PNG base64
        let pngDataUri: string;
        try {
          pngDataUri = await svgToPngDataUri(svg, { scale: 2 });
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          parent.children.splice(
            index,
            1,
            errorPlaceholder(source, `PNG conversion failed: ${msg}`),
          );
          continue;
        }

        // Build replacement <img> element
        const firstLine = source.split('\n')[0].trim();
        const img: Element = {
          type: 'element',
          tagName: 'img',
          properties: {
            src: pngDataUri,
            alt: `Diagram: ${firstLine}`,
            className: ['diagram'],
            style: 'display: block; margin: 16px auto; max-width: 100%; height: auto;',
          },
          children: [],
        };

        parent.children.splice(index, 1, img);
      } catch {
        // Catch-all: keep original node, don't break pipeline
      }
    }
  };
}
