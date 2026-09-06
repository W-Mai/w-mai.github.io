// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const registerAttachmentPdf = vi.hoisted(() => vi.fn());
vi.mock('../attachment-pdf', () => ({ registerAttachmentPdf }));

import { installAttachmentPreviews } from '../attachment-viewer';

let dispose: (() => void) | undefined;
let showModal: ReturnType<typeof vi.fn>;
let closeModal: ReturnType<typeof vi.fn>;
let pause: ReturnType<typeof vi.spyOn>;
const originalShow = Object.getOwnPropertyDescriptor(HTMLDialogElement.prototype, 'showModal');
const originalClose = Object.getOwnPropertyDescriptor(HTMLDialogElement.prototype, 'close');

function card(name = 'data.csv') {
  const item = document.createElement('figure');
  item.className = 'attachment-card';
  item.dataset.attachmentCard = '';
  item.dataset.attachmentName = name;
  item.innerHTML = `
    <header class="attachment-card__header">
      <strong class="attachment-card__name"></strong>
      <p class="attachment-card__meta">text/csv · 2 KiB</p>
      <div class="attachment-card__actions">
        <a class="attachment-card__download" href="/journal/downloads/data.csv" download="data.csv"><svg><path d="download"></path></svg></a>
        <button data-attachment-fullscreen hidden type="button"><svg><path d="fullscreen"></path></svg></button>
      </div>
    </header>
    <div class="attachment-card__preview" tabindex="0"><pre><code>first\nsecond</code></pre><video controls></video></div>
    <p class="attachment-card__status">预览</p>`;
  item.querySelector('.attachment-card__name')!.textContent = name;
  document.body.append(item);
  const trigger = item.querySelector<HTMLButtonElement>('[data-attachment-fullscreen]')!;
  const preview = item.querySelector<HTMLElement>('.attachment-card__preview')!;
  return { item, trigger, preview };
}

beforeEach(() => {
  registerAttachmentPdf.mockClear();
  document.body.replaceChildren();
  document.documentElement.style.removeProperty('overflow');
  showModal = vi.fn(function (this: HTMLDialogElement) { this.setAttribute('open', ''); });
  closeModal = vi.fn(function (this: HTMLDialogElement) {
    this.removeAttribute('open');
    this.dispatchEvent(new Event('close'));
  });
  Object.defineProperty(HTMLDialogElement.prototype, 'showModal', { configurable: true, value: showModal });
  Object.defineProperty(HTMLDialogElement.prototype, 'close', { configurable: true, value: closeModal });
  pause = vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => {});
});

afterEach(() => {
  dispose?.();
  dispose = undefined;
  vi.restoreAllMocks();
  if (originalShow) Object.defineProperty(HTMLDialogElement.prototype, 'showModal', originalShow);
  else Reflect.deleteProperty(HTMLDialogElement.prototype, 'showModal');
  if (originalClose) Object.defineProperty(HTMLDialogElement.prototype, 'close', originalClose);
  else Reflect.deleteProperty(HTMLDialogElement.prototype, 'close');
  document.body.replaceChildren();
  document.documentElement.style.removeProperty('overflow');
});

describe('public attachment viewport viewer', () => {
  it('preserves static downloads and only enables valid card controls', () => {
    const { item, trigger } = card();
    const download = item.querySelector<HTMLAnchorElement>('.attachment-card__download')!;
    const orphan = document.createElement('button');
    orphan.dataset.attachmentFullscreen = '';
    orphan.hidden = true;
    document.body.append(orphan);
    expect(trigger.hidden).toBe(true);
    expect(download.getAttribute('href')).toBe('/journal/downloads/data.csv');
    dispose = installAttachmentPreviews();
    expect(trigger.hidden).toBe(false);
    expect(orphan.hidden).toBe(true);
    expect(download.download).toBe('data.csv');
  });

  it('moves the same node, safely labels the dialog and restores position, focus and scroll lock', () => {
    const { item, trigger, preview } = card('<img src=x onerror=alert(1)>.csv');
    const status = item.querySelector('.attachment-card__status');
    document.documentElement.style.setProperty('overflow', 'clip', 'important');
    preview.scrollTop = 25;
    preview.scrollLeft = 10;
    dispose = installAttachmentPreviews();
    trigger.querySelector('path')!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    const dialog = document.querySelector<HTMLDialogElement>('dialog')!;
    expect(dialog.open).toBe(true);
    expect(dialog.querySelector('.attachment-card__preview')).toBe(preview);
    expect(item.contains(preview)).toBe(false);
    expect(document.querySelectorAll('.attachment-card__preview')).toHaveLength(1);
    expect(dialog.querySelector('img')).toBeNull();
    expect(dialog.getAttribute('aria-label')).toContain('<img src=x onerror=alert(1)>.csv');
    const dialogDownload = dialog.querySelector<HTMLAnchorElement>('.attachment-card__download')!;
    expect(dialogDownload.download).toBe('data.csv');
    expect(dialogDownload.textContent).toBe('');
    expect(dialogDownload.querySelectorAll('path')).toHaveLength(3);
    expect(dialog.querySelector('.attachment-dialog__close')?.textContent).toBe('');
    expect(dialog.querySelector('.attachment-dialog__close svg')).not.toBeNull();
    expect(document.documentElement.style.overflow).toBe('hidden');
    expect(document.activeElement).toBe(dialog.querySelector('.attachment-dialog__close'));
    preview.scrollTop = 40;
    dialog.querySelector<HTMLButtonElement>('.attachment-dialog__close')!.click();
    expect(dialog.open).toBe(false);
    expect(preview.parentElement).toBe(item);
    expect(preview.nextElementSibling).toBe(status);
    expect(preview.scrollTop).toBe(40);
    expect(preview.scrollLeft).toBe(10);
    expect(pause).toHaveBeenCalledOnce();
    expect(document.activeElement).toBe(trigger);
    expect(document.documentElement.style.overflow).toBe('clip');
    expect(document.documentElement.style.getPropertyPriority('overflow')).toBe('important');
  });

  it('keeps truncation notices visible in the dialog and clears them for other cards', () => {
    const first = card('large.csv');
    first.item.querySelector('.attachment-card__status')!.textContent = '预览已截断，下载可查看完整文件';
    const second = card('small.csv');
    second.item.querySelector('.attachment-card__status')!.remove();
    dispose = installAttachmentPreviews();
    first.trigger.click();
    const status = document.querySelector<HTMLElement>('dialog .attachment-card__status')!;
    expect(status.hidden).toBe(false);
    expect(status.textContent).toBe('预览已截断，下载可查看完整文件');
    second.trigger.click();
    expect(status.hidden).toBe(true);
    expect(status.textContent).toBe('');
  });

  it('consumes Escape before global reading shortcuts, then stops intercepting it', () => {
    const { trigger } = card();
    const readingShortcut = vi.fn();
    document.addEventListener('keydown', readingShortcut);
    dispose = installAttachmentPreviews();
    trigger.click();
    const escape = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true });
    document.activeElement!.dispatchEvent(escape);
    expect(escape.defaultPrevented).toBe(true);
    expect(readingShortcut).not.toHaveBeenCalled();
    expect(document.querySelector<HTMLDialogElement>('dialog')!.open).toBe(false);
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(readingShortcut).toHaveBeenCalledOnce();
    document.removeEventListener('keydown', readingShortcut);
  });

  it('closes on native cancel and outside backdrop, without closing for inner padding', () => {
    const { trigger } = card();
    dispose = installAttachmentPreviews();
    trigger.click();
    const dialog = document.querySelector<HTMLDialogElement>('dialog')!;
    vi.spyOn(dialog, 'getBoundingClientRect').mockReturnValue({ left: 10, top: 10, right: 300, bottom: 200 } as DOMRect);
    dialog.dispatchEvent(new MouseEvent('click', { clientX: 20, clientY: 20, bubbles: true }));
    expect(dialog.open).toBe(true);
    dialog.dispatchEvent(new MouseEvent('click', { clientX: 2, clientY: 2, bubbles: true }));
    expect(dialog.open).toBe(false);
    trigger.click();
    const cancel = new Event('cancel', { cancelable: true });
    dialog.dispatchEvent(cancel);
    expect(cancel.defaultPrevented).toBe(true);
    expect(dialog.open).toBe(false);
  });

  it('reuses a single dialog and ignores a delayed close event after reopening', () => {
    const first = card('first.csv');
    const second = card('second.csv');
    dispose = installAttachmentPreviews();
    first.trigger.click();
    second.trigger.click();
    const dialog = document.querySelector<HTMLDialogElement>('dialog')!;
    expect(document.querySelectorAll('dialog')).toHaveLength(1);
    expect(first.preview.parentElement).toBe(first.item);
    expect(dialog.querySelector('.attachment-card__preview')).toBe(second.preview);
    dialog.dispatchEvent(new Event('close'));
    expect(dialog.open).toBe(true);
    expect(dialog.querySelector('.attachment-card__preview')).toBe(second.preview);
  });

  it('cleans the old page before swap and binds a new page without duplicate listeners', () => {
    const first = card();
    dispose = installAttachmentPreviews();
    expect(installAttachmentPreviews()).toBe(dispose);
    document.dispatchEvent(new Event('astro:page-load'));
    document.dispatchEvent(new Event('astro:page-load'));
    first.trigger.click();
    expect(showModal).toHaveBeenCalledTimes(1);
    document.dispatchEvent(new Event('astro:before-swap'));
    expect(document.querySelector('dialog')).toBeNull();
    expect(first.preview.parentElement).toBe(first.item);
    expect(document.documentElement.style.overflow).toBe('');
    expect(first.trigger.hidden).toBe(true);
    document.body.replaceChildren();
    const second = card('second.csv');
    document.dispatchEvent(new Event('astro:page-load'));
    second.trigger.click();
    expect(showModal).toHaveBeenCalledTimes(2);
    expect(document.querySelector('dialog')!.contains(second.preview)).toBe(true);
  });

  it('does not re-enable old controls through queued DOM mutations during a swap', async () => {
    const { trigger, preview, item } = card();
    dispose = installAttachmentPreviews();
    trigger.click();
    document.dispatchEvent(new Event('astro:before-swap'));
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(trigger.hidden).toBe(true);
    expect(preview.parentElement).toBe(item);
    expect(document.querySelector('dialog')).toBeNull();
    document.dispatchEvent(new Event('astro:page-load'));
    expect(trigger.hidden).toBe(false);
  });

  it('enhances dynamically inserted cards and fully removes listeners on disposal', async () => {
    dispose = installAttachmentPreviews();
    const { trigger, preview, item } = card();
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(trigger.hidden).toBe(false);
    trigger.click();
    dispose();
    dispose = undefined;
    expect(preview.parentElement).toBe(item);
    expect(trigger.hidden).toBe(true);
    expect(document.querySelector('dialog')).toBeNull();
    trigger.hidden = false;
    trigger.click();
    expect(showModal).toHaveBeenCalledTimes(1);
  });

  it('does not rescan the document for unrelated DOM insertions', async () => {
    dispose = installAttachmentPreviews();
    const bodyScan = vi.spyOn(document.body, 'querySelectorAll');
    const unrelated = document.createElement('section');
    unrelated.append(document.createElement('p'));
    document.body.append(unrelated);
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(bodyScan).not.toHaveBeenCalled();
  });

  it('restores and releases controls removed from a long-lived page', async () => {
    const { item, trigger } = card();
    dispose = installAttachmentPreviews();
    expect(trigger.hidden).toBe(false);
    item.remove();
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(trigger.hidden).toBe(true);
    document.body.append(item);
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(trigger.hidden).toBe(false);
    dispose();
    dispose = undefined;
    expect(trigger.hidden).toBe(true);
  });

  it('keeps downloads usable when native dialogs are unavailable or fail to open', () => {
    const { item, trigger, preview } = card();
    Reflect.deleteProperty(HTMLDialogElement.prototype, 'showModal');
    dispose = installAttachmentPreviews();
    expect(trigger.hidden).toBe(true);
    expect(item.querySelector('a[download]')).not.toBeNull();
    Object.defineProperty(HTMLDialogElement.prototype, 'showModal', {
      configurable: true, value: () => { throw new Error('Unavailable'); },
    });
    document.dispatchEvent(new Event('astro:page-load'));
    trigger.click();
    expect(trigger.hidden).toBe(true);
    expect(preview.parentElement).toBe(item);
    expect(document.documentElement.style.overflow).toBe('');
    expect(item.querySelector('a[download]')).not.toBeNull();
  });

  it('loads PDF canvas previews even when native dialogs are unavailable', async () => {
    Reflect.deleteProperty(HTMLDialogElement.prototype, 'showModal');
    const preview = document.createElement('attachment-pdf-preview');
    preview.dataset.attachmentPdfSrc = '/downloads/report.pdf';
    document.body.append(preview);
    dispose = installAttachmentPreviews();
    await vi.waitFor(() => expect(registerAttachmentPdf).toHaveBeenCalledWith(window));
  });
});
