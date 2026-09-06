import type { Root } from 'mdast';
import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkGfm from 'remark-gfm';
import remarkMdx from 'remark-mdx';
import { toString } from 'mdast-util-to-string';
import { VFile } from 'vfile';
import { describe, expect, it } from 'vitest';
import { attachmentReference } from '../paths';
import {
  attachmentBlockSyntax, attachmentInlineSyntax, attachmentTokens,
  AttachmentSyntaxError, normalizeAttachmentSyntax, remarkAttachmentSyntax,
} from '../syntax';

function parse(source: string, mdx = false): Root {
  const processor = unified().use(remarkParse).use(remarkGfm).use(remarkAttachmentSyntax);
  if (mdx) processor.use(remarkMdx);
  const tree = processor.parse(source);
  normalizeAttachmentSyntax(tree);
  return tree;
}

describe('attachment authoring syntax', () => {
  it('creates standard links in phrasing containers with source locations', () => {
    const source = '# **:attachment[数据/a*file.csv]:**\r\n\r\n> :attachment[group/second.csv]:\r\n';
    const tree = parse(source);
    const tokens = attachmentTokens(tree);
    expect(tokens.map(({ display, reference }) => ({ display, reference }))).toEqual([
      { display: 'inline', reference: attachmentReference('数据/a*file.csv') },
      { display: 'inline', reference: 'attachment:group/second.csv' },
    ]);
    expect(tokens[0].position?.start).toEqual({ line: 1, column: 5, offset: 4 });
    expect(tokens[1].position?.start).toEqual({ line: 3, column: 3, offset: source.indexOf(':attachment[group') });
    for (const token of tokens) {
      expect(source.slice(token.position?.start.offset, token.position?.end.offset)).toBe(token.source);
    }
    expect(toString(tree)).toBe('a*file.csvsecond.csv');
  });

  it('gives a standalone block priority over inline syntax, with surrounding whitespace', () => {
    const tree = parse('  ::attachment[group/a.csv]::  ');
    expect(attachmentTokens(tree).map((token) => token.display)).toEqual(['block']);
    expect(tree.children[0]).toMatchObject({
      type: 'paragraph',
      children: [{ type: 'link', url: 'attachment:group/a.csv', data: { attachmentDisplay: 'block' } }],
    });
  });

  it.each([
    'before ::attachment[group/a.csv]::',
    '- ::attachment[group/a.csv]::',
    '> ::attachment[group/a.csv]::',
    '::attachment[group/a.csv]:: after',
    '**::attachment[group/a.csv]::**',
    '# ::attachment[group/a.csv]::',
    '::attachment[group/a.csv]::\nother line',
    '::attachment[group/a.csv]:: :attachment[group/b.csv]:',
  ])('does not reinterpret an embedded block as an inline attachment: %s', (source) => {
    const tree = parse(source);
    expect(attachmentTokens(tree).filter((token) => token.reference === 'attachment:group/a.csv')).toEqual([]);
    expect(toString(tree)).toContain('::attachment[group/a.csv]::');
  });

  it('keeps malformed or incomplete markers literal', () => {
    for (const source of [
      '::attachment[group/a.csv]:', ':::attachment[group/a.csv]:::',
      ':attachment[group/a.csv]', ':attachment[group/a\n.csv]:',
      ':attachment[group/[a].csv]:', ':attachment[group/a.csv|label]',
    ]) expect(attachmentTokens(parse(source))).toEqual([]);
  });

  it('preserves literal backslash escapes and does not treat decoded entities as syntax', () => {
    for (const source of [
      '\\:attachment[group/a.csv]:', '\\::attachment[group/a.csv]::',
      '&#58;attachment[group/a.csv]:', ':attachment&#91;group/a.csv]:',
    ]) expect(attachmentTokens(parse(source))).toEqual([]);
    expect(attachmentTokens(parse('\\\\:attachment[group/a.csv]:'))).toHaveLength(1);
  });

  it('consumes an ID before reference definitions or Markdown formatting can split it', () => {
    const tree = parse([
      ':attachment[group/file.csv]:',
      ':attachment[group/a_*~{b}&amp;.csv]:',
      '', '[group/file.csv]: /unrelated',
    ].join('\n'), true);
    expect(attachmentTokens(tree).map((token) => token.reference)).toEqual([
      'attachment:group/file.csv', attachmentReference('group/a_*~{b}&amp;.csv'),
    ]);
  });

  it('keeps code, existing links, reference links and image labels opaque', () => {
    const marker = ':attachment[group/a.csv]:';
    const tree = parse([
      '`' + marker + '`', '', '```md', marker, '```', '',
      '    ' + marker, '',
      '[label ' + marker + '](https://example.test)', '',
      '[' + marker + '][ref]', '',
      '![' + marker + '](image.png)', '',
      '[destination](https://example.test/' + marker + ')', '',
      '<https://example.test/' + marker + '>', '',
      '[destination-ref][destination]', '',
      '[ref]: https://example.test',
      '[destination]: https://example.test/' + marker,
    ].join('\n'));
    expect(attachmentTokens(tree)).toEqual([]);
    expect(toString(tree)).toContain(marker);
  });

  it('keeps raw HTML content opaque and resumes after its closing tag', () => {
    const source = [
      '<span title=">">**:attachment[group/ignored.csv]:**</span> :attachment[group/a.csv]:',
      '',
      '<div>', '',
      ':attachment[group/ignored.csv]:', '',
      '</div>', '',
      ':attachment[group/b.csv]:',
      '',
      'before <!-- <span> --> :attachment[group/c.csv]:',
      '',
      '<br> :attachment[group/d.csv]:',
    ].join('\n');
    expect(attachmentTokens(parse(source)).map((token) => token.reference)).toEqual([
      'attachment:group/a.csv', 'attachment:group/b.csv', 'attachment:group/c.csv', 'attachment:group/d.csv',
    ]);
  });

  it('keeps MDX element children and expressions opaque', () => {
    const source = [
      '<span>:attachment[group/ignored.csv]:</span>',
      '',
      '<Box value=":attachment[group/ignored.csv]:" other={":attachment[group/ignored.csv]:"} />',
      '',
      '<Box>', '', ':attachment[group/ignored.csv]:', '', '</Box>',
      '',
      '{":attachment[group/ignored.csv]:"}', '',
      "export const marker = ':attachment[group/ignored.csv]:'", '',
      '**:attachment[group/a.csv]:**',
    ].join('\n');
    expect(attachmentTokens(parse(source, true)).map((token) => token.reference)).toEqual(['attachment:group/a.csv']);
  });

  it('normalizes Unicode and spaces while decoding percent escapes once', () => {
    const tokens = attachmentTokens(parse(':attachment[文档/数据 1.csv]: :attachment[group/%2520%5D.csv]:'));
    expect(tokens.map((token) => token.reference)).toEqual([
      attachmentReference('文档/数据 1.csv'), attachmentReference('group/%20].csv'),
    ]);
  });

  it.each([
    ':attachment[]:', ':attachment[../private]:', ':attachment[group%2Ffile.csv]:',
    ':attachment[group/%5Cfile.csv]:', ':attachment[group/%oops]:',
  ])('reports active invalid IDs at their source location: %s', (marker) => {
    let caught: unknown;
    try { parse('intro\n\n  ' + marker); } catch (error) { caught = error; }
    expect(caught).toBeInstanceOf(AttachmentSyntaxError);
    expect(caught).toMatchObject({ line: 3, column: 3, reason: expect.stringContaining('Invalid attachment syntax') });
  });

  it('does not validate inactive examples as attachment paths', () => {
    const tree = parse('[example :attachment[../private]:](https://example.test)\n\n<span>:attachment[%oops]:</span>');
    expect(attachmentTokens(tree)).toEqual([]);
  });

  it('provides VFile diagnostics and remains idempotent on normalized trees', () => {
    const file = new VFile({ path: 'fixture.md', value: ':attachment[../private]:' });
    const processor = unified().use(remarkParse).use(remarkAttachmentSyntax);
    expect(() => normalizeAttachmentSyntax(processor.parse(file), file)).toThrow();
    expect(file.messages[0]).toMatchObject({ source: 'attachment-syntax', ruleId: 'invalid-id', line: 1, column: 1 });
    const tree = parse('**:attachment[group/a.csv]:**');
    const before = JSON.stringify(tree);
    normalizeAttachmentSyntax(tree);
    expect(JSON.stringify(tree)).toBe(before);
  });

  it('formats references without custom labels, structural punctuation or double encoding', () => {
    const reference = attachmentReference("文档/a [b] % '().csv");
    expect(attachmentInlineSyntax(reference)).toBe(':attachment[%E6%96%87%E6%A1%A3/a%20%5Bb%5D%20%25%20%27%28%29.csv]:');
    expect(attachmentBlockSyntax(reference)).toBe('::attachment[%E6%96%87%E6%A1%A3/a%20%5Bb%5D%20%25%20%27%28%29.csv]::');
    expect(attachmentTokens(parse(attachmentBlockSyntax(reference)))[0].reference).toBe(reference);
    expect(() => attachmentInlineSyntax('/downloads/file.csv')).toThrow(AttachmentSyntaxError);
  });
});
