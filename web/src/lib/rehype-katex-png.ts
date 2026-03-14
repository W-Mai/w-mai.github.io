// Rehype plugin: convert KaTeX HTML output to PNG base64 images.
// Runs after rehypeKatex in the pipeline. Finds .katex / .katex-display spans,
// extracts TeX source from MathML annotation, renders via mathjax-full → SVG → PNG.

import { visit } from 'unist-util-visit';
import type { Root, Element, Text, Comment } from 'hast';
import { mathjax } from 'mathjax-full/js/mathjax.js';
import { TeX } from 'mathjax-full/js/input/tex.js';
import { SVG } from 'mathjax-full/js/output/svg.js';
import { liteAdaptor } from 'mathjax-full/js/adaptors/liteAdaptor.js';
import { RegisterHTMLHandler } from 'mathjax-full/js/handlers/html.js';
import { AllPackages } from 'mathjax-full/js/input/tex/AllPackages.js';
import { svgToPngDataUri } from './svg-to-png.js';

// Initialize MathJax once (singleton)
const adaptor = liteAdaptor();
RegisterHTMLHandler(adaptor);

const texInput = new TeX({ packages: AllPackages });
const svgOutput = new SVG({ fontCache: 'none' });
const mjDocument = mathjax.document('', { InputJax: texInput, OutputJax: svgOutput });

/** Render TeX string to self-contained SVG via MathJax. */
function texToSvg(tex: string, display: boolean): string {
  const node = mjDocument.convert(tex, { display });
  const html = adaptor.outerHTML(node);
  // MathJax wraps SVG in <mjx-container>, extract the <svg> element
  const svgMatch = html.match(/<svg[\s\S]*<\/svg>/);
  if (!svgMatch) throw new Error('MathJax output does not contain an SVG element');
  return svgMatch[0];
}

/** Recursively find annotation element with encoding="application/x-tex". */
function findTexAnnotation(node: Element): string | null {
  if (
    node.tagName === 'annotation' &&
    node.properties?.encoding === 'application/x-tex'
  ) {
    const text = node.children.find((c): c is Text => c.type === 'text');
    return text?.value ?? null;
  }
  for (const child of node.children) {
    if (child.type === 'element') {
      const result = findTexAnnotation(child);
      if (result !== null) return result;
    }
  }
  return null;
}

/** Check if an element has a specific CSS class. */
function hasClass(node: Element, className: string): boolean {
  const cls = node.properties?.className;
  if (Array.isArray(cls)) return cls.some((c) => String(c) === className);
  if (typeof cls === 'string') return cls.split(/\s+/).includes(className);
  return false;
}

/** Build an error placeholder span for KaTeX parse errors. */
function errorPlaceholder(tex: string, error: string): Element {
  return {
    type: 'element',
    tagName: 'span',
    properties: {
      style:
        'color: #dc2626; background: #fef2f2; padding: 2px 6px; border-radius: 3px; font-family: monospace; font-size: 90%;',
    },
    children: [{ type: 'text', value: `⚠ LaTeX Error: ${error} | Source: ${tex}` }],
  };
}

/** Build an HTML comment warning node. */
function warningComment(message: string): Comment {
  return { type: 'comment', value: ` katex-png: ${message} ` };
}

export default function rehypeKatexPng() {
  return async (tree: Root) => {
    // Collect nodes to process (visit is sync, replacements need async)
    const tasks: Array<{
      node: Element;
      index: number;
      parent: Element | Root;
      isBlock: boolean;
    }> = [];

    visit(tree, 'element', (node: Element, index, parent) => {
      if (index == null || !parent) return;

      // KaTeX error elements — collect for error placeholder generation
      if (hasClass(node, 'katex-error')) {
        tasks.push({ node, index, parent: parent as Element | Root, isBlock: false });
        return;
      }

      // Block formula: span.katex-display wraps span.katex
      if (node.tagName === 'span' && hasClass(node, 'katex-display')) {
        tasks.push({ node, index, parent: parent as Element | Root, isBlock: true });
        return;
      }

      // Inline formula: span.katex (but not inside katex-display, which is handled above)
      if (node.tagName === 'span' && hasClass(node, 'katex')) {
        // Skip if parent is katex-display (already collected as block)
        const parentEl = parent as Element;
        if (parentEl.type === 'element' && hasClass(parentEl, 'katex-display')) return;
        tasks.push({ node, index, parent: parent as Element | Root, isBlock: false });
      }
    });

    // Process collected nodes (reverse order to preserve indices)
    for (const task of tasks.reverse()) {
      const { node, index, parent, isBlock } = task;

      try {
        // Handle KaTeX error elements
        if (hasClass(node, 'katex-error')) {
          const tex = (node.properties?.title as string) ?? '';
          const errorMsg = node.children
            .filter((c): c is Text => c.type === 'text')
            .map((c) => c.value)
            .join('');
          const placeholder = errorPlaceholder(tex, errorMsg);
          parent.children.splice(index, 1, placeholder);
          continue;
        }

        // Extract TeX source from MathML annotation
        const tex = findTexAnnotation(node);
        if (tex === null) {
          // MathML extraction failed — keep original, add warning comment
          parent.children.splice(index + 1, 0, warningComment('MathML extraction failed'));
          continue;
        }

        // Render TeX → SVG via MathJax
        let svg: string;
        try {
          svg = texToSvg(tex, isBlock);
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          parent.children.splice(index + 1, 0, warningComment(`MathJax render failed: ${msg}`));
          continue;
        }

        // Convert SVG → PNG base64
        let pngDataUri: string;
        try {
          pngDataUri = await svgToPngDataUri(svg, { scale: 2 });
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          parent.children.splice(index + 1, 0, warningComment(`PNG conversion failed: ${msg}`));
          continue;
        }

        // Build replacement <img> element
        const img: Element = {
          type: 'element',
          tagName: 'img',
          properties: {
            src: pngDataUri,
            alt: `LaTeX: ${tex}`,
            className: [isBlock ? 'formula-block' : 'formula-inline'],
            style: isBlock
              ? 'display: block; margin: 16px auto; max-width: 100%;'
              : 'vertical-align: middle; height: 1.2em;',
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
