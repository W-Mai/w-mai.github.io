// Remark plugin: convert MDX JSX nodes to raw HTML nodes.
// remark-mdx parses JSX as mdxJsxFlowElement / mdxJsxTextElement,
// which remarkRehype ignores. This plugin serializes them back to
// raw HTML strings so rehype-raw can process them downstream.

import { visit } from 'unist-util-visit';
import type { Root } from 'mdast';

interface MdxJsxAttribute {
  type: string;
  name: string;
  value: string | { value: string } | null;
}

interface MdxJsxNode {
  type: string;
  name: string | null;
  attributes: MdxJsxAttribute[];
  children: any[];
}

function serializeAttributes(attrs: MdxJsxAttribute[]): string {
  return attrs
    .map((attr) => {
      if (attr.value === null) return attr.name;
      const val = typeof attr.value === 'string' ? attr.value : attr.value.value;
      return `${attr.name}="${val}"`;
    })
    .join(' ');
}

function serializeNode(node: MdxJsxNode): string {
  const tag = node.name;
  if (!tag) return '';

  const attrs = serializeAttributes(node.attributes);
  const open = attrs ? `<${tag} ${attrs}>` : `<${tag}>`;

  if (node.children.length === 0) {
    return `<${tag}${attrs ? ' ' + attrs : ''} />`;
  }

  const inner = node.children
    .map((child: any) => {
      if (child.type === 'mdxJsxFlowElement' || child.type === 'mdxJsxTextElement') {
        return serializeNode(child as MdxJsxNode);
      }
      if (child.type === 'text') return child.value;
      if (child.type === 'paragraph') {
        return child.children?.map((c: any) => c.value ?? '').join('') ?? '';
      }
      return '';
    })
    .join('');

  return `${open}${inner}</${tag}>`;
}

export default function remarkMdxToHtml() {
  return (tree: Root) => {
    visit(tree, (node: any, index, parent) => {
      if (
        index == null ||
        !parent ||
        (node.type !== 'mdxJsxFlowElement' && node.type !== 'mdxJsxTextElement')
      ) {
        return;
      }

      const html = serializeNode(node as MdxJsxNode);
      if (!html) return;

      (parent.children as any[])[index] = {
        type: 'html',
        value: html,
      };
    });
  };
}
