import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mkdtemp, mkdir, realpath, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { JSDOM } from 'jsdom';
import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkRehype from 'remark-rehype';
import rehypeStringify from 'rehype-stringify';
import { evaluate } from '@mdx-js/mdx';
import * as runtime from 'react/jsx-runtime';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { attachmentBlockSyntax } from '~/lib/attachments/syntax';
import { attachmentReference, attachmentUrl } from '~/lib/attachments/paths';
import { installAttachmentPreviews } from '~/components/shared/attachment-viewer';
import remarkAttachments from '../remark-attachments';

let directory: string;
const windows: JSDOM[] = [];
const cleanups: Array<() => void> = [];
const options = { directory: '', base: '/journal/', site: 'https://example.test' };

beforeEach(async () => {
  directory = await realpath(await mkdtemp(join(tmpdir(), 'attachment-dom-')));
  options.directory = join(directory, 'attachments');
  await mkdir(join(options.directory, 'group'), { recursive: true });
});
afterEach(async () => {
  cleanups.splice(0).forEach((cleanup) => cleanup());
  windows.splice(0).forEach((dom) => dom.window.close());
  await rm(directory, { recursive: true, force: true });
});

async function render(name: string, content: string, mdx = false) {
  const id = `group/${name}`;
  await writeFile(join(options.directory, id), content);
  const source = attachmentBlockSyntax(attachmentReference(id));
  const html = mdx
    ? renderToStaticMarkup(createElement((await evaluate(source, {
      ...runtime, remarkPlugins: [[remarkAttachments, options]],
    })).default))
    : String(await unified().use(remarkParse).use(remarkAttachments, options)
      .use(remarkRehype).use(rehypeStringify).process(source));
  const dom = new JSDOM(`<article class="prose">${html}</article>`, { url: options.site });
  windows.push(dom);
  const doc = dom.window.document;
  const card = doc.querySelector<HTMLElement>('[data-attachment-card]')!;
  return { html, doc, card, dom, url: attachmentUrl(id, options.base) };
}

describe('attachment renderer and public viewer contract', () => {
  it.each([
    ['drawing.svg', '<svg><script>alert(1)</script></svg>', 'image', 'img'],
    ['report.pdf', '%PDF fixture', 'pdf', 'attachment-pdf-preview'],
    ['sound.mp3', 'media fixture', 'audio', 'audio'],
    ['movie.mp4', 'media fixture', 'video', 'video'],
    ['source.html', '<script>alert(1)</script>', 'text', 'pre > code'],
    ['values.json', '{"value":42}', 'json', 'pre > code'],
    ['values.csv', 'name,value\n"<img src=x>",42', 'table', 'table'],
    ['bundle.zip', 'binary fixture', 'binary', '.attachment-card__placeholder'],
  ])('renders %s with semantic controls and a stable preview container', async (name, content, kind, selector) => {
    const { doc, card, url } = await render(name, content);
    expect(card?.tagName).toBe('FIGURE');
    expect(card.parentElement?.tagName).toBe('ARTICLE');
    expect(card.getAttribute('aria-label')).toBe(`${name} — 附件预览`);
    expect(card.dataset.attachmentName).toBe(name);
    expect(card.dataset.attachmentMedia).toBeTruthy();
    const preview = card.querySelector<HTMLElement>('.attachment-card__preview')!;
    expect(preview.classList.contains(`attachment-card__preview--${kind}`)).toBe(true);
    expect(preview.querySelector(selector)).not.toBeNull();
    expect(card.querySelector('.attachment-card__name')?.textContent).toBe(name);
    const download = card.querySelector<HTMLAnchorElement>('.attachment-card__download')!;
    expect(download.getAttribute('href')).toBe(url);
    expect(download.download).toBe(name);
    expect(download.type).toBe(card.dataset.attachmentMedia);
    expect(download.getAttribute('aria-label')).toBe(`下载 ${name}`);
    expect(download.textContent).toBe('');
    expect(download.querySelector('svg')?.getAttribute('aria-hidden')).toBe('true');
    expect(download.querySelectorAll('path')).toHaveLength(3);
    const fullscreen = card.querySelector<HTMLButtonElement>('[data-attachment-fullscreen]')!;
    expect(fullscreen.hidden).toBe(true);
    expect(fullscreen.type).toBe('button');
    expect(fullscreen.getAttribute('aria-haspopup')).toBe('dialog');
    expect(fullscreen.getAttribute('aria-label')).toContain(name);
    expect(fullscreen.textContent).toBe('');
    expect(fullscreen.querySelector('svg')?.getAttribute('aria-hidden')).toBe('true');
    expect(fullscreen.querySelectorAll('path')).toHaveLength(4);
    expect(doc.querySelector('script')).toBeNull();
    if (['text', 'json', 'table'].includes(kind)) {
      expect(preview.tabIndex).toBe(0);
      expect(preview.getAttribute('role')).toBe('region');
      expect(preview.getAttribute('aria-label')).toContain(name);
    }
    if (kind === 'image') {
      const image = preview.querySelector('img')!;
      expect(image.getAttribute('src')).toBe(url);
      expect(image.alt).toBe(name);
      expect(image.getAttribute('loading')).toBe('lazy');
      expect(preview.querySelector('svg')).toBeNull();
    }
    if (kind === 'pdf') {
      const renderer = preview.querySelector('attachment-pdf-preview')!;
      expect(renderer.getAttribute('data-attachment-pdf-src')).toBe(url);
      expect(renderer.getAttribute('data-attachment-pdf-size')).toBe(String(content.length));
      expect(renderer.getAttribute('aria-label')).toContain(name);
      expect(preview.querySelector('iframe')).toBeNull();
      expect(renderer.querySelector('script')).toBeNull();
    }
    if (kind === 'audio' || kind === 'video') {
      const media = preview.querySelector<HTMLMediaElement>(kind)!;
      expect(media.controls).toBe(true);
      expect(media.preload).toBe('metadata');
      expect(media.getAttribute('src')).toBe(url);
      expect(media.getAttribute('aria-label')).toContain(name);
      expect(media.querySelector('a[download]')?.getAttribute('href')).toBe(url);
      if (kind === 'video') expect(media.hasAttribute('playsinline')).toBe(true);
    }
    if (kind === 'table') {
      expect(preview.querySelector('table')?.getAttribute('aria-label')).toContain(name);
      expect(preview.querySelector('th')?.scope).toBe('col');
      expect(preview.querySelector('td')?.textContent).toBe('<img src=x>');
      expect(preview.querySelector('img')).toBeNull();
    }
  });

  it('preserves the same semantic card through MDX and moves its keyboard scroll region unchanged', async () => {
    const name = '数据 " onmouseover="alert(1) <tag>.csv';
    const { doc, card, dom } = await render(name, 'value\n42', true);
    const preview = card.querySelector<HTMLElement>('.attachment-card__preview')!;
    const trigger = card.querySelector<HTMLButtonElement>('[data-attachment-fullscreen]')!;
    expect(card.dataset.attachmentName).toBe(name);
    expect(card.querySelector<HTMLAnchorElement>('.attachment-card__download')?.download).toBe(name);
    expect(doc.querySelector('tag')).toBeNull();
    expect([...doc.querySelectorAll('*')].some((element) => element.hasAttribute('onmouseover'))).toBe(false);
    Object.defineProperty(dom.window.HTMLDialogElement.prototype, 'showModal', {
      configurable: true, value: function (this: HTMLDialogElement) { this.setAttribute('open', ''); },
    });
    Object.defineProperty(dom.window.HTMLDialogElement.prototype, 'close', {
      configurable: true, value: function (this: HTMLDialogElement) { this.removeAttribute('open'); },
    });
    cleanups.push(installAttachmentPreviews(doc));
    trigger.click();
    const dialog = doc.querySelector('dialog')!;
    expect(dialog.querySelector('.attachment-card__preview')).toBe(preview);
    expect(preview.tabIndex).toBe(0);
    expect(preview.getAttribute('aria-label')).toContain(name);
    expect(doc.querySelector('tag')).toBeNull();
    dialog.querySelector<HTMLButtonElement>('.attachment-dialog__close')!.click();
    expect(preview.parentElement).toBe(card);
    expect(doc.activeElement).toBe(trigger);
  });

  it('labels empty tables as empty content instead of an unsupported file type', async () => {
    const { card } = await render('empty.csv', '');
    expect(card.querySelector('.attachment-card__placeholder')?.textContent).toContain('没有可预览的数据');
    expect(card.textContent).not.toContain('此文件类型不提供');
  });
});
