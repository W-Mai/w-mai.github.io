import { beforeEach, describe, expect, it, vi } from 'vitest';
import { attachmentPlainText, prepareAttachmentText } from '../attachments/text';
import { attachmentReference } from '../attachments/paths';
import { attachmentInlineSyntax, attachmentBlockSyntax } from '../attachments/syntax';
import { stripMdx } from '../search/content';
import { stripMarkdown, countWords } from '../blog/reading-stats';

const { getCollection, loadThoughts, rss, renderToPng, loadSticker } = vi.hoisted(() => ({
  getCollection: vi.fn(async () => []),
  loadThoughts: vi.fn(async () => [] as any[]),
  rss: vi.fn(async (options: unknown) => options),
  renderToPng: vi.fn(async (_tree: unknown) => new Uint8Array()),
  loadSticker: vi.fn(() => null),
}));
vi.mock('astro:content', () => ({ getCollection }));
vi.mock('~/data/thoughts', () => ({ loadThoughts }));
vi.mock('~/data/friends', () => ({ loadFriends: async () => [] }));
vi.mock('~/data/wishes', () => ({ loadWishes: async () => [] }));
vi.mock('@astrojs/rss', () => ({ default: rss }));
vi.mock('~/lib/og-utils', () => ({ renderToPng, pngResponse: () => new Response() }));
vi.mock('~/lib/sticker', () => ({
  INLINE_STICKER_RE: /:sticker\[([^\]]+)\]:/g,
  BLOCK_STICKER_RE: /^::sticker\[([^\]]+)\]::$/,
  loadSticker,
  imageDimensions: vi.fn(),
  fitSize: vi.fn(),
}));

beforeEach(() => vi.clearAllMocks());

function textLeaves(node: any): string {
  if (typeof node === 'string') return node;
  if (Array.isArray(node)) return node.map(textLeaves).join('');
  return node?.props ? textLeaves(node.props.children) : '';
}

describe('attachment text output boundaries', () => {
  it('replaces only active tokens, with exact basenames and percent decoding once', () => {
    const source = '**:attachment[目录/数据 1.csv]:**\n\n::attachment[group/%2520%5D.csv]::';
    expect(attachmentPlainText(source)).toBe('**数据 1.csv**\n\n%20].csv');
    expect(attachmentPlainText('before ::attachment[group/a.csv]::')).toBe('before ::attachment[group/a.csv]::');
  });

  it('preserves examples in code, links, HTML, escapes and frontmatter', () => {
    const marker = ':attachment[group/a.csv]:';
    const source = [
      '---', 'description: ' + marker, '---', '',
      '`' + marker + '`', '', '```', marker, '```', '',
      '[example ' + marker + '](https://example.test)', '',
      '<span>' + marker + '</span>', '', '\\' + marker,
    ].join('\n');
    expect(attachmentPlainText(source)).toBe(source);
  });

  it('honors MDX boundaries without making ordinary Markdown braces invalid', () => {
    const source = '<Box>\n\n:attachment[group/a.csv]:\n\n</Box>\n\n{":attachment[group/a.csv]:"}';
    expect(attachmentPlainText(source, { mdx: true })).toBe(source);
    expect(attachmentPlainText('unfinished { text\n\n:attachment[group/a.csv]:', { mdx: 'auto' }))
      .toBe('unfinished { text\n\na.csv');
  });

  it('protects filenames until downstream formatting has finished', () => {
    const name = ':sticker[secret]: **raw**.txt';
    const marker = attachmentInlineSyntax(attachmentReference('group/' + name));
    const prepared = prepareAttachmentText(marker);
    expect(prepared.source).not.toContain(name);
    expect(prepared.restore(prepared.source.replace(/::?sticker\[[^\]]*\]::?/g, ''))).toBe(name);
    expect(stripMdx(marker)).toBe(name);
    expect(stripMarkdown(marker)).toBe(name);
  });

  it('reuses parsed positions without caching caller-specific formatting', () => {
    const marker = attachmentInlineSyntax(attachmentReference('group/data.csv'));
    expect(attachmentPlainText(marker)).toBe('data.csv');
    const decorated = prepareAttachmentText(marker, { format: (name) => `file: ${name}` });
    expect(decorated.restore(decorated.source)).toBe('file: data.csv');
    expect(attachmentPlainText(marker)).toBe('data.csv');
  });

  it('retains each existing stripping policy for code examples', () => {
    const source = [
      ':attachment[group/visible.csv]:', '',
      '`:attachment[group/example.csv]:`', '',
      '```md', ':attachment[group/fenced.csv]:', '```',
    ].join('\n');
    const search = stripMdx(source);
    expect(search).toContain('visible.csv');
    expect(search).toContain(':attachment[group/example.csv]:');
    expect(search).not.toContain('fenced.csv');
    const stats = stripMarkdown(source);
    expect(stats).toBe('visible.csv');
    expect(countWords(stats).total).toBe(1);
  });

  it('uses filenames in search thought title, description and body before truncation', async () => {
    loadThoughts.mockResolvedValueOnce([{
      id: 'note', content: ':attachment[very-long-directory-name/data.csv]:\n\n::attachment[group/report.json]::',
      createdAt: '2026-01-02', tags: ['files'],
    }]);
    const { GET } = await import('~/pages/search-index.json');
    const response = await GET({} as never);
    const entries = await response.json();
    expect(entries[0]).toMatchObject({
      id: 'thought-note', title: 'data.csv\n\nreport.json',
      description: 'data.csv\n\nreport.json', body: 'data.csv\n\nreport.json',
    });
    expect(JSON.stringify(entries)).not.toContain(':attachment[');
  });

  it('uses filenames in RSS titles and descriptions without parsing filename markup', async () => {
    const name = ':sticker[secret]: report.csv';
    loadThoughts.mockResolvedValueOnce([{
      id: 'note', content: attachmentBlockSyntax(attachmentReference('group/' + name)),
      createdAt: '2026-01-02',
    }]);
    const { GET } = await import('~/pages/rss.xml.js');
    await GET({ site: new URL('https://example.test') });
    expect(rss.mock.calls[0][0]).toMatchObject({
      items: [{ title: '💭 ' + name, description: name }],
    });
  });

  it('renders an OG file icon and literal basename without loading the attachment', async () => {
    const name = ':sticker[secret]: **literal**.csv';
    const content = attachmentBlockSyntax(attachmentReference('group/' + name));
    const { GET } = await import('~/pages/og/thoughts/[id].png');
    await GET({ props: { content, createdAt: '2026-01-02', tags: [] } } as never);
    expect(textLeaves(renderToPng.mock.calls[0][0])).toContain('📄 ' + name);
    expect(textLeaves(renderToPng.mock.calls[0][0])).not.toContain(':attachment[');
    expect(loadSticker).not.toHaveBeenCalled();
  });

  it('keeps an OG inline-code example literal rather than attaching a file icon', async () => {
    const { GET } = await import('~/pages/og/thoughts/[id].png');
    await GET({
      props: { content: '`:attachment[group/example.csv]:`', createdAt: '2026-01-02', tags: [] },
    } as never);
    const text = textLeaves(renderToPng.mock.calls[0][0]);
    expect(text).toContain(':attachment[group/example.csv]:');
    expect(text).not.toContain('📄');
  });
});
