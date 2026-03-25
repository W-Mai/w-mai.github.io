// Rehype plugin: syntax-highlight code blocks using shiki.
// Finds <pre><code class="language-xxx"> elements, highlights via shiki,
// and inlines the colored spans. The outer <pre> retains data-wechat-tag="code-block"
// for template styling; inner tokens get inline color styles.

import { visit } from 'unist-util-visit';
import type { Root, Element, Text } from 'hast';
import { createHighlighter, type Highlighter } from 'shiki';

let highlighterPromise: Promise<Highlighter> | null = null;

const COMMON_LANGS = [
  'javascript', 'typescript', 'python', 'rust', 'go', 'c', 'cpp',
  'java', 'bash', 'shell', 'json', 'yaml', 'toml', 'html', 'css',
  'sql', 'markdown', 'jsx', 'tsx', 'swift', 'kotlin', 'ruby', 'php',
  'lua', 'r', 'diff', 'graphql', 'xml', 'plaintext',
];

function getHighlighter(): Promise<Highlighter> {
  if (!highlighterPromise) {
    highlighterPromise = createHighlighter({
      themes: ['github-dark'],
      langs: COMMON_LANGS,
    });
  }
  return highlighterPromise;
}

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

function extractLang(codeNode: Element): string | null {
  const cls = codeNode.properties?.className;
  if (!Array.isArray(cls)) return null;
  for (const c of cls) {
    const s = String(c);
    if (s.startsWith('language-')) return s.slice(9);
  }
  return null;
}

export default function rehypeCodeHighlight() {
  return async (tree: Root) => {
    const tasks: Array<{
      preNode: Element;
      codeNode: Element;
      lang: string;
      source: string;
    }> = [];

    visit(tree, 'element', (node: Element) => {
      if (node.tagName !== 'pre') return;

      const codeChild = node.children.find(
        (c): c is Element => c.type === 'element' && c.tagName === 'code',
      );
      if (!codeChild) return;

      const lang = extractLang(codeChild);
      if (!lang || lang === 'mermaid') return;

      const source = textContent(codeChild);
      if (!source.trim()) return;

      tasks.push({ preNode: node, codeNode: codeChild, lang, source });
    });

    if (tasks.length === 0) return;

    const highlighter = await getHighlighter();
    const loadedLangs = highlighter.getLoadedLanguages();

    for (const { preNode, codeNode, lang, source } of tasks) {
      try {
        const resolvedLang = loadedLangs.includes(lang) ? lang : 'plaintext';

        const highlighted = highlighter.codeToHast(source, {
          lang: resolvedLang,
          theme: 'github-dark',
        });

        // Extract the <pre><code> children from shiki output
        const shikiPre = highlighted.children.find(
          (c): c is Element => c.type === 'element' && c.tagName === 'pre',
        );
        if (!shikiPre) continue;

        const shikiCode = shikiPre.children.find(
          (c): c is Element => c.type === 'element' && c.tagName === 'code',
        );
        if (!shikiCode) continue;

        // Replace code node children with highlighted tokens
        codeNode.children = shikiCode.children;
        codeNode.properties = { ...codeNode.properties, ...shikiCode.properties };

        // Copy shiki's background/color to pre node for template override
        const preStyle = shikiPre.properties?.style;
        if (typeof preStyle === 'string') {
          preNode.properties ??= {};
          preNode.properties['dataShikiStyle'] = preStyle;
        }
      } catch {
        // Highlight failed — keep original plain text
      }
    }
  };
}
