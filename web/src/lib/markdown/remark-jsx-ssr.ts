// Remark plugin: SSR-render MDX JSX components into static HTML at export time.
//
// Used by the WeChat export pipeline. Finds `<ComponentName .../>` nodes whose
// tag name starts with an uppercase letter (React-component convention), looks
// up the component source file under the post directory, dynamic-imports it,
// renders via React's renderToStaticMarkup with default state, and replaces the
// node with a raw HTML node containing the rendered <svg>/<div> markup.
//
// Props parsing:
//   - `foo="bar"`     → string "bar"
//   - `count={42}`    → number 42 (eval'd)
//   - `data={[...]}`  → whatever the expression evaluates to
//   - `flag`          → boolean true
//
// Caveats:
//   - Expressions are eval'd via `new Function`. Safe here because the input is
//     blog posts authored by the blog owner, not untrusted user content.
//   - If the component is interactive (useState/onClick), it renders its
//     default/initial state only. That's by design for WeChat export.

import { visit } from 'unist-util-visit';
import type { Root } from 'mdast';
import { createRequire } from 'node:module';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

interface Options {
  /** Absolute path to the post directory (the one containing index.mdx). */
  postDir: string;
}

type AttrValue = string | { type: 'mdxJsxAttributeValueExpression'; value: string } | null;

interface MdxJsxAttribute {
  type: 'mdxJsxAttribute' | 'mdxJsxExpressionAttribute';
  name: string;
  value: AttrValue;
}

interface MdxJsxNode {
  type: 'mdxJsxFlowElement' | 'mdxJsxTextElement';
  name: string | null;
  attributes: MdxJsxAttribute[];
  children: unknown[];
}

/** Evaluate a JS expression string into a real value (numbers, arrays, objects, booleans). */
function evalExpression(expr: string): unknown {
  // `return ( ... )` wrapping lets an object literal be treated as an expression,
  // not a block statement. Safe only for trusted authors (blog owner).
  // eslint-disable-next-line no-new-func
  return new Function(`"use strict"; return (${expr});`)();
}

/** Convert an MDX JSX attribute to a React prop value. */
function attrToPropValue(attr: MdxJsxAttribute): unknown {
  if (attr.value === null) return true; // `flag` form
  if (typeof attr.value === 'string') return attr.value;
  if (attr.value && attr.value.type === 'mdxJsxAttributeValueExpression') {
    try {
      return evalExpression(attr.value.value);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      throw new Error(`Failed to evaluate prop "${attr.name}": ${msg}`);
    }
  }
  return undefined;
}

function attrsToProps(attrs: MdxJsxAttribute[]): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const attr of attrs) {
    if (attr.type !== 'mdxJsxAttribute') continue; // skip spread, etc.
    out[attr.name] = attrToPropValue(attr);
  }
  // Astro-specific directives like `client:load` are dev-only hydration hints;
  // they mean nothing at SSR time and React will warn on unknown DOM props, so drop them.
  for (const key of Object.keys(out)) {
    if (key.includes(':')) delete out[key];
  }
  return out;
}

/** Cache: component name → loaded React component, keyed by postDir+name. */
const componentCache = new Map<string, unknown>();

async function loadComponent(postDir: string, name: string): Promise<unknown> {
  const cacheKey = `${postDir}::${name}`;
  if (componentCache.has(cacheKey)) return componentCache.get(cacheKey);

  // Try common file extensions in order.
  const exts = ['.tsx', '.jsx', '.ts', '.js'];
  for (const ext of exts) {
    const candidate = path.join(postDir, `${name}${ext}`);
    try {
      const require = createRequire(pathToFileURL(postDir + '/').href);
      require.resolve(candidate); // throws if missing
      const mod = await import(pathToFileURL(candidate).href);
      const Component = mod.default ?? mod[name];
      if (Component) {
        componentCache.set(cacheKey, Component);
        return Component;
      }
    } catch {
      // Try next extension
    }
  }
  return null;
}

/**
 * remark plugin factory. Must run BEFORE remarkMdxToHtml so we get first crack
 * at mdxJsxFlowElement nodes with intact expression ASTs.
 */
export default function remarkJsxSsr({ postDir }: Options) {
  return async (tree: Root) => {
    // First pass: collect JSX nodes to render. We can't render async inside `visit`,
    // so gather them, then process, then mutate.
    const targets: Array<{ node: MdxJsxNode; parent: any; index: number }> = [];

    visit(tree, (node: any, index, parent) => {
      if (index == null || !parent) return;
      if (node.type !== 'mdxJsxFlowElement' && node.type !== 'mdxJsxTextElement') return;
      const jsx = node as MdxJsxNode;
      if (!jsx.name) return;
      // Only SSR custom components (capitalized). Lowercase stays as raw HTML.
      const first = jsx.name[0];
      if (first !== first.toUpperCase() || first === first.toLowerCase()) return;
      targets.push({ node: jsx, parent, index });
    });

    for (const { node, parent, index } of targets) {
      const name = node.name as string;
      try {
        const Component = await loadComponent(postDir, name);
        if (!Component) {
          // No matching file under postDir; leave a visible marker instead of silent-drop.
          parent.children[index] = {
            type: 'html',
            value: `<!-- component not found: ${name} -->`,
          };
          continue;
        }

        const props = attrsToProps(node.attributes);
        const element = React.createElement(Component as any, props);
        const html = renderToStaticMarkup(element);

        parent.children[index] = { type: 'html', value: html };
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        parent.children[index] = {
          type: 'html',
          value: `<!-- SSR failed for ${name}: ${msg.replace(/-->/g, '-- >')} -->`,
        };
      }
    }
  };
}
