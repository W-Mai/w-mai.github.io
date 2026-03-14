import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { unified } from 'unified';
import rehypeParse from 'rehype-parse';
import rehypeStringify from 'rehype-stringify';
import type { Root, Element, Text, ElementContent } from 'hast';
import pangu from 'pangu';
import rehypePangu from '../rehype-pangu';

// --- CJK detection helpers ---

const CJK_RANGE = /[\u2E80-\u2EFF\u2F00-\u2FDF\u3040-\u309F\u30A0-\u30FF\u3100-\u312F\u3200-\u32FF\u3400-\u4DBF\u4E00-\u9FFF\uF900-\uFAFF]/;
const HALF_WIDTH = /[A-Za-z0-9]/;

function hasCjkHalfWidthBoundaryWithoutSpace(text: string): boolean {
  for (let i = 0; i < text.length - 1; i++) {
    const curr = text[i];
    const next = text[i + 1];
    if (CJK_RANGE.test(curr) && HALF_WIDTH.test(next)) return true;
    if (HALF_WIDTH.test(curr) && CJK_RANGE.test(next)) return true;
  }
  return false;
}

// --- Generators ---

const CJK_CHARS = '你好世界测试中文数据处理';
const ASCII_CHARS = 'abcdefghijklmnopqrstuvwxyz0123456789';

// Mixed CJK + ASCII text
const arbCjkMixedText = fc
  .array(
    fc.oneof(
      fc.constantFrom(...CJK_CHARS.split('')),
      fc.constantFrom(...ASCII_CHARS.split('')),
    ),
    { minLength: 2, maxLength: 20 },
  )
  .map(chars => chars.join(''));

// Pure ASCII text (no CJK)
const arbAsciiOnlyText = fc
  .array(fc.constantFrom(...ASCII_CHARS.split('')), { minLength: 1, maxLength: 20 })
  .map(chars => chars.join(''));

// Hast text node
function arbTextNode(textGen: fc.Arbitrary<string>): fc.Arbitrary<Text> {
  return textGen.map(value => ({ type: 'text' as const, value }));
}

// Hast element node wrapping children
function makeElement(tagName: string, children: ElementContent[]): Element {
  return { type: 'element', tagName, properties: {}, children };
}

// Hast tree with mixed elements including pre/code
const arbHastTree: fc.Arbitrary<Root> = fc
  .array(
    fc.oneof(
      // <p> with CJK mixed text
      arbTextNode(arbCjkMixedText).map(t => makeElement('p', [t])),
      // <li> with CJK mixed text
      arbTextNode(arbCjkMixedText).map(t => makeElement('li', [t])),
      // <pre><code> with CJK mixed text (should be skipped)
      arbTextNode(arbCjkMixedText).map(t =>
        makeElement('pre', [makeElement('code', [t])]),
      ),
      // <code> inline with CJK mixed text (should be skipped)
      arbTextNode(arbCjkMixedText).map(t => makeElement('code', [t])),
    ),
    { minLength: 1, maxLength: 5 },
  )
  .map(children => ({ type: 'root' as const, children }));

// Hast tree with only ASCII text (for identity property)
const arbAsciiHastTree: fc.Arbitrary<Root> = fc
  .array(
    arbTextNode(arbAsciiOnlyText).map(t => makeElement('p', [t])),
    { minLength: 1, maxLength: 5 },
  )
  .map(children => ({ type: 'root' as const, children }));

// --- Helper: apply rehype-pangu transform to a tree ---

function applyPangu(tree: Root): Root {
  // Deep clone to avoid mutating the original
  const cloned = JSON.parse(JSON.stringify(tree)) as Root;
  const transform = rehypePangu();
  transform(cloned);
  return cloned;
}

// --- Helper: collect text nodes from a tree, optionally filtering by parent ---

function collectTextNodes(
  node: Root | Element,
  insideSkip = false,
): { value: string; skipped: boolean }[] {
  const results: { value: string; skipped: boolean }[] = [];
  const skipTags = new Set(['pre', 'code', 'script', 'style']);

  for (const child of node.children) {
    if (child.type === 'text') {
      results.push({ value: child.value, skipped: insideSkip });
    } else if (child.type === 'element') {
      const isSkip = insideSkip || skipTags.has(child.tagName);
      results.push(...collectTextNodes(child, isSkip));
    }
  }
  return results;
}

// --- Helper: collect element structure (tag, attributes, children count) ---

function collectElementStructure(
  node: Root | Element,
): { tagName: string; properties: Record<string, unknown>; childCount: number }[] {
  const results: { tagName: string; properties: Record<string, unknown>; childCount: number }[] = [];
  for (const child of node.children) {
    if (child.type === 'element') {
      results.push({
        tagName: child.tagName,
        properties: child.properties ?? {},
        childCount: child.children.length,
      });
      results.push(...collectElementStructure(child));
    }
  }
  return results;
}


// Feature: chinese-typography, Property 1: CJK Spacing Insertion
// **Validates: Requirements 4.2, 5.2**
describe('Property 1: CJK Spacing Insertion', () => {
  it('every CJK-to-half-width boundary in non-skipped text nodes has a space after processing', () => {
    fc.assert(
      fc.property(arbHastTree, (tree) => {
        const result = applyPangu(tree);
        const textNodes = collectTextNodes(result);

        for (const { value, skipped } of textNodes) {
          if (skipped) continue;
          // After processing, no CJK-half-width boundary should lack a space
          expect(hasCjkHalfWidthBoundaryWithoutSpace(value)).toBe(false);
        }
      }),
      { numRuns: 100 },
    );
  });
});

// Feature: chinese-typography, Property 2: HTML Structure Preservation
// **Validates: Requirements 4.4**
describe('Property 2: HTML Structure Preservation', () => {
  it('processing preserves all element nodes (tag names, attributes, children count)', () => {
    fc.assert(
      fc.property(arbHastTree, (tree) => {
        const result = applyPangu(tree);

        const originalStructure = collectElementStructure(tree);
        const resultStructure = collectElementStructure(result);

        expect(resultStructure.length).toBe(originalStructure.length);
        for (let i = 0; i < originalStructure.length; i++) {
          expect(resultStructure[i].tagName).toBe(originalStructure[i].tagName);
          expect(resultStructure[i].properties).toEqual(originalStructure[i].properties);
          expect(resultStructure[i].childCount).toBe(originalStructure[i].childCount);
        }
      }),
      { numRuns: 100 },
    );
  });
});

// Feature: chinese-typography, Property 3: Non-CJK Text Identity
// **Validates: Requirements 4.5**
describe('Property 3: Non-CJK Text Identity', () => {
  it('pure ASCII text nodes are unchanged after processing', () => {
    fc.assert(
      fc.property(arbAsciiHastTree, (tree) => {
        const originalTexts = collectTextNodes(tree).map(t => t.value);
        const result = applyPangu(tree);
        const resultTexts = collectTextNodes(result).map(t => t.value);

        expect(resultTexts).toEqual(originalTexts);
      }),
      { numRuns: 100 },
    );
  });
});

// Feature: chinese-typography, Property 4: Round-trip Valid HTML
// **Validates: Requirements 5.4**
describe('Property 4: Round-trip Valid HTML', () => {
  it('processing then serializing produces valid HTML that can be re-parsed', () => {
    fc.assert(
      fc.property(arbHastTree, (tree) => {
        const processed = applyPangu(tree);

        // Serialize the processed tree to HTML
        const processor = unified().use(rehypeStringify);
        const html = processor.stringify(processed);

        // Re-parse the HTML back into a hast tree
        const reparsed = unified()
          .use(rehypeParse, { fragment: true })
          .parse(html);

        // The re-parsed tree should have the same element structure
        const processedStructure = collectElementStructure(processed);
        const reparsedStructure = collectElementStructure(reparsed as Root);

        expect(reparsedStructure.length).toBe(processedStructure.length);
        for (let i = 0; i < processedStructure.length; i++) {
          expect(reparsedStructure[i].tagName).toBe(processedStructure[i].tagName);
          expect(reparsedStructure[i].childCount).toBe(processedStructure[i].childCount);
        }

        // Text content should be preserved through the round-trip
        const processedTexts = collectTextNodes(processed).map(t => t.value);
        const reparsedTexts = collectTextNodes(reparsed as Root).map(t => t.value);
        expect(reparsedTexts).toEqual(processedTexts);
      }),
      { numRuns: 100 },
    );
  });
});
