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
import { attachmentBlockSyntax, attachmentInlineSyntax } from '~/lib/attachments/syntax';
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

describe('attachment DSL across renderers', () => {
  it('keeps inline metadata consistent across Markdown and MDX', async () => {
    const reference = attachmentReference(id);
    const source = `原始数据 ${attachmentInlineSyntax(reference)}\n\n**重复引用 ${attachmentInlineSyntax(reference)}**`;
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
      expect(rendered).toContain('结果 (100%).csv · text/csv · 9 B</a>');
      expect(rendered).toContain('text/csv');
      expect(rendered).not.toContain('href="attachment:');
      expect(rendered).not.toContain(':attachment[');
    }
  });

  it('renders a bounded block card with table content and static actions', async () => {
    const source = attachmentBlockSyntax(attachmentReference(id));
    const result = await unified().use(remarkParse)
      .use(remarkAttachments, options).use(remarkRehype).use(rehypeStringify).process(source);
    const html = String(result);
    expect(html).toContain('<figure class="attachment-card not-prose"');
    expect(html).toContain('data-attachment-card');
    expect(html).toContain('<table class="attachment-card__table"');
    expect(html).toContain('<th scope="col">value</th>');
    expect(html).toContain('<td>42</td>');
    expect(html).toContain('data-attachment-fullscreen');
    expect(html).toContain(`href="${path}"`);
    expect(html).not.toContain(':attachment[');
  });

  it('escapes active text attachments instead of executing their source', async () => {
    const activeId = '数据/page.html';
    await writeFile(join(options.directory, activeId), '<script>alert("x")</script>');
    const html = await renderMarkdown(attachmentBlockSyntax(attachmentReference(activeId)));
    expect(html).toContain('astro-code');
    expect(html).toContain('alert');
    expect(html).toContain('&#x3C;');
    expect(html).not.toContain('<script>alert');
  });

  it('exports the current unsaved Markdown with an absolute public URL', async () => {
    const response = await exportWechat({
      request: new Request('http://localhost/api/editor/wechat-export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: attachmentBlockSyntax(attachmentReference(id)), slug: 'unsaved-fixture' }),
      }),
    } as Parameters<typeof exportWechat>[0]);
    const body = await response.json();
    expect(response.status, JSON.stringify(body)).toBe(200);
    expect(body.html).toContain(`href="https://example.test${path}"`);
    expect(body.html).toContain('结果 (100%).csv');
    expect(body.html).toContain('text / csv');
    expect(body.html).toContain('9 B</a>');
    expect(body.html).not.toContain('attachment-card');
  });

  it('leaves ordinary URLs and fenced examples alone', async () => {
    const source = '[文档](https://example.test/docs)\n\n`:attachment[missing.csv]:`\n\n```md\n::attachment[missing.csv]::\n```';
    const result = await unified().use(remarkParse)
      .use(remarkAttachments, options).use(remarkRehype).use(rehypeStringify).process(source);
    expect(String(result)).toContain('href="https://example.test/docs"');
    expect(String(result)).not.toContain('download=');
    await expect(validateAttachmentMarkdown(source, options, { file: 'examples.md' })).resolves.toBeUndefined();
  });

  it('reports the source location for missing or unsafe references', async () => {
    for (const source of [':attachment[missing.csv]:', ':attachment[../private.csv]:', ':attachment[%2Fetc]:']) {
      await expect(validateAttachmentMarkdown(`---\ntitle: test\n---\n\n${source}`, options, {
        file: '/posts/example/index.mdx', mdx: true,
      })).rejects.toMatchObject({ line: 5, fatal: true });
    }
  });

  it('rejects the legacy custom-scheme link with a migration diagnostic', async () => {
    const reference = attachmentReference(id);
    for (const source of [
      `[文件](${reference})`,
      `![文件](${reference})`,
      `[文件][data]\n\n[data]: ${reference}`,
      `![文件][data]\n\n[data]: ${reference}`,
      `<${reference}>`,
      `[文件](attachment&#58;${reference.slice('attachment:'.length)})`,
    ]) {
      await expect(renderMarkdown(source)).rejects.toThrow('Legacy attachment links');
    }
  });
});

describe('source validation independent of the render cache', () => {
  it('checks nested MD and MDX posts plus thought content after a file is removed', async () => {
    const postsDirectory = join(directory, 'posts');
    const thoughtsDirectory = join(directory, 'thoughts');
    await mkdir(join(postsDirectory, 'nested', 'article'), { recursive: true });
    await mkdir(thoughtsDirectory);
    const source = attachmentInlineSyntax(attachmentReference(id));
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
