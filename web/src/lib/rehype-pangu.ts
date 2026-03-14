// Rehype plugin: insert spaces between CJK and half-width characters in text nodes.
// Uses pangu.js to process text nodes while preserving code blocks and other special elements.

import { visit } from 'unist-util-visit';
import type { Root, Element, Text } from 'hast';
import pangu from 'pangu';

// Tags whose text content should not be processed
const SKIP_TAGS = new Set(['pre', 'code', 'script', 'style']);

export default function rehypePangu() {
  return (tree: Root) => {
    visit(tree, 'text', (node: Text, _index, parent) => {
      // Skip text inside pre/code/script/style
      if (parent?.type === 'element') {
        const el = parent as Element;
        if (SKIP_TAGS.has(el.tagName)) return;
      }

      // Apply pangu spacing with error resilience
      try {
        node.value = pangu.spacingText(node.value);
      } catch {
        // Preserve original text on error
      }
    });
  };
}
