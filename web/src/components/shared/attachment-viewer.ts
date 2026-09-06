/** Enhance static attachment cards with one reusable, accessible viewport dialog. */
import { attachmentActionIconPaths } from '~/lib/attachments/action-icons';
import type { AttachmentActionIcon } from '~/lib/attachments/action-icons';

const installations = new WeakMap<Document, () => void>();

const SVG_NAMESPACE = 'http://www.w3.org/2000/svg';

function actionIcon(doc: Document, icon: AttachmentActionIcon): SVGSVGElement {
  const svg = doc.createElementNS(SVG_NAMESPACE, 'svg');
  svg.classList.add('attachment-card__icon');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('fill', 'none');
  svg.setAttribute('stroke', 'currentColor');
  svg.setAttribute('stroke-width', '2');
  svg.setAttribute('stroke-linecap', 'round');
  svg.setAttribute('stroke-linejoin', 'round');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('focusable', 'false');
  for (const d of attachmentActionIconPaths[icon]) {
    const path = doc.createElementNS(SVG_NAMESPACE, 'path');
    path.setAttribute('d', d);
    svg.append(path);
  }
  return svg;
}

interface ActivePreview {
  preview: HTMLElement;
  marker: Comment;
  trigger: HTMLButtonElement;
  overflow: string;
  overflowPriority: string;
}

export function installAttachmentPreviews(doc: Document = document): () => void {
  const existing = installations.get(doc);
  if (existing) return existing;
  const view = doc.defaultView;
  if (!view) return () => {};
  const win = view;

  let dialog: HTMLDialogElement | undefined;
  let dialogBody: HTMLElement | undefined;
  let dialogTitle: HTMLElement | undefined;
  let dialogMeta: HTMLElement | undefined;
  let dialogStatus: HTMLElement | undefined;
  let dialogActions: HTMLElement | undefined;
  let closeButton: HTMLButtonElement | undefined;
  let active: ActivePreview | undefined;
  let swapping = false;
  let pdfRenderer: Promise<void> | undefined;
  const enhanced = new Map<HTMLButtonElement, boolean>();

  function hasPdfPreview(scope: ParentNode): boolean {
    return (scope instanceof win.Element
      && scope.matches('attachment-pdf-preview[data-attachment-pdf-src]'))
      || Boolean(scope.querySelector('attachment-pdf-preview[data-attachment-pdf-src]'));
  }

  function ensurePdfRenderer(scope: ParentNode): void {
    if (!hasPdfPreview(scope) || win.customElements.get('attachment-pdf-preview')) return;
    pdfRenderer ??= import('./attachment-pdf')
      .then(({ registerAttachmentPdf }) => registerAttachmentPdf(win))
      .catch(() => {
        pdfRenderer = undefined;
        doc.querySelectorAll<HTMLElement>('attachment-pdf-preview[data-attachment-pdf-src]')
          .forEach((preview) => {
            const detail = preview.querySelector<HTMLElement>('.attachment-card__placeholder span');
            if (detail) detail.textContent = 'PDF 预览组件加载失败，可使用下载按钮查看文件';
            preview.setAttribute('aria-busy', 'false');
          });
      });
  }

  function close(restoreFocus = true): void {
    const previous = active;
    active = undefined;
    if (previous) {
      const { preview, marker, trigger, overflow, overflowPriority } = previous;
      preview.querySelectorAll<HTMLMediaElement>('audio, video').forEach((media) => media.pause());
      const { scrollTop, scrollLeft } = preview;
      if (marker.parentNode) marker.replaceWith(preview);
      else preview.remove();
      preview.scrollTop = scrollTop;
      preview.scrollLeft = scrollLeft;
      if (overflow) doc.documentElement.style.setProperty('overflow', overflow, overflowPriority);
      else doc.documentElement.style.removeProperty('overflow');
      if (dialog?.open) dialog.close();
      if (restoreFocus && trigger.isConnected) trigger.focus({ preventScroll: true });
    } else if (dialog?.open) {
      dialog.close();
    }
  }

  function createDialog(): HTMLDialogElement {
    if (dialog?.isConnected) return dialog;
    dialog = doc.createElement('dialog');
    dialog.className = 'attachment-dialog';
    const header = doc.createElement('header');
    header.className = 'attachment-card__header';
    const identity = doc.createElement('div');
    identity.className = 'attachment-card__identity';
    dialogTitle = doc.createElement('strong');
    dialogTitle.className = 'attachment-card__name';
    dialogMeta = doc.createElement('p');
    dialogMeta.className = 'attachment-card__meta';
    identity.append(dialogTitle, dialogMeta);
    dialogActions = doc.createElement('div');
    dialogActions.className = 'attachment-card__actions';
    closeButton = doc.createElement('button');
    closeButton.type = 'button';
    closeButton.className = 'attachment-card__button attachment-dialog__close';
    closeButton.append(actionIcon(doc, 'close'));
    closeButton.setAttribute('aria-label', '关闭附件预览');
    closeButton.addEventListener('click', () => close());
    dialogActions.append(closeButton);
    header.append(identity, dialogActions);
    dialogBody = doc.createElement('div');
    dialogBody.className = 'attachment-dialog__body';
    dialogStatus = doc.createElement('p');
    dialogStatus.className = 'attachment-card__status';
    dialog.append(header, dialogBody, dialogStatus);
    dialog.addEventListener('cancel', (event) => { event.preventDefault(); close(); });
    dialog.addEventListener('close', (event) => {
      if (event.currentTarget === dialog && !dialog.open) close();
    });
    dialog.addEventListener('click', (event) => {
      if (event.target !== dialog) return;
      const bounds = dialog.getBoundingClientRect();
      if (event.clientX < bounds.left || event.clientX > bounds.right
        || event.clientY < bounds.top || event.clientY > bounds.bottom) close();
    });
    doc.body.append(dialog);
    return dialog;
  }

  function open(trigger: HTMLButtonElement): void {
    const card = trigger.closest<HTMLElement>('[data-attachment-card]');
    const preview = card?.querySelector<HTMLElement>('.attachment-card__preview');
    if (!card || !preview || typeof win.HTMLDialogElement?.prototype.showModal !== 'function') return;
    close(false);
    const modal = createDialog();
    const name = card.dataset.attachmentName
      || card.querySelector('.attachment-card__name')?.textContent || '附件预览';
    modal.setAttribute('aria-label', `${name} — 附件预览`);
    dialogTitle!.textContent = name;
    dialogTitle!.title = name;
    dialogMeta!.textContent = card.querySelector('.attachment-card__meta')?.textContent ?? '';
    dialogStatus!.textContent = card.querySelector('.attachment-card__status')?.textContent ?? '';
    dialogStatus!.hidden = !dialogStatus!.textContent;
    dialogActions!.querySelector('.attachment-card__download')?.remove();
    const sourceDownload = card.querySelector<HTMLAnchorElement>('.attachment-card__download');
    if (sourceDownload) {
      const download = doc.createElement('a');
      download.className = 'attachment-card__button attachment-card__download';
      download.href = sourceDownload.href;
      download.download = sourceDownload.download;
      download.type = sourceDownload.type;
      download.append(actionIcon(doc, 'download'));
      download.setAttribute('aria-label', `下载 ${name}`);
      dialogActions!.prepend(download);
    }
    const marker = doc.createComment('attachment-preview');
    preview.before(marker);
    active = {
      preview, marker, trigger,
      overflow: doc.documentElement.style.getPropertyValue('overflow'),
      overflowPriority: doc.documentElement.style.getPropertyPriority('overflow'),
    };
    const { scrollTop, scrollLeft } = preview;
    dialogBody!.append(preview);
    doc.documentElement.style.setProperty('overflow', 'hidden');
    try {
      modal.showModal();
      preview.scrollTop = scrollTop;
      preview.scrollLeft = scrollLeft;
      closeButton!.focus({ preventScroll: true });
    } catch {
      close();
      trigger.hidden = true;
    }
  }

  function pruneControls(): void {
    for (const [button, hidden] of enhanced) {
      if (!button.isConnected) {
        button.hidden = hidden;
        enhanced.delete(button);
      }
    }
  }

  function refresh(scope: ParentNode = doc): void {
    if (swapping) return;
    ensurePdfRenderer(scope);
    if (typeof win.HTMLDialogElement?.prototype.showModal !== 'function') return;
    pruneControls();
    scope.querySelectorAll<HTMLButtonElement>('[data-attachment-fullscreen]').forEach((button) => {
      if (!button.closest('[data-attachment-card]')?.querySelector('.attachment-card__preview')) return;
      if (!enhanced.has(button)) enhanced.set(button, button.hidden);
      button.hidden = false;
    });
  }

  const onClick = (event: MouseEvent) => {
    const trigger = event.target instanceof win.Element
      ? event.target.closest<HTMLButtonElement>('button[data-attachment-fullscreen]') : null;
    if (!trigger || trigger.disabled || trigger.hidden) return;
    event.preventDefault();
    open(trigger);
  };
  const onKeydown = (event: KeyboardEvent) => {
    if (event.key !== 'Escape' || !active) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    close();
  };
  const beforeSwap = () => {
    swapping = true;
    close(false);
    dialog?.remove();
    dialog = undefined;
    for (const [button, hidden] of enhanced) button.hidden = hidden;
    enhanced.clear();
  };
  const pageLoad = () => { swapping = false; refresh(); };
  const observer = new win.MutationObserver((records) => {
    let removedControls = false;
    for (const record of records) {
      removedControls ||= record.removedNodes.length > 0;
      for (const node of record.addedNodes) {
        if (!(node instanceof win.Element) || !node.isConnected) continue;
        if (node.matches('[data-attachment-fullscreen], attachment-pdf-preview[data-attachment-pdf-src]')) {
          refresh(node.parentNode ?? node);
        } else if (node.querySelector('[data-attachment-fullscreen], attachment-pdf-preview[data-attachment-pdf-src]')) {
          refresh(node);
        }
      }
    }
    if (removedControls) pruneControls();
  });
  doc.addEventListener('click', onClick);
  doc.addEventListener('keydown', onKeydown, true);
  doc.addEventListener('astro:before-swap', beforeSwap);
  doc.addEventListener('astro:page-load', pageLoad);
  observer.observe(doc.documentElement, { childList: true, subtree: true });
  refresh();

  const dispose = () => {
    observer.disconnect();
    beforeSwap();
    doc.removeEventListener('click', onClick);
    doc.removeEventListener('keydown', onKeydown, true);
    doc.removeEventListener('astro:before-swap', beforeSwap);
    doc.removeEventListener('astro:page-load', pageLoad);
    installations.delete(doc);
  };
  installations.set(doc, dispose);
  return dispose;
}
