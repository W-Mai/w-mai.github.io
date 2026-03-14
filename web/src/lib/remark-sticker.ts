import type { Root, PhrasingContent, Paragraph } from 'mdast';
import { visit } from 'unist-util-visit';

/**
 * Remark plugin: transform sticker syntax into <img> elements.
 *
 * Inline:  :sticker[name]:  → inline image (1.5em height, vertical-align middle)
 * Block:   ::sticker[name]:: → block image (centered, max 200px)
 *
 * Sticker files are resolved from /stickers/<name> at runtime.
 */

const BLOCK_RE = /^::sticker\[([^\]]+)\]::$/;
const INLINE_RE = /:sticker\[([^\]]+)\]:/g;

export default function remarkSticker() {
  return (tree: Root) => {
    visit(tree, 'paragraph', (node: Paragraph, index, parent) => {
      if (!parent || index == null) return;

      // Check for block sticker: paragraph with single text child matching block pattern
      if (node.children.length === 1 && node.children[0].type === 'text') {
        const match = node.children[0].value.match(BLOCK_RE);
        if (match) {
          const name = match[1];
          (parent.children as any[])[index] = {
            type: 'html',
            value: `<div class="sticker-block"><img src="/stickers/${encodeURIComponent(name)}" alt="${name}" loading="lazy" /></div>`,
          };
          return;
        }
      }

      // Check for inline stickers within text nodes
      const newChildren: PhrasingContent[] = [];
      let changed = false;

      for (const child of node.children) {
        if (child.type !== 'text') {
          newChildren.push(child);
          continue;
        }

        const text = child.value;
        let lastIndex = 0;
        let m: RegExpExecArray | null;
        let childChanged = false;
        INLINE_RE.lastIndex = 0;

        while ((m = INLINE_RE.exec(text)) !== null) {
          changed = true;
          childChanged = true;
          if (m.index > lastIndex) {
            newChildren.push({ type: 'text', value: text.slice(lastIndex, m.index) });
          }
          const name = m[1];
          newChildren.push({
            type: 'html',
            value: `<img class="sticker-inline" src="/stickers/${encodeURIComponent(name)}" alt="${name}" loading="lazy" />`,
          } as any);
          lastIndex = INLINE_RE.lastIndex;
        }

        if (childChanged && lastIndex < text.length) {
          newChildren.push({ type: 'text', value: text.slice(lastIndex) });
        }
        if (!childChanged) {
          newChildren.push(child);
        }
      }

      if (changed) {
        node.children = newChildren;
      }
    });
  };
}
