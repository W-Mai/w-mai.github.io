import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { JSDOM } from 'jsdom';
import {
  applyTemplate,
  parseInlineStyle,
  serializeInlineStyle,
  applyOverridesToStyle,
  getTemplateBaseFontSize,
  WECHAT_TEMPLATES,
  FONT_FAMILY_OPTIONS,
  FONT_SIZE_OPTIONS,
  TEXT_BEARING_TAGS,
  ACCENT_COLOR_TAGS,
  ACCENT_BORDER_TAGS,
  INDENT_TAGS,
  type WechatTemplate,
} from '../editor/wechat-templates';

// Set up global DOMParser for applyTemplate
const dom = new JSDOM('');
globalThis.DOMParser = dom.window.DOMParser;

// --- Generators ---

const arbTemplate = fc.constantFrom(...WECHAT_TEMPLATES);
const arbFontFamily = fc.constantFrom(...FONT_FAMILY_OPTIONS);
const arbFontSize = fc.constantFrom(...FONT_SIZE_OPTIONS);
// Generate valid 6-digit hex colors using hex character set
const hexChars = '0123456789abcdef'.split('');
const arbHexColor = fc
  .array(fc.constantFrom(...hexChars), { minLength: 6, maxLength: 6 })
  .map(chars => '#' + chars.join(''));

const arbTextBearingTag = fc.constantFrom(...TEXT_BEARING_TAGS);

// Generate tagged HTML from a list of wechat tags
function makeTaggedHtml(tags: string[]): string {
  return tags.map(tag => {
    const el = tag.startsWith('h') ? tag : (tag === 'li' ? 'li' : (tag === 'blockquote' ? 'blockquote' : 'p'));
    return `<${el} data-wechat-tag="${tag}">content</${el}>`;
  }).join('');
}

// Arbitrary: non-empty array of text-bearing tags → tagged HTML
const arbTextBearingHtml = fc
  .array(arbTextBearingTag, { minLength: 1, maxLength: 5 })
  .map(makeTaggedHtml);

// All tags that templates define styles for (excluding non-element tags like thead/tbody)
const ALL_TESTABLE_TAGS = ['h1', 'h2', 'h3', 'h4', 'p', 'strong', 'a', 'li', 'blockquote'] as const;
const arbAnyTag = fc.constantFrom(...ALL_TESTABLE_TAGS);
const arbMixedHtml = fc
  .array(arbAnyTag, { minLength: 1, maxLength: 6 })
  .map(makeTaggedHtml);

// Arbitrary: valid CSS property name (lowercase, hyphenated)
const arbCssProp = fc.stringMatching(/^[a-z][a-z-]{0,15}$/);
// Arbitrary: simple CSS value (no semicolons or colons)
const arbCssValue = fc.stringMatching(/^[a-zA-Z0-9#., ()-]{1,30}$/);

// Arbitrary: inline style string with 1-4 declarations
const arbInlineStyle = fc
  .array(fc.tuple(arbCssProp, arbCssValue), { minLength: 1, maxLength: 4 })
  .map(pairs => pairs.map(([p, v]) => `${p}: ${v}`).join('; '));

// Helper: parse output HTML and extract elements with style attributes
function parseOutputElements(html: string): Element[] {
  const d = new dom.window.DOMParser().parseFromString(html, 'text/html');
  return Array.from(d.querySelectorAll('[style]'));
}


// Feature: wechat-export-settings, Property 1: Empty overrides identity
// **Validates: Requirements 1.5, 2.5, 3.7**
describe('Property 1: Empty overrides identity', () => {
  it('applyTemplate with {} produces identical output to no overrides', () => {
    fc.assert(
      fc.property(arbTemplate, arbMixedHtml, (template, html) => {
        const withoutOverrides = applyTemplate(html, template);
        const withEmptyOverrides = applyTemplate(html, template, {});
        expect(withEmptyOverrides).toBe(withoutOverrides);
      }),
      { numRuns: 100 },
    );
  });
});

// Feature: wechat-export-settings, Property 2: Font-family replacement covers all text-bearing tags
// **Validates: Requirements 1.2**
describe('Property 2: Font-family replacement covers all text-bearing tags', () => {
  it('every text-bearing element has the selected font-family', () => {
    fc.assert(
      fc.property(arbTemplate, arbFontFamily, arbTextBearingHtml, (template, fontOpt, html) => {
        const result = applyTemplate(html, template, { fontFamily: fontOpt.value });
        const d = new dom.window.DOMParser().parseFromString(result, 'text/html');
        const elements = d.body.querySelectorAll('*');
        for (const el of elements) {
          const style = el.getAttribute('style');
          if (!style) continue;
          // Determine original tag from element name
          const tagName = el.tagName.toLowerCase();
          if (TEXT_BEARING_TAGS.includes(tagName)) {
            const parsed = parseInlineStyle(style);
            expect(parsed.get('font-family')).toBe(fontOpt.value);
          }
        }
      }),
      { numRuns: 100 },
    );
  });
});

// Feature: wechat-export-settings, Property 3: Font-size proportional scaling
// **Validates: Requirements 2.2**
describe('Property 3: Font-size proportional scaling', () => {
  it('scaled font-size equals round(original * selected / base), min 1px', () => {
    fc.assert(
      fc.property(arbTemplate, arbFontSize, (template, selectedSize) => {
        const baseFontSize = getTemplateBaseFontSize(template);
        const ratio = selectedSize / baseFontSize;

        // Test every style key that has a font-size
        for (const [tag, styleStr] of Object.entries(template.styles)) {
          const original = parseInlineStyle(styleStr);
          const fs = original.get('font-size');
          if (!fs) continue;
          const match = fs.match(/^(\d+(?:\.\d+)?)px$/);
          if (!match) continue;

          const originalPx = parseFloat(match[1]);
          const expected = Math.max(1, Math.round(originalPx * ratio));

          const result = applyOverridesToStyle(original, tag, { fontSizeRatio: ratio });
          expect(result.get('font-size')).toBe(`${expected}px`);
        }
      }),
      { numRuns: 100 },
    );
  });
});


// Feature: wechat-export-settings, Property 4: Theme color accent replacement
// **Validates: Requirements 3.3**
describe('Property 4: Theme color accent replacement', () => {
  it('accent color tags get color replaced, border tags get border color replaced', () => {
    fc.assert(
      fc.property(arbTemplate, arbHexColor, arbMixedHtml, (template, color, html) => {
        const result = applyTemplate(html, template, { themeColor: color });
        const d = new dom.window.DOMParser().parseFromString(result, 'text/html');
        const elements = d.body.querySelectorAll('*');

        for (const el of elements) {
          const style = el.getAttribute('style');
          if (!style) continue;
          const tagName = el.tagName.toLowerCase();
          const parsed = parseInlineStyle(style);

          // Accent color tags should have color set to override
          if (ACCENT_COLOR_TAGS.includes(tagName)) {
            expect(parsed.get('color')).toBe(color);
          }

          // Accent border tags should have border colors replaced
          if (ACCENT_BORDER_TAGS.includes(tagName)) {
            for (const prop of ['border-left', 'border-left-color', 'border-bottom', 'border-bottom-color']) {
              const val = parsed.get(prop);
              if (val) {
                // Any hex color in the value should be the override color
                const hexMatches = val.match(/#[0-9a-fA-F]{3,8}/g);
                if (hexMatches) {
                  for (const m of hexMatches) {
                    expect(m).toBe(color);
                  }
                }
              }
            }
          }
        }
      }),
      { numRuns: 100 },
    );
  });
});

// Feature: wechat-export-settings, Property 6: Text indent addition
// **Validates: Requirements 4.2**
describe('Property 6: Text indent addition', () => {
  it('p and li elements get text-indent: 2em when textIndent is true', () => {
    fc.assert(
      fc.property(arbTemplate, arbTextBearingHtml, (template, html) => {
        const result = applyTemplate(html, template, { textIndent: true });
        const d = new dom.window.DOMParser().parseFromString(result, 'text/html');
        const elements = d.body.querySelectorAll('*');

        for (const el of elements) {
          const style = el.getAttribute('style');
          if (!style) continue;
          const tagName = el.tagName.toLowerCase();
          if (INDENT_TAGS.includes(tagName)) {
            const parsed = parseInlineStyle(style);
            expect(parsed.get('text-indent')).toBe('2em');
          }
        }
      }),
      { numRuns: 100 },
    );
  });
});

// Feature: wechat-export-settings, Property 7: Text indent disable preserves template
// **Validates: Requirements 4.3**
describe('Property 7: Text indent disable preserves template', () => {
  it('textIndent false/undefined preserves original template text-indent', () => {
    fc.assert(
      fc.property(
        arbTemplate,
        arbTextBearingHtml,
        fc.constantFrom(false as const, undefined),
        (template, html, indentVal) => {
          const overrides = indentVal === undefined ? {} : { textIndent: indentVal as false };
          const result = applyTemplate(html, template, overrides);
          const baseline = applyTemplate(html, template);
          // Output should match the no-override baseline for text-indent
          const d1 = new dom.window.DOMParser().parseFromString(result, 'text/html');
          const d2 = new dom.window.DOMParser().parseFromString(baseline, 'text/html');
          const els1 = d1.body.querySelectorAll('p, li');
          const els2 = d2.body.querySelectorAll('p, li');
          expect(els1.length).toBe(els2.length);
          for (let i = 0; i < els1.length; i++) {
            const s1 = parseInlineStyle(els1[i].getAttribute('style') || '');
            const s2 = parseInlineStyle(els2[i].getAttribute('style') || '');
            expect(s1.get('text-indent')).toBe(s2.get('text-indent'));
          }
        },
      ),
      { numRuns: 100 },
    );
  });
});


// Feature: wechat-export-settings, Property 10: Override precedence
// **Validates: Requirements 7.3**
describe('Property 10: Override precedence', () => {
  it('override value takes precedence over template value for targeted properties', () => {
    fc.assert(
      fc.property(arbTemplate, arbFontFamily, (template, fontOpt) => {
        // font-family on text-bearing tags should be the override, not the template
        for (const tag of TEXT_BEARING_TAGS) {
          const templateStyle = template.styles[tag];
          if (!templateStyle) continue;
          const original = parseInlineStyle(templateStyle);
          const result = applyOverridesToStyle(original, tag, { fontFamily: fontOpt.value });
          expect(result.get('font-family')).toBe(fontOpt.value);
          // If template had a different font-family, it should be replaced
          if (original.has('font-family') && original.get('font-family') !== fontOpt.value) {
            expect(result.get('font-family')).not.toBe(original.get('font-family'));
          }
        }
      }),
      { numRuns: 100 },
    );
  });
});

// Feature: wechat-export-settings, Property 11: Non-overridden property preservation
// **Validates: Requirements 7.4**
describe('Property 11: Non-overridden property preservation', () => {
  it('CSS properties not targeted by overrides retain original values', () => {
    fc.assert(
      fc.property(arbTemplate, arbFontFamily, (template, fontOpt) => {
        for (const [tag, styleStr] of Object.entries(template.styles)) {
          if (!styleStr) continue;
          const original = parseInlineStyle(styleStr);
          const result = applyOverridesToStyle(original, tag, { fontFamily: fontOpt.value });

          // Properties that are NOT font-family should be unchanged
          for (const [prop, value] of original) {
            if (prop === 'font-family') continue;
            expect(result.get(prop)).toBe(value);
          }
        }
      }),
      { numRuns: 100 },
    );
  });
});

// Feature: wechat-export-settings, Property 12: Inline style parse-serialize round-trip
// **Validates: Requirements 7.5**
describe('Property 12: Inline style parse-serialize round-trip', () => {
  it('parse then serialize produces functionally equivalent style', () => {
    fc.assert(
      fc.property(arbInlineStyle, (style) => {
        const parsed = parseInlineStyle(style);
        const serialized = serializeInlineStyle(parsed);
        const reparsed = parseInlineStyle(serialized);

        // Same properties and values
        expect(reparsed.size).toBe(parsed.size);
        for (const [prop, value] of parsed) {
          expect(reparsed.get(prop)).toBe(value);
        }
      }),
      { numRuns: 100 },
    );
  });

  it('round-trip on real template styles preserves all properties', () => {
    fc.assert(
      fc.property(arbTemplate, (template) => {
        for (const [, styleStr] of Object.entries(template.styles)) {
          if (!styleStr) continue;
          const parsed = parseInlineStyle(styleStr);
          const serialized = serializeInlineStyle(parsed);
          const reparsed = parseInlineStyle(serialized);
          expect(reparsed.size).toBe(parsed.size);
          for (const [prop, value] of parsed) {
            expect(reparsed.get(prop)).toBe(value);
          }
        }
      }),
      { numRuns: 100 },
    );
  });
});

// Feature: wechat-export-settings, Property 13: Output purity invariant
// **Validates: Requirements 7.2**
describe('Property 13: Output purity invariant', () => {
  it('output contains no class attrs, no data-wechat-tag, no style tags, no CSS variables', () => {
    fc.assert(
      fc.property(arbTemplate, arbMixedHtml, (template, html) => {
        const result = applyTemplate(html, template, {
          fontFamily: FONT_FAMILY_OPTIONS[0].value,
          themeColor: '#FF0000',
          textIndent: true,
        });

        // No class attributes
        expect(result).not.toMatch(/\bclass\s*=/i);
        // No data-wechat-tag attributes
        expect(result).not.toMatch(/data-wechat-tag/i);
        // No <style> tags
        expect(result).not.toMatch(/<style[\s>]/i);
        // No CSS variable references
        expect(result).not.toMatch(/var\(--/);
      }),
      { numRuns: 100 },
    );
  });
});
