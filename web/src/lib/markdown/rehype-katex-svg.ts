// Rehype plugin: convert KaTeX HTML output to inline SVG.
// Runs after rehypeKatex in the pipeline. Finds .katex / .katex-display spans,
// extracts TeX source from MathML annotation, renders via mathjax-full → SVG.
// Outputs inline SVG directly (no PNG conversion needed — WeChat supports SVG).

import { visit } from 'unist-util-visit';
import type { Root, Element, Text, Comment } from 'hast';
import { mathjax } from 'mathjax-full/js/mathjax.js';
import { TeX } from 'mathjax-full/js/input/tex.js';
import { SVG } from 'mathjax-full/js/output/svg.js';
import { liteAdaptor } from 'mathjax-full/js/adaptors/liteAdaptor.js';
import { RegisterHTMLHandler } from 'mathjax-full/js/handlers/html.js';
import { AllPackages } from 'mathjax-full/js/input/tex/AllPackages.js';

const adaptor = liteAdaptor();
RegisterHTMLHandler(adaptor);

const texInput = new TeX({ packages: AllPackages });
const svgOutput = new SVG({ fontCache: 'none' });
const mjDocument = mathjax.document('', { InputJax: texInput, OutputJax: svgOutput });

/** Render TeX string to self-contained SVG string via MathJax. */
function texToSvg(tex: string, display: boolean): string {
  const node = mjDocument.convert(tex, { display });
  const html = adaptor.outerHTML(node);
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

function hasClass(node: Element, className: string): boolean {
  const cls = node.properties?.className;
  if (Array.isArray(cls)) return cls.some((c) => String(c) === className);
  if (typeof cls === 'string') return cls.split(/\s+/).includes(className);
  return false;
}

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

function warningComment(message: string): Comment {
  return { type: 'comment', value: ` katex-svg: ${message} ` };
}

export default function rehypeKatexSvg() {
  return async (tree: Root) => {
    const tasks: Array<{
      node: Element;
      index: number;
      parent: Element | Root;
      isBlock: boolean;
    }> = [];

    visit(tree, 'element', (node: Element, index, parent) => {
      if (index == null || !parent) return;

      if (hasClass(node, 'katex-error')) {
        tasks.push({ node, index, parent: parent as Element | Root, isBlock: false });
        return;
      }

      if (node.tagName === 'span' && hasClass(node, 'katex-display')) {
        tasks.push({ node, index, parent: parent as Element | Root, isBlock: true });
        return;
      }

      if (node.tagName === 'span' && hasClass(node, 'katex')) {
        const parentEl = parent as Element;
        if (parentEl.type === 'element' && hasClass(parentEl, 'katex-display')) return;
        tasks.push({ node, index, parent: parent as Element | Root, isBlock: false });
      }
    });

    for (const task of tasks.reverse()) {
      const { node, index, parent, isBlock } = task;

      try {
        if (hasClass(node, 'katex-error')) {
          const tex = (node.properties?.title as string) ?? '';
          const errorMsg = node.children
            .filter((c): c is Text => c.type === 'text')
            .map((c) => c.value)
            .join('');
          parent.children.splice(index, 1, errorPlaceholder(tex, errorMsg));
          continue;
        }

        const tex = findTexAnnotation(node);
        if (tex === null) {
          parent.children.splice(index + 1, 0, warningComment('MathML extraction failed'));
          continue;
        }

        let svg: string;
        try {
          svg = texToSvg(tex, isBlock);
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          parent.children.splice(index + 1, 0, warningComment(`MathJax render failed: ${msg}`));
          continue;
        }

        // Wrap SVG in a container element with appropriate class
        const wrapper: Element = {
          type: 'element',
          tagName: isBlock ? 'section' : 'span',
          properties: {
            className: [isBlock ? 'formula-block' : 'formula-inline'],
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
