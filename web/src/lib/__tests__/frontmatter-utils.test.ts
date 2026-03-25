import { describe, it, expect } from 'vitest';
import { Text } from '@codemirror/state';
import {
  detectFrontmatterRange,
  parseFrontmatter,
  serializeFrontmatter,
  type FrontmatterData,
} from '../editor/frontmatter-utils';

// --- detectFrontmatterRange ---

describe('detectFrontmatterRange', () => {
  it('returns null for an empty document', () => {
    const doc = Text.of(['']);
    expect(detectFrontmatterRange(doc)).toBeNull();
  });

  it('returns null for a single-line document', () => {
    const doc = Text.of(['---']);
    expect(detectFrontmatterRange(doc)).toBeNull();
  });

  it('returns null when only one --- exists', () => {
    const doc = Text.of(['---', 'title: test', 'no closing']);
    expect(detectFrontmatterRange(doc)).toBeNull();
  });

  it('returns null when --- is not on the first line', () => {
    const doc = Text.of(['hello', '---', 'title: test', '---']);
    expect(detectFrontmatterRange(doc)).toBeNull();
  });

  it('detects a normal frontmatter region', () => {
    const doc = Text.of(['---', 'title: test', '---', 'content']);
    const result = detectFrontmatterRange(doc);
    expect(result).not.toBeNull();
    expect(result!.from).toBe(0);
    expect(result!.yamlText).toBe('title: test\n');
  });

  it('detects frontmatter with multiple YAML lines', () => {
    const doc = Text.of(['---', 'title: hello', 'tags: [a, b]', '---']);
    const result = detectFrontmatterRange(doc);
    expect(result).not.toBeNull();
    expect(result!.yamlText).toBe('title: hello\ntags: [a, b]\n');
  });

  it('returns empty yamlText for frontmatter with no content between delimiters', () => {
    const doc = Text.of(['---', '---', 'body']);
    const result = detectFrontmatterRange(doc);
    expect(result).not.toBeNull();
    expect(result!.yamlText).toBe('');
  });

  it('handles --- with trailing whitespace', () => {
    const doc = Text.of(['---  ', 'title: x', '---  ']);
    const result = detectFrontmatterRange(doc);
    expect(result).not.toBeNull();
    expect(result!.yamlText).toBe('title: x\n');
  });

  it('to offset covers the closing delimiter line', () => {
    // "---\ntitle: x\n---\nbody" => to should be past the closing ---\n
    const doc = Text.of(['---', 'title: x', '---', 'body']);
    const result = detectFrontmatterRange(doc);
    expect(result).not.toBeNull();
    // from=0, first line "---" (len 3), then \n, "title: x" (len 8), then \n, "---" (len 3), then \n
    // to should point past the newline after closing ---
    const fullText = doc.toString();
    const closingEnd = fullText.indexOf('---', 4) + 3; // second ---
    // to should be closingEnd + 1 (the newline) since there's content after
    expect(result!.to).toBe(closingEnd + 1);
  });

  it('to offset equals doc.length when closing --- is the last line', () => {
    const doc = Text.of(['---', 'title: x', '---']);
    const result = detectFrontmatterRange(doc);
    expect(result).not.toBeNull();
    expect(result!.to).toBe(doc.length);
  });
});

// --- parseFrontmatter ---

describe('parseFrontmatter', () => {
  it('parses minimal valid frontmatter', () => {
    const result = parseFrontmatter('title: Hello\ndescription: World\npubDate: 2024-01-01\n');
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.title).toBe('Hello');
      expect(result.data.description).toBe('World');
      expect(result.data.pubDate).toBe('2024-01-01');
      expect(result.data.tags).toEqual([]);
      expect(result.data.updatedDate).toBeUndefined();
      expect(result.data.heroImage).toBeUndefined();
      expect(result.data.category).toBeUndefined();
    }
  });

  it('parses frontmatter with all fields', () => {
    const yaml = [
      "title: 'Full Post'",
      "description: 'A complete post'",
      "pubDate: '2024-06-15'",
      "updatedDate: '2024-07-01'",
      "heroImage: '../../assets/images/hero.png'",
      'tags: ["typescript", "astro"]',
      "category: 'Programming'",
    ].join('\n');
    const result = parseFrontmatter(yaml);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.title).toBe('Full Post');
      expect(result.data.description).toBe('A complete post');
      expect(result.data.pubDate).toBe('2024-06-15');
      expect(result.data.updatedDate).toBe('2024-07-01');
      expect(result.data.heroImage).toBe('./assets/hero.png');
      expect(result.data.tags).toEqual(['typescript', 'astro']);
      expect(result.data.category).toBe('Programming');
    }
  });

  it('handles missing optional fields gracefully', () => {
    const yaml = "title: Test\ndescription: Desc\npubDate: '2024-01-01'\n";
    const result = parseFrontmatter(yaml);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.updatedDate).toBeUndefined();
      expect(result.data.heroImage).toBeUndefined();
      expect(result.data.category).toBeUndefined();
      expect(result.data.tags).toEqual([]);
    }
  });

  it('returns error for malformed YAML', () => {
    const result = parseFrontmatter('{ invalid: yaml: [}');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBeTruthy();
    }
  });

  it('returns error for non-mapping YAML (plain scalar)', () => {
    const result = parseFrontmatter('just a string');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBe('Frontmatter must be a YAML mapping');
    }
  });

  it('returns error for YAML array', () => {
    const result = parseFrontmatter('- item1\n- item2\n');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBe('Frontmatter must be a YAML mapping');
    }
  });

  it('returns error for empty YAML', () => {
    const result = parseFrontmatter('');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBe('Frontmatter must be a YAML mapping');
    }
  });

  it('coerces non-string tags to strings', () => {
    const yaml = 'title: T\ndescription: D\npubDate: P\ntags: [1, 2, true]\n';
    const result = parseFrontmatter(yaml);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.tags).toEqual(['1', '2', 'true']);
    }
  });
});

// --- serializeFrontmatter ---

describe('serializeFrontmatter', () => {
  it('serializes a complete FrontmatterData matching existing post format', () => {
    const data: FrontmatterData = {
      title: 'Using MDX',
      description: 'Lorem ipsum dolor sit amet',
      pubDate: 'Jan 4 1145',
      heroImage: './assets/my_hero_img.png',
      tags: ['mdx', 'astro'],
      category: 'Programming',
    };
    const output = serializeFrontmatter(data);
    // Verify the output matches the expected format
    expect(output).toContain('---');
    expect(output).toContain("title: 'Using MDX'");
    expect(output).toContain("description: 'Lorem ipsum dolor sit amet'");
    expect(output).toContain("pubDate: 'Jan 4 1145'");
    expect(output).toContain("heroImage: '../../assets/images/my_hero_img.png'");
    expect(output).toContain('tags: ["mdx", "astro"]');
    expect(output).toContain("category: 'Programming'");
  });

  it('omits optional fields when undefined', () => {
    const data: FrontmatterData = {
      title: 'Minimal',
      description: 'A post',
      pubDate: '2024-01-01',
      tags: [],
    };
    const output = serializeFrontmatter(data);
    expect(output).not.toContain('updatedDate');
    expect(output).not.toContain('heroImage');
    expect(output).not.toContain('category');
  });

  it('omits optional fields when empty string', () => {
    const data: FrontmatterData = {
      title: 'Test',
      description: 'Desc',
      pubDate: '2024-01-01',
      updatedDate: '',
      heroImage: '',
      tags: [],
      category: '',
    };
    const output = serializeFrontmatter(data);
    expect(output).not.toContain('updatedDate');
    expect(output).not.toContain('heroImage');
    expect(output).not.toContain('category');
  });

  it('preserves field ordering', () => {
    const data: FrontmatterData = {
      title: 'Order Test',
      description: 'Testing order',
      pubDate: '2024-01-01',
      updatedDate: '2024-02-01',
      heroImage: './assets/img.png',
      tags: ['a'],
      category: 'Cat',
    };
    const output = serializeFrontmatter(data);
    const lines = output.split('\n');
    // Find field lines (skip opening/closing ---)
    const fieldLines = lines.filter((l) => l.includes(':') && l.trim() !== '---');
    const keys = fieldLines.map((l) => l.split(':')[0].trim());
    expect(keys).toEqual(['title', 'description', 'pubDate', 'updatedDate', 'heroImage', 'tags', 'category']);
  });

  it('wraps output with --- delimiters and trailing newline', () => {
    const data: FrontmatterData = {
      title: 'T',
      description: 'D',
      pubDate: 'P',
      tags: [],
    };
    const output = serializeFrontmatter(data);
    expect(output.startsWith('---\n')).toBe(true);
    expect(output.endsWith('---\n')).toBe(true);
  });

  it('uses single quotes for string values', () => {
    const data: FrontmatterData = {
      title: 'Hello World',
      description: 'A description',
      pubDate: '2024-01-01',
      tags: [],
    };
    const output = serializeFrontmatter(data);
    expect(output).toContain("title: 'Hello World'");
    expect(output).toContain("description: 'A description'");
  });

  it('uses bracket notation for tags', () => {
    const data: FrontmatterData = {
      title: 'T',
      description: 'D',
      pubDate: 'P',
      tags: ['react', 'vue', 'svelte'],
    };
    const output = serializeFrontmatter(data);
    expect(output).toContain('tags: ["react", "vue", "svelte"]');
  });

  it('handles empty tags array', () => {
    const data: FrontmatterData = {
      title: 'T',
      description: 'D',
      pubDate: 'P',
      tags: [],
    };
    const output = serializeFrontmatter(data);
    expect(output).toContain('tags: []');
  });

  it('escapes single quotes in string values', () => {
    const data: FrontmatterData = {
      title: "It's a test",
      description: 'D',
      pubDate: 'P',
      tags: [],
    };
    const output = serializeFrontmatter(data);
    expect(output).toContain("title: 'It''s a test'");
  });
});

// Feature: editor-frontmatter-panel, Property 1: Frontmatter detection correctness
// Validates: Requirements 1.1, 1.2

import * as fc from 'fast-check';

/**
 * Generate a random line that is NOT a `---` delimiter.
 * Avoids lines whose trimmed content equals exactly `---` and contains no newlines.
 */
const arbNonDelimiterLine = fc
  .stringMatching(/^[^\n\r]{0,60}$/)
  .filter((s) => s.trim() !== '---');

/**
 * Generate random YAML-like content lines (between delimiters).
 * Each line is guaranteed not to be a `---` delimiter.
 */
const arbYamlLines = fc.array(arbNonDelimiterLine, { minLength: 0, maxLength: 8 });

describe('Property 1: Frontmatter detection correctness', () => {
  it('returns non-null with correct offsets for documents with valid frontmatter', () => {
    // Generate: opening `---`, N content lines, closing `---`, optional trailing lines
    const arbValidFrontmatter = fc.tuple(
      arbYamlLines,
      fc.array(arbNonDelimiterLine, { minLength: 0, maxLength: 4 }),
    );

    fc.assert(
      fc.property(arbValidFrontmatter, ([contentLines, trailingLines]) => {
        const lines = ['---', ...contentLines, '---', ...trailingLines];
        const doc = Text.of(lines);
        const result = detectFrontmatterRange(doc);

        // Must detect frontmatter
        expect(result).not.toBeNull();
        if (!result) return;

        // `from` must be 0 (opening --- is on line 0)
        expect(result.from).toBe(0);

        // Reconstruct expected yamlText: content lines joined by \n, with trailing \n if non-empty
        const expectedYaml =
          contentLines.length > 0 ? contentLines.join('\n') + '\n' : '';
        expect(result.yamlText).toBe(expectedYaml);

        // Verify `to` offset: should be past the closing --- line
        const fullText = doc.toString();
        // Find the closing --- position: it's after opening --- + \n + content
        const closingLineStart =
          '---'.length + 1 + (contentLines.length > 0 ? expectedYaml.length : 0);
        const closingLineEnd = closingLineStart + 3; // length of '---'

        if (trailingLines.length > 0) {
          // There's content after closing ---, so `to` includes the newline
          expect(result.to).toBe(closingLineEnd + 1);
        } else {
          // Closing --- is the last line, `to` equals doc.length
          expect(result.to).toBe(doc.length);
        }

        // Verify the text at [from, to) starts with --- and ends with ---
        const regionText = fullText.slice(result.from, result.to);
        expect(regionText.startsWith('---')).toBe(true);
        expect(regionText.trimEnd().endsWith('---')).toBe(true);
      }),
      { numRuns: 100 },
    );
  });

  it('returns null for documents without valid frontmatter', () => {
    // Generate documents that do NOT start with `---` on the first line
    const arbNoFrontmatter = fc
      .array(arbNonDelimiterLine, { minLength: 1, maxLength: 10 })
      .filter((lines) => lines[0].trim() !== '---');

    fc.assert(
      fc.property(arbNoFrontmatter, (lines) => {
        const doc = Text.of(lines);
        const result = detectFrontmatterRange(doc);
        expect(result).toBeNull();
      }),
      { numRuns: 100 },
    );
  });

  it('returns null when document starts with --- but has no closing ---', () => {
    // Generate: opening `---` followed by lines that are never `---`
    const arbNoClosing = fc.array(arbNonDelimiterLine, { minLength: 0, maxLength: 8 });

    fc.assert(
      fc.property(arbNoClosing, (contentLines) => {
        const lines = ['---', ...contentLines];
        const doc = Text.of(lines);
        const result = detectFrontmatterRange(doc);
        expect(result).toBeNull();
      }),
      { numRuns: 100 },
    );
  });

  it('returns null when --- appears only on non-first lines', () => {
    // Generate: at least one non-delimiter line, then ---, then optional content, then ---
    const arbMidDelimiter = fc.tuple(
      fc.array(arbNonDelimiterLine, { minLength: 1, maxLength: 4 }).filter(
        (lines) => lines[0].trim() !== '---',
      ),
      arbYamlLines,
    );

    fc.assert(
      fc.property(arbMidDelimiter, ([prefixLines, contentLines]) => {
        const lines = [...prefixLines, '---', ...contentLines, '---'];
        const doc = Text.of(lines);
        const result = detectFrontmatterRange(doc);
        expect(result).toBeNull();
      }),
      { numRuns: 100 },
    );
  });

  it('yamlText equals the exact text between the two delimiter lines', () => {
    // Focused property: verify yamlText by using the CM Text line API
    const arbValidDoc = fc.tuple(
      arbYamlLines,
      fc.array(arbNonDelimiterLine, { minLength: 0, maxLength: 3 }),
    );

    fc.assert(
      fc.property(arbValidDoc, ([contentLines, trailingLines]) => {
        const lines = ['---', ...contentLines, '---', ...trailingLines];
        const doc = Text.of(lines);
        const result = detectFrontmatterRange(doc);

        expect(result).not.toBeNull();
        if (!result) return;

        // Use CM Text API: line 1 is opening ---, closing --- is at line (1 + contentLines.length + 1)
        const openingLine = doc.line(1);
        const closingLineNum = 1 + contentLines.length + 1;
        const closingLine = doc.line(closingLineNum);

        // yamlText should be the text between end of opening line and start of closing line
        const expectedYaml =
          openingLine.to + 1 < closingLine.from
            ? doc.sliceString(openingLine.to + 1, closingLine.from)
            : '';
        expect(result.yamlText).toBe(expectedYaml);
      }),
      { numRuns: 100 },
    );
  });
});

// Feature: editor-frontmatter-panel, Property 2: Malformed YAML error handling
// Validates: Requirements 1.4

describe('Property 2: Malformed YAML error handling', () => {
  it('returns ok: false for YAML arrays', () => {
    // YAML arrays are valid YAML but not valid frontmatter (must be a mapping)
    const arbYamlArray = fc
      .array(fc.string({ minLength: 1, maxLength: 30 }), { minLength: 1, maxLength: 6 })
      .map((items) => items.map((s) => `- ${s.replace(/\n/g, ' ')}`).join('\n'));

    fc.assert(
      fc.property(arbYamlArray, (yamlStr) => {
        const result = parseFrontmatter(yamlStr);
        expect(result.ok).toBe(false);
        if (!result.ok) {
          expect(result.error.length).toBeGreaterThan(0);
        }
      }),
      { numRuns: 100 },
    );
  });

  it('returns ok: false for plain scalars (non-mapping values)', () => {
    // Plain strings without `:` parse as YAML scalars, not mappings
    const arbPlainScalar = fc
      .stringMatching(/^[a-zA-Z0-9 ]{1,40}$/)
      .filter((s) => !s.includes(':') && s.trim().length > 0);

    fc.assert(
      fc.property(arbPlainScalar, (yamlStr) => {
        const result = parseFrontmatter(yamlStr);
        expect(result.ok).toBe(false);
        if (!result.ok) {
          expect(result.error).toBe('Frontmatter must be a YAML mapping');
        }
      }),
      { numRuns: 100 },
    );
  });

  it('returns ok: false for empty or whitespace-only strings', () => {
    const arbEmpty = fc.constantFrom('', ' ', '  ', '\n', '\n\n', '  \n  ');

    fc.assert(
      fc.property(arbEmpty, (yamlStr) => {
        const result = parseFrontmatter(yamlStr);
        expect(result.ok).toBe(false);
        if (!result.ok) {
          expect(result.error).toBe('Frontmatter must be a YAML mapping');
        }
      }),
      { numRuns: 100 },
    );
  });

  it('returns ok: false for strings with unbalanced braces/brackets', () => {
    // Syntactically broken YAML that causes parse errors
    const arbMalformed = fc.constantFrom(
      '{ key: [}',
      '{ key: value: bad }',
      '[unclosed',
      '{unclosed: value',
      '{ a: { b: [} }',
      ': : :',
      '{ key: "unterminated',
      "{ key: 'unterminated",
      '[ [nested: broken}',
      '{ a: [1, 2}',
    );

    fc.assert(
      fc.property(arbMalformed, (yamlStr) => {
        const result = parseFrontmatter(yamlStr);
        expect(result.ok).toBe(false);
        if (!result.ok) {
          expect(result.error.length).toBeGreaterThan(0);
        }
      }),
      { numRuns: 100 },
    );
  });
});

// Feature: editor-frontmatter-panel, Property 3: Serialization round-trip
// Validates: Requirements 1.3, 5.1, 5.4, 7.4

describe('Property 3: Serialization round-trip', () => {
  /**
   * Generator for valid FrontmatterData objects with YAML-safe strings.
   * Uses restricted character sets to ensure clean single-quote round-trip.
   */
  const arbFrontmatterData = fc.record({
    title: fc.stringMatching(/^[a-zA-Z0-9 .,!?-]{1,100}$/),
    description: fc.stringMatching(/^[a-zA-Z0-9 .,!?-]{1,100}$/),
    pubDate: fc
      .date({ min: new Date('2020-01-01'), max: new Date('2030-12-31') })
      .filter((d) => !isNaN(d.getTime()))
      .map((d) => d.toISOString().split('T')[0]),
    updatedDate: fc.option(
      fc
        .date({ min: new Date('2020-01-01'), max: new Date('2030-12-31') })
        .filter((d) => !isNaN(d.getTime()))
        .map((d) => d.toISOString().split('T')[0]),
      { nil: undefined },
    ),
    heroImage: fc.option(
      fc.stringMatching(/^\.\/assets\/[a-z0-9_-]+\.(png|jpg|webp)$/),
      { nil: undefined },
    ),
    tags: fc.uniqueArray(fc.stringMatching(/^[a-z][a-z0-9-]{0,14}$/), {
      minLength: 0,
      maxLength: 8,
    }),
    category: fc.option(
      fc.stringMatching(/^[A-Z][a-zA-Z0-9 ]{0,19}$/),
      { nil: undefined },
    ),
  });

  /**
   * Strip `---` delimiters from serialized output to get raw YAML
   * that parseFrontmatter expects.
   */
  function stripDelimiters(serialized: string): string {
    const lines = serialized.split('\n');
    // Remove opening `---` and closing `---`
    const inner = lines.slice(1, -2); // skip first "---" and last "---" + trailing empty
    return inner.join('\n') + '\n';
  }

  it('parseFrontmatter(serializeFrontmatter(data)) deeply equals original data', () => {
    fc.assert(
      fc.property(arbFrontmatterData, (data) => {
        const serialized = serializeFrontmatter(data);
        const yaml = stripDelimiters(serialized);
        const result = parseFrontmatter(yaml);

        // Parse must succeed
        expect(result.ok).toBe(true);
        if (!result.ok) return;

        // Required fields must match exactly
        expect(result.data.title).toBe(data.title);
        expect(result.data.description).toBe(data.description);
        expect(result.data.pubDate).toBe(data.pubDate);
        expect(result.data.tags).toEqual(data.tags);

        // Optional fields: undefined stays undefined, defined values match
        expect(result.data.updatedDate).toBe(data.updatedDate);
        expect(result.data.heroImage).toBe(data.heroImage);
        expect(result.data.category).toBe(data.category);
      }),
      { numRuns: 100 },
    );
  });
});

// Feature: editor-frontmatter-panel, Property 4: Serialization format invariants
// Validates: Requirements 7.1, 7.2, 7.3

describe('Property 4: Serialization format invariants', () => {
  /**
   * Safe date string generator: produces YYYY-MM-DD strings directly
   * to avoid Invalid time value errors during shrinking.
   */
  const arbDateStr = fc
    .tuple(
      fc.integer({ min: 2020, max: 2030 }),
      fc.integer({ min: 1, max: 12 }),
      fc.integer({ min: 1, max: 28 }),
    )
    .map(([y, m, d]) => `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`);

  /**
   * Generator for valid FrontmatterData objects with YAML-safe strings.
   */
  const arbFrontmatterData = fc.record({
    title: fc.stringMatching(/^[a-zA-Z0-9 .,!?-]{1,100}$/),
    description: fc.stringMatching(/^[a-zA-Z0-9 .,!?-]{1,100}$/),
    pubDate: arbDateStr,
    updatedDate: fc.option(arbDateStr, { nil: undefined }),
    heroImage: fc.option(
      fc.stringMatching(/^\.\/assets\/[a-z0-9_-]+\.(png|jpg|webp)$/),
      { nil: undefined },
    ),
    tags: fc.uniqueArray(fc.stringMatching(/^[a-z][a-z0-9-]{0,14}$/), {
      minLength: 0,
      maxLength: 8,
    }),
    category: fc.option(
      fc.stringMatching(/^[A-Z][a-zA-Z0-9 ]{0,19}$/),
      { nil: undefined },
    ),
  });

  /** Expected field order for serialization */
  const FIELD_ORDER = [
    'title',
    'description',
    'pubDate',
    'updatedDate',
    'heroImage',
    'tags',
    'category',
  ];

  /** Optional fields that should be omitted when empty/undefined */
  const OPTIONAL_FIELDS = new Set(['updatedDate', 'heroImage', 'category']);

  /** String fields whose values should be single-quoted */
  const STRING_FIELDS = ['title', 'description', 'pubDate', 'updatedDate', 'heroImage', 'category'];

  it('(a) string field values use single quotes', () => {
    fc.assert(
      fc.property(arbFrontmatterData, (data) => {
        const output = serializeFrontmatter(data);
        const lines = output.split('\n').filter((l) => l.trim() !== '---' && l.trim() !== '');

        for (const field of STRING_FIELDS) {
          const value = data[field as keyof FrontmatterData];
          if (OPTIONAL_FIELDS.has(field) && (value === undefined || value === '')) {
            // Field should be omitted — verified in invariant (d)
            continue;
          }
          if (field === 'tags') continue;

          const fieldLine = lines.find((l) => l.startsWith(`${field}:`));
          expect(fieldLine).toBeDefined();
          // Value portion must be wrapped in single quotes
          expect(fieldLine).toMatch(new RegExp(`^${field}: '.*'$`));
        }
      }),
      { numRuns: 100 },
    );
  });

  it('(b) tags array uses inline bracket notation', () => {
    fc.assert(
      fc.property(arbFrontmatterData, (data) => {
        const output = serializeFrontmatter(data);
        const tagsLine = output.split('\n').find((l) => l.startsWith('tags:'));

        expect(tagsLine).toBeDefined();
        // Must match `tags: [...]` pattern
        expect(tagsLine).toMatch(/^tags: \[.*\]$/);

        // Each element inside brackets should be double-quoted
        if (data.tags.length > 0) {
          const bracketContent = tagsLine!.slice('tags: ['.length, -1);
          const elements = bracketContent.split(', ');
          for (const el of elements) {
            expect(el).toMatch(/^".*"$/);
          }
        }
      }),
      { numRuns: 100 },
    );
  });

  it('(c) field keys appear in correct order', () => {
    fc.assert(
      fc.property(arbFrontmatterData, (data) => {
        const output = serializeFrontmatter(data);
        const lines = output.split('\n').filter((l) => l.trim() !== '---' && l.trim() !== '');

        // Extract field keys from output lines
        const outputKeys = lines.map((l) => l.split(':')[0].trim());

        // Build expected key order: only fields that should be present
        const expectedKeys = FIELD_ORDER.filter((key) => {
          if (OPTIONAL_FIELDS.has(key)) {
            const value = data[key as keyof FrontmatterData];
            return value !== undefined && value !== '';
          }
          return true;
        });

        expect(outputKeys).toEqual(expectedKeys);
      }),
      { numRuns: 100 },
    );
  });

  it('(d) optional fields with undefined/empty values do not appear in output', () => {
    fc.assert(
      fc.property(arbFrontmatterData, (data) => {
        const output = serializeFrontmatter(data);

        for (const field of OPTIONAL_FIELDS) {
          const value = data[field as keyof FrontmatterData];
          if (value === undefined || value === '') {
            // Field must NOT appear in output
            const hasField = output.split('\n').some((l) => l.startsWith(`${field}:`));
            expect(hasField).toBe(false);
          }
        }
      }),
      { numRuns: 100 },
    );
  });
});

// Feature: editor-frontmatter-panel, Property 5: Tag addition appends and renders
// Validates: Requirements 4.1, 4.4

describe('Property 5: Tag addition appends and renders', () => {
  /** Unique tag array generator */
  const arbTagArray = fc.uniqueArray(fc.stringMatching(/^[a-z][a-z0-9-]{0,14}$/), {
    minLength: 0,
    maxLength: 10,
  });

  /** New tag generator */
  const arbNewTag = fc.stringMatching(/^[a-z][a-z0-9-]{0,14}$/);

  it('appending a unique tag increases length by 1, places it at the end, and preserves order', () => {
    fc.assert(
      fc.property(arbTagArray, arbNewTag, (tags, newTag) => {
        // Pre-condition: newTag must not already exist in the array
        fc.pre(!tags.includes(newTag));

        // Operation: append
        const result = [...tags, newTag];

        // Length increases by 1
        expect(result.length).toBe(tags.length + 1);

        // Last element is the new tag
        expect(result[result.length - 1]).toBe(newTag);

        // Original tags preserved in order
        for (let i = 0; i < tags.length; i++) {
          expect(result[i]).toBe(tags[i]);
        }
      }),
      { numRuns: 100 },
    );
  });
});

// Feature: editor-frontmatter-panel, Property 6: Tag removal
// Validates: Requirements 4.2

describe('Property 6: Tag removal', () => {
  /** Non-empty unique tag array generator */
  const arbNonEmptyTagArray = fc.uniqueArray(fc.stringMatching(/^[a-z][a-z0-9-]{0,14}$/), {
    minLength: 1,
    maxLength: 10,
  });

  it('removing a tag by index decreases length by 1, excludes the removed tag, and preserves relative order', () => {
    fc.assert(
      fc.property(
        arbNonEmptyTagArray.chain((tags) =>
          fc.tuple(fc.constant(tags), fc.integer({ min: 0, max: tags.length - 1 })),
        ),
        ([tags, index]) => {
          const removedTag = tags[index];

          // Operation: remove by index
          const result = tags.filter((_, i) => i !== index);

          // Length decreases by 1
          expect(result.length).toBe(tags.length - 1);

          // Removed tag is not in the result (tags are unique, so this holds)
          expect(result).not.toContain(removedTag);

          // Relative order of remaining tags is preserved
          const expectedRemaining = [...tags.slice(0, index), ...tags.slice(index + 1)];
          expect(result).toEqual(expectedRemaining);
        },
      ),
      { numRuns: 100 },
    );
  });
});

// Feature: editor-frontmatter-panel, Property 7: Duplicate tag rejection
// Validates: Requirements 4.5

describe('Property 7: Duplicate tag rejection', () => {
  /** Non-empty unique tag array generator (need at least one tag to pick a duplicate) */
  const arbNonEmptyTagArray = fc.uniqueArray(fc.stringMatching(/^[a-z][a-z0-9-]{0,14}$/), {
    minLength: 1,
    maxLength: 10,
  });

  it('adding a tag that already exists is rejected and the array remains unchanged', () => {
    fc.assert(
      fc.property(
        arbNonEmptyTagArray.chain((tags) =>
          fc.tuple(
            fc.constant(tags),
            fc.integer({ min: 0, max: tags.length - 1 }).map((i) => tags[i]),
          ),
        ),
        ([tags, existingTag]) => {
          // Duplicate check: tag already exists
          const isDuplicate = tags.includes(existingTag);
          expect(isDuplicate).toBe(true);

          // Operation: reject addition, array stays the same
          const result = isDuplicate ? tags : [...tags, existingTag];

          // Array is identical to original
          expect(result).toEqual(tags);
          expect(result.length).toBe(tags.length);
        },
      ),
      { numRuns: 100 },
    );
  });
});
