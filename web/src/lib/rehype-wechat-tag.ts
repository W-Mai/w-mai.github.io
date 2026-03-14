// Rehype plugin: add data-wechat-tag attribute to HTML elements for template application.
// Maps standard HTML elements and sticker classes to semantic tag names
// that the client-side applyTemplate() function uses to apply inline styles.

import { visit } from 'unist-util-visit';
import type { Root, Element } from 'hast';

// Direct tag name → data-wechat-tag mapping
const TAG_MAP: Record<string, string> = {
  h1: 'h1',
  h2: 'h2',
  h3: 'h3',
  h4: 'h4',
  h5: 'h5',
  h6: 'h6',
  p: 'p',
  strong: 'strong',
  em: 'em',
  del: 'del',
  a: 'a',
  ul: 'ul',
  ol: 'ol',
  li: 'li',
  blockquote: 'blockquote',
  hr: 'hr',
};

function hasClass(node: Element, className: string): boolean {
  const cls = node.properties?.className;
  if (Array.isArray(cls)) return cls.some((c) => String(c).includes(className));
  if (typeof cls === 'string') return cls.includes(className);
  return false;
}

function isPreWithCode(node: Element): boolean {
  if (node.tagName !== 'pre') return false;
  return node.children.some(
    (child) => child.type === 'element' && child.tagName === 'code',
  );
}

function isInsidePre(ancestors: Element[]): boolean {
  return ancestors.some((a) => a.tagName === 'pre');
}

export default function rehypeWechatTag() {
  return (tree: Root) => {
    visit(tree, 'element', (node: Element, _index, parent) => {
      // pre containing code → code-block
      if (isPreWithCode(node)) {
        node.properties ??= {};
        node.properties['dataWechatTag'] = 'code-block';
        return;
      }

      // code not inside pre → inline-code
      if (node.tagName === 'code') {
        const parentEl = parent as Element | undefined;
        if (parentEl?.type === 'element' && parentEl.tagName === 'pre') return;
        node.properties ??= {};
        node.properties['dataWechatTag'] = 'inline-code';
        return;
      }

      // img with sticker-inline class
      if (node.tagName === 'img' && hasClass(node, 'sticker-inline')) {
        node.properties ??= {};
        node.properties['dataWechatTag'] = 'sticker-inline';
        return;
      }

      // div with sticker-block class (block sticker wrapper)
      if (node.tagName === 'div' && hasClass(node, 'sticker-block')) {
        node.properties ??= {};
        node.properties['dataWechatTag'] = 'sticker-block';
        return;
      }

      // img with sticker-block class (fallback if class is on img directly)
      if (node.tagName === 'img' && hasClass(node, 'sticker-block')) {
        node.properties ??= {};
        node.properties['dataWechatTag'] = 'sticker-block';
        return;
      }

      // img with formula-inline class → formula-inline tag
      if (node.tagName === 'img' && hasClass(node, 'formula-inline')) {
        node.properties ??= {};
        node.properties['dataWechatTag'] = 'formula-inline';
        return;
      }

      // img with formula-block class → formula-block tag
      if (node.tagName === 'img' && hasClass(node, 'formula-block')) {
        node.properties ??= {};
        node.properties['dataWechatTag'] = 'formula-block';
        return;
      }

      // img with diagram class → diagram tag
      if (node.tagName === 'img' && hasClass(node, 'diagram')) {
        node.properties ??= {};
        node.properties['dataWechatTag'] = 'diagram';
        return;
      }

      // Regular img (not sticker, not formula, not diagram) → image
      if (node.tagName === 'img') {
        node.properties ??= {};
        node.properties['dataWechatTag'] = 'image';
        return;
      }

      // Direct tag mapping
      const tag = TAG_MAP[node.tagName];
      if (tag) {
        node.properties ??= {};
        node.properties['dataWechatTag'] = tag;
      }
    });
  };
}
