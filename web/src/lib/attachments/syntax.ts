import type { Nodes, Root } from 'mdast';
import type { Extension as MarkdownExtension } from 'mdast-util-from-markdown';
import type { Code, Construct, State, Tokenizer } from 'micromark-util-types';
import type {} from 'remark-parse';
import type { Processor } from 'unified';
import type { Position } from 'unist';
import type { VFile } from 'vfile';
import { attachmentReference, parseAttachmentReference } from './paths';

export type AttachmentDisplay = 'inline' | 'block';

export interface AttachmentToken {
  display: AttachmentDisplay;
  source: string;
  reference: string;
  position?: Position;
}

declare module 'mdast' {
  interface Data {
    attachmentDisplay?: AttachmentDisplay;
    attachmentToken?: AttachmentToken;
  }
}

declare module 'micromark-util-types' {
  interface TokenTypeMap {
    attachmentSyntax: 'attachmentSyntax';
  }
}

export class AttachmentSyntaxError extends Error {
  readonly reason: string;
  readonly line: number;
  readonly column: number;

  constructor(reason: string, readonly position?: Position) {
    super(reason);
    this.name = 'AttachmentSyntaxError';
    this.reason = reason;
    this.line = position?.start.line ?? 1;
    this.column = position?.start.column ?? 1;
  }
}

function syntax(reference: string, display: AttachmentDisplay): string {
  const id = parseAttachmentReference(reference);
  if (id === null) throw new AttachmentSyntaxError('Expected an attachment reference.');
  const marker = display === 'block' ? '::' : ':';
  return `${marker}attachment[${attachmentReference(id).slice('attachment:'.length)}]${marker}`;
}

/** Format a canonical reference, decoding and encoding its identifier exactly once. */
export function attachmentInlineSyntax(reference: string): string {
  return syntax(reference, 'inline');
}

export function attachmentBlockSyntax(reference: string): string {
  return syntax(reference, 'block');
}

const tokenizeAttachment: Tokenizer = function (effects, ok, nok) {
  let double = false;
  let index = 0;
  const prefix = 'attachment[';
  return start;

  function start(code: Code): State | undefined {
    effects.enter('attachmentSyntax');
    effects.consume(code);
    return opening;
  }

  function opening(code: Code): State | undefined {
    if (code === 58) {
      double = true;
      effects.consume(code);
      return name;
    }
    return name(code);
  }

  function name(code: Code): State | undefined {
    if (code !== prefix.charCodeAt(index)) return nok(code);
    effects.consume(code);
    index++;
    return index === prefix.length ? body : name;
  }

  function body(code: Code): State | undefined {
    if (code === 93) {
      effects.consume(code);
      return closing;
    }
    // Line endings and nested brackets are structural, and must be percent encoded.
    if (code === null || code === 91 || code === -5 || code === -4 || code === -3) return nok(code);
    effects.consume(code);
    return body;
  }

  function closing(code: Code): State | undefined {
    if (code !== 58) return nok(code);
    effects.consume(code);
    if (double) return secondClosing;
    effects.exit('attachmentSyntax');
    return ok;
  }

  function secondClosing(code: Code): State | undefined {
    if (code !== 58) return nok(code);
    effects.consume(code);
    effects.exit('attachmentSyntax');
    return ok;
  }
};

const attachmentConstruct: Construct = {
  name: 'attachmentSyntax',
  tokenize: tokenizeAttachment,
  previous(code) {
    // Do not retry inside a malformed colon run or an escaped block opener.
    return code !== 58 || this.events.at(-1)?.[1].type === 'attachmentSyntax';
  },
};

const markdownExtension: MarkdownExtension = {
  enter: {
    attachmentSyntax(token) {
      const source = this.sliceSerialize(token);
      const display: AttachmentDisplay = source.startsWith('::') ? 'block' : 'inline';
      const width = display === 'block' ? 2 : 1;
      const reference = `attachment:${source.slice(width + 'attachment['.length, -width - 1)}`;
      this.enter({
        type: 'link',
        url: reference,
        children: [{ type: 'text', value: source }],
        data: { attachmentToken: { display, source, reference } },
      }, token);
    },
  },
  exit: {
    attachmentSyntax(token) { this.exit(token); },
  },
};

/**
 * Register before parsing; normalization can then be called from any renderer.
 * Tokenization precedes Markdown references and formatting, preserving literal IDs.
 */
export function remarkAttachmentSyntax(this: Processor): void {
  const data = this.data();
  (data.micromarkExtensions ??= []).push({ text: { 58: attachmentConstruct } });
  (data.fromMarkdownExtensions ??= []).push(markdownExtension);
}

const protectedTypes = new Set([
  'link', 'linkReference', 'image', 'imageReference', 'code', 'inlineCode',
  'mdxJsxTextElement', 'mdxJsxFlowElement', 'mdxjsEsm', 'mdxTextExpression', 'mdxFlowExpression',
]);
const voidElements = new Set([
  'area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'param',
  'source', 'track', 'wbr',
]);

function updateHtmlStack(value: string, stack: string[]): void {
  // Quotes and comments are consumed atomically, so their angle brackets are not tags.
  const tags = /<!--[\s\S]*?-->|<![^>]*>|<\?[\s\S]*?\?>|<(\/?)([A-Za-z][A-Za-z\d:-]*)(?=[\s/>])(?:[^"'<>]|"[^"]*"|'[^']*')*>/g;
  for (const match of value.matchAll(tags)) {
    if (!match[2]) continue;
    const name = match[2].toLowerCase();
    if (match[1]) {
      const index = stack.lastIndexOf(name);
      if (index !== -1) stack.splice(index);
    } else if (!voidElements.has(name) && !/\/\s*>$/.test(match[0])) {
      stack.push(name);
    }
  }
}

function literal(node: Nodes): import('mdast').Text {
  const { attachmentToken: _token, ...data } = node.data ?? {};
  return { type: 'text', value: node.data?.attachmentToken?.source ?? '', position: node.position, ...(Object.keys(data).length ? { data } : {}) };
}

/**
 * Convert parsed attachment tokens to ordinary links with attachmentDisplay data.
 * Existing links, code and HTML remain opaque. Calling this repeatedly is safe.
 */
export function normalizeAttachmentSyntax(tree: Root, file?: VFile): void {
  const htmlStack: string[] = [];

  function walk(parent: Nodes, protectedParent = false, parentIsRoot = false): void {
    if (!('children' in parent)) return;
    const protectedContainer = protectedParent || protectedTypes.has(parent.type);
    for (let index = 0; index < parent.children.length; index++) {
      const node = parent.children[index];
      if (node.type === 'html') {
        if (!protectedContainer) updateHtmlStack(node.value, htmlStack);
        continue;
      }
      const token = node.type === 'link' && !node.data?.attachmentDisplay ? node.data?.attachmentToken : undefined;
      if (token) {
        const standalone = parentIsRoot && parent.type === 'paragraph' && parent.children.every((sibling) =>
          sibling === node || (sibling.type === 'text' && !sibling.value.trim()),
        );
        if (protectedContainer || htmlStack.length || (token.display === 'block' && !standalone)) {
          parent.children[index] = literal(node);
          continue;
        }
        let id: string;
        try {
          const decoded = parseAttachmentReference(token.reference);
          if (decoded === null) throw new Error('Expected an attachment reference.');
          id = decoded;
        } catch (error) {
          const reason = `Invalid attachment syntax: ${error instanceof Error ? error.message : 'invalid identifier'}`;
          if (file) file.fail(reason, node.position, 'attachment-syntax:invalid-id');
          throw new AttachmentSyntaxError(reason, node.position);
        }
        const reference = attachmentReference(id);
        parent.children[index] = {
          type: 'link',
          url: reference,
          children: [{ type: 'text', value: id.split('/').at(-1)! }],
          position: node.position,
          data: {
            attachmentDisplay: token.display,
            attachmentToken: { ...token, reference, position: node.position },
          },
        };
        continue;
      }
      walk(node, protectedContainer, parent.type === 'root');
    }
  }
  walk(tree);
}

/** Read the same normalized nodes used by rendering and reference protection. */
export function attachmentTokens(tree: Root): AttachmentToken[] {
  const tokens: AttachmentToken[] = [];
  function walk(node: Nodes): void {
    if (node.type === 'link' && node.data?.attachmentDisplay && node.data.attachmentToken) {
      tokens.push(node.data.attachmentToken);
    } else if ('children' in node) {
      for (const child of node.children) walk(child);
    }
  }
  walk(tree);
  return tokens;
}
