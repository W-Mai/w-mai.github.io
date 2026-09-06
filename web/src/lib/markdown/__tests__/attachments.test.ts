import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mkdtemp, mkdir, readFile, realpath, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkRehype from 'remark-rehype';
import rehypeStringify from 'rehype-stringify';
import { evaluate } from '@mdx-js/mdx';
import * as runtime from 'react/jsx-runtime';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { attachmentReference } from '~/lib/attachments/paths';
import { validateAttachmentContentFiles, validateAttachmentMarkdown } from '~/lib/attachments/validate';
import remarkAttachments from '../remark-attachments';

const options = vi.hoisted(() => ({
  directory: '',
  base: '/journal/',
  site: 'https://example.test',
}));
vi.mock('virtual:attachments/config', () => ({ default: options }));

import { renderMarkdown } from '../markdown';
import { POST as exportWechat } from '~/lib/editor/routes/wechat-export';

let directory: string;
const id = '数据/结果 (100%).csv';
const encoded = '%E6%95%B0%E6%8D%AE/%E7%BB%93%E6%9E%9C%20%28100%25%29.csv';
const path = `/journal/downloads/${encoded}`;

beforeEach(async () => {
  directory = await realpath(await mkdtemp(join(tmpdir(), 'attachment-markdown-')));
  options.directory = join(directory, 'attachments');
  await mkdir(join(options.directory, '数据'), { recursive: true });
  await writeFile(join(options.directory, id), 'value\n42\n');
});

afterEach(async () => {
  await rm(directory, { recursive: true, force: true });
});

describe('attachment references across renderers', () => {
  it('keeps labels and metadata consistent across Markdown and MDX', async () => {
    const reference = attachmentReference(id);
    const source = `[原始数据](${reference})\n\n[重复引用][data]\n\n[data]: ${reference}`;
    const html = await renderMarkdown(source);
    const mdx = await evaluate(source, {
      ...runtime,
      remarkPlugins: [[remarkAttachments, options]],
    });
    const mdxHtml = renderToStaticMarkup(createElement(mdx.default));
    for (const rendered of [html, mdxHtml]) {
      expect(rendered.match(/href="/g)).toHaveLength(2);
      expect(rendered).toContain(`href="${path}"`);
      expect(rendered).toContain('download="结果 (100%).csv"');
      expect(rendered).toContain('原始数据</a>');
      expect(rendered).toContain('重复引用</a>');
      expect(rendered).toContain('text/csv');
      expect(rendered).not.toContain('href="attachment:');
    }
  });

  it('exports the current unsaved Markdown with an absolute public URL', async () => {
    const response = await exportWechat({
      request: new Request('http://localhost/api/editor/wechat-export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: `[下载](${attachmentReference(id)})`, slug: 'unsaved-fixture' }),
      }),
    } as Parameters<typeof exportWechat>[0]);
    const body = await response.json();
    expect(response.status, JSON.stringify(body)).toBe(200);
    expect(body.html).toContain(`href="https://example.test${path}"`);
    expect(body.html).toContain('下载</a>');
  });

  it('leaves ordinary URLs and fenced examples alone', async () => {
    const source = '[文档](https://example.test/docs)\n\n`[示例](attachment:missing.csv)`\n\n```md\n[示例](attachment:missing.csv)\n```';
    const result = await unified().use(remarkParse)
      .use(remarkAttachments, options).use(remarkRehype).use(rehypeStringify).process(source);
    expect(String(result)).toContain('href="https://example.test/docs"');
    expect(String(result)).not.toContain('download=');
    await expect(validateAttachmentMarkdown(source, options, { file: 'examples.md' })).resolves.toBeUndefined();
  });

  it('reports the source location for missing or unsafe references', async () => {
    for (const reference of ['attachment:missing.csv', 'attachment:../private.csv', 'attachment&#58;missing.csv', 'attachment\\:missing.csv']) {
      await expect(validateAttachmentMarkdown(`---\ntitle: test\n---\n\n[下载](${reference})`, options, {
        file: '/posts/example/index.mdx', mdx: true,
      })).rejects.toMatchObject({ line: 5, fatal: true });
    }
  });

  it('rejects image syntax instead of leaving an unresolved custom protocol', async () => {
    await expect(renderMarkdown(`![文件](${attachmentReference(id)})`)).rejects.toThrow('Markdown link');
  });
});

describe('source validation independent of the render cache', () => {
  it('checks nested MD and MDX posts plus thought content after a file is removed', async () => {
    const postsDirectory = join(directory, 'posts');
    const thoughtsDirectory = join(directory, 'thoughts');
    await mkdir(join(postsDirectory, 'nested', 'article'), { recursive: true });
    await mkdir(thoughtsDirectory);
    const source = `[数据](${attachmentReference(id)})`;
    await writeFile(join(postsDirectory, 'plain.md'), source);
    await writeFile(join(postsDirectory, 'nested', 'article', 'index.mdx'), source);
    await writeFile(join(thoughtsDirectory, 'example.yaml'), `content: '${source}'\ncreatedAt: '2026-09-06'\n`);
    const contentDirectories = { postsDirectory, thoughtsDirectory };
    await validateAttachmentContentFiles(options, contentDirectories);
    await readFile(join(options.directory, id));
    await rm(join(options.directory, id));
    await expect(validateAttachmentContentFiles(options, contentDirectories)).rejects.toThrow('plain.md');
    await expect(validateAttachmentContentFiles(options, contentDirectories)).rejects.toThrow('index.mdx');
    await expect(validateAttachmentContentFiles(options, contentDirectories)).rejects.toThrow('example.yaml');
  });
});
