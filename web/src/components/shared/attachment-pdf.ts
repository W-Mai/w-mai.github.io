import { getDocument, GlobalWorkerOptions } from "pdfjs-dist";
import type {
  PDFDocumentLoadingTask,
  PDFDocumentProxy,
  PDFPageProxy,
  RenderTask,
} from "pdfjs-dist";
import workerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import { pdfJsRuntimeAssetUrls } from "~/lib/pdf/assets";

const ELEMENT_NAME = "attachment-pdf-preview";
const MAX_PDF_BYTES = 32 * 1024 * 1024;
const MAX_PAGE_PIXELS = 4 * 1024 * 1024;
const MAX_PAGE_EDGE = 4096;
const MAX_CSS_PAGE_LENGTH = 4096;
const VIEWPORT_GUTTER = 32;

type BrowserWindow = Window & typeof globalThis;

function sizeLimitMessage(): string {
  return `PDF 超过 ${MAX_PDF_BYTES / 1024 / 1024} MiB 的站内预览限制。`;
}

async function fetchPdfBytes(
  browserWindow: BrowserWindow,
  url: URL,
  controller: AbortController,
): Promise<Uint8Array> {
  const response = await browserWindow.fetch(url.href, {
    credentials: "omit",
    mode: "same-origin",
    redirect: "error",
    signal: controller.signal,
  });
  if (!response.ok) throw new Error(`PDF 请求失败（HTTP ${response.status}）`);

  const responseUrl = response.url ? new URL(response.url, url) : url;
  if (responseUrl.origin !== url.origin) {
    controller.abort();
    throw new Error("PDF 预览只允许加载本站附件。");
  }

  const contentLength = response.headers.get("content-length");
  if (contentLength !== null) {
    const declaredBytes = Number(contentLength);
    if (Number.isFinite(declaredBytes) && declaredBytes > MAX_PDF_BYTES) {
      controller.abort();
      throw new Error(sizeLimitMessage());
    }
  }

  const reader = response.body?.getReader();
  if (!reader) throw new Error("浏览器无法读取 PDF 响应流。");

  const chunks: Uint8Array[] = [];
  let totalBytes = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!value?.byteLength) continue;
      if (value.byteLength > MAX_PDF_BYTES - totalBytes) {
        controller.abort();
        await reader.cancel(sizeLimitMessage()).catch(() => undefined);
        throw new Error(sizeLimitMessage());
      }
      chunks.push(value);
      totalBytes += value.byteLength;
    }
  } finally {
    reader.releaseLock();
  }

  const data = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    data.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return data;
}

function message(error: unknown): string {
  const detail = error instanceof Error ? error.message : String(error);
  return detail && !/^unknown$/i.test(detail)
    ? `PDF 预览不可用：${detail}`
    : "PDF 预览不可用，可使用下载按钮查看文件。";
}

/** Register the browser-only PDF canvas renderer for existing and future cards. */
export function registerAttachmentPdf(
  elementWindow: BrowserWindow = window,
): void {
  if (elementWindow.customElements.get(ELEMENT_NAME)) return;
  GlobalWorkerOptions.workerSrc = workerUrl;

  class AttachmentPdfPreview extends elementWindow.HTMLElement {
    #initialized = false;
    #disposed = false;
    #fetchController?: AbortController;
    #loadingTask?: PDFDocumentLoadingTask;
    #pdf?: PDFDocumentProxy;
    #renderTask?: RenderTask;
    #intersectionObserver?: IntersectionObserver;
    #resizeObserver?: ResizeObserver;
    #resizeTimer?: number;
    #renderRevision = 0;
    #pageNumber = 1;
    #pageCount = 0;
    #renderedWidth = 0;
    #viewport?: HTMLElement;
    #pageLabel?: HTMLOutputElement;
    #previousButton?: HTMLButtonElement;
    #nextButton?: HTMLButtonElement;
    #status?: HTMLElement;

    connectedCallback(): void {
      if (this.#initialized) return;
      this.#initialized = true;
      this.#disposed = false;
      this.#buildShell();

      const source = this.dataset.attachmentPdfSrc;
      const size = Number(this.dataset.attachmentPdfSize);
      if (!source) {
        this.#fail("PDF 预览缺少文件地址。");
        return;
      }
      if (!Number.isSafeInteger(size) || size < 0 || size > MAX_PDF_BYTES) {
        this.#fail(sizeLimitMessage());
        return;
      }

      let url: URL;
      try {
        url = new URL(source, this.ownerDocument.baseURI);
      } catch {
        this.#fail("PDF 预览地址无效。");
        return;
      }
      if (url.origin !== new URL(this.ownerDocument.baseURI).origin) {
        this.#fail("PDF 预览只允许加载本站附件。");
        return;
      }

      const begin = () => {
        this.#intersectionObserver?.disconnect();
        this.#intersectionObserver = undefined;
        void this.#load(url.href);
      };
      const Observer = this.ownerDocument.defaultView?.IntersectionObserver;
      if (Observer) {
        this.#intersectionObserver = new Observer(
          (entries) => {
            if (entries.some((entry) => entry.isIntersecting)) begin();
          },
          { rootMargin: "480px 0px" },
        );
        this.#intersectionObserver.observe(this);
      } else {
        begin();
      }
    }

    disconnectedCallback(): void {
      queueMicrotask(() => {
        if (!this.isConnected) this.#dispose();
      });
    }

    #buildShell(): void {
      const doc = this.ownerDocument;
      const toolbar = doc.createElement("div");
      toolbar.className = "attachment-pdf__toolbar";
      toolbar.setAttribute("aria-label", "PDF 页码");

      this.#previousButton = doc.createElement("button");
      this.#previousButton.type = "button";
      this.#previousButton.className =
        "attachment-card__button attachment-pdf__button";
      this.#previousButton.textContent = "上一页";
      this.#previousButton.disabled = true;
      this.#previousButton.addEventListener("click", () =>
        this.#changePage(-1),
      );

      this.#pageLabel = doc.createElement("output");
      this.#pageLabel.className = "attachment-pdf__page";
      this.#pageLabel.setAttribute("aria-live", "polite");
      this.#pageLabel.textContent = "加载中";

      this.#nextButton = doc.createElement("button");
      this.#nextButton.type = "button";
      this.#nextButton.className =
        "attachment-card__button attachment-pdf__button";
      this.#nextButton.textContent = "下一页";
      this.#nextButton.disabled = true;
      this.#nextButton.addEventListener("click", () => this.#changePage(1));
      toolbar.append(this.#previousButton, this.#pageLabel, this.#nextButton);

      this.#viewport = doc.createElement("div");
      this.#viewport.className = "attachment-pdf__viewport";
      this.#viewport.tabIndex = 0;
      this.#viewport.setAttribute("role", "document");
      this.#viewport.setAttribute(
        "aria-label",
        `${this.dataset.attachmentPdfName || "PDF"} — 页面内容`,
      );
      const loading = doc.createElement("div");
      loading.className = "attachment-card__placeholder";
      const kind = doc.createElement("strong");
      kind.textContent = "PDF";
      const loadingText = doc.createElement("span");
      loadingText.textContent = "正在安全加载预览…";
      loading.append(kind, loadingText);
      this.#viewport.append(loading);

      this.#status = doc.createElement("p");
      this.#status.className = "attachment-pdf__status";
      this.#status.setAttribute("role", "status");
      this.#status.hidden = true;
      this.replaceChildren(toolbar, this.#viewport, this.#status);
      this.setAttribute("aria-busy", "true");
    }

    async #load(url: string): Promise<void> {
      if (this.#disposed) return;
      const parsedUrl = new URL(url);
      const controller = new elementWindow.AbortController();
      this.#fetchController = controller;
      let data: Uint8Array;
      try {
        data = await fetchPdfBytes(elementWindow, parsedUrl, controller);
      } catch (error) {
        if (!this.#disposed && this.#fetchController === controller) {
          this.#fetchController = undefined;
          this.#fail(message(error));
        }
        return;
      }
      if (this.#disposed || this.#fetchController !== controller) return;
      this.#fetchController = undefined;

      const applicationBase = new URL(
        import.meta.env.BASE_URL,
        this.ownerDocument.baseURI,
      );
      const runtimeAssets = pdfJsRuntimeAssetUrls(applicationBase);
      const task = getDocument({
        data,
        cMapUrl: runtimeAssets.cMapUrl,
        cMapPacked: true,
        standardFontDataUrl: runtimeAssets.standardFontDataUrl,
        useWorkerFetch: false,
        enableXfa: false,
        stopAtErrors: true,
        maxImageSize: MAX_PAGE_PIXELS,
        canvasMaxAreaInBytes: MAX_PAGE_PIXELS * 4,
        disableFontFace: true,
        useSystemFonts: false,
        useWasm: false,
      });
      this.#loadingTask = task;
      task.onPassword = () => {
        if (this.#loadingTask !== task) return;
        this.#fail("PDF 已加密，站内预览不读取密码。");
      };
      try {
        const pdf = await task.promise;
        if (this.#disposed || this.#loadingTask !== task) {
          return;
        }
        this.#pdf = pdf;
        this.#pageCount = pdf.numPages;
        if (this.#pageCount < 1) throw new Error("文件中没有页面");
        this.#installResizeObserver();
        await this.#renderPage(1);
      } catch (error) {
        if (!this.#disposed && this.#loadingTask === task)
          this.#fail(message(error));
      }
    }

    #installResizeObserver(): void {
      const Observer = this.ownerDocument.defaultView?.ResizeObserver;
      if (!Observer || !this.#viewport) return;
      this.#resizeObserver = new Observer((entries) => {
        const width = Math.round(entries[0]?.contentRect.width ?? 0);
        if (!width || Math.abs(width - this.#renderedWidth) < 48 || !this.#pdf)
          return;
        if (this.#resizeTimer !== undefined)
          elementWindow.clearTimeout(this.#resizeTimer);
        this.#resizeTimer = elementWindow.setTimeout(() => {
          this.#resizeTimer = undefined;
          void this.#renderPage(this.#pageNumber);
        }, 120);
      });
      this.#resizeObserver.observe(this.#viewport);
    }

    #changePage(delta: number): void {
      const next = Math.min(
        this.#pageCount,
        Math.max(1, this.#pageNumber + delta),
      );
      if (next !== this.#pageNumber) void this.#renderPage(next);
    }

    async #renderPage(pageNumber: number): Promise<void> {
      const pdf = this.#pdf;
      const viewportElement = this.#viewport;
      if (!pdf || !viewportElement || this.#disposed) return;
      const revision = ++this.#renderRevision;
      this.#renderTask?.cancel();
      this.#setControls(pageNumber, true);
      this.setAttribute("aria-busy", "true");

      let page: PDFPageProxy | undefined;
      try {
        page = await pdf.getPage(pageNumber);
        if (revision !== this.#renderRevision || this.#disposed) return;
        const base = page.getViewport({ scale: 1 });
        const measuredWidth = viewportElement.clientWidth - VIEWPORT_GUTTER;
        const availableWidth = Math.max(
          280,
          measuredWidth > 0 ? measuredWidth : 720,
        );
        const cssScale = Math.min(
          2,
          availableWidth / base.width,
          MAX_CSS_PAGE_LENGTH / base.height,
        );
        if (!Number.isFinite(cssScale) || cssScale <= 0)
          throw new Error("页面尺寸无效");
        const cssViewport = page.getViewport({ scale: cssScale });
        const pixelRatio = Math.min(
          elementWindow.devicePixelRatio || 1,
          2,
          Math.sqrt(
            MAX_PAGE_PIXELS /
              Math.max(1, cssViewport.width * cssViewport.height),
          ),
          MAX_PAGE_EDGE / Math.max(1, cssViewport.width),
          MAX_PAGE_EDGE / Math.max(1, cssViewport.height),
        );
        if (!Number.isFinite(pixelRatio) || pixelRatio <= 0)
          throw new Error("页面分辨率无效");
        const renderViewport = page.getViewport({
          scale: cssScale * pixelRatio,
        });
        const canvas = this.ownerDocument.createElement("canvas");
        canvas.className = "attachment-pdf__canvas";
        canvas.width = Math.max(1, Math.floor(renderViewport.width));
        canvas.height = Math.max(1, Math.floor(renderViewport.height));
        canvas.style.inlineSize = `${Math.round(cssViewport.width)}px`;
        canvas.style.blockSize = `${Math.round(cssViewport.height)}px`;
        canvas.setAttribute("role", "img");
        canvas.setAttribute(
          "aria-label",
          `${this.dataset.attachmentPdfName || "PDF"} 第 ${pageNumber} 页，共 ${this.#pageCount} 页`,
        );
        const context = canvas.getContext("2d", { alpha: false });
        if (!context) throw new Error("浏览器不支持 Canvas 预览");
        const renderTask = page.render({
          canvas,
          canvasContext: context,
          viewport: renderViewport,
          background: "#ffffff",
        });
        this.#renderTask = renderTask;
        await renderTask.promise;
        if (revision !== this.#renderRevision || this.#disposed) return;
        viewportElement.replaceChildren(canvas);
        viewportElement.scrollTo({ top: 0, left: 0 });
        this.#pageNumber = pageNumber;
        this.#renderedWidth = Math.round(viewportElement.clientWidth);
        this.#setControls(pageNumber, false);
        this.setAttribute("aria-busy", "false");
      } catch (error) {
        if (revision === this.#renderRevision && !this.#disposed)
          this.#fail(message(error));
      } finally {
        page?.cleanup();
      }
    }

    #setControls(pageNumber: number, rendering: boolean): void {
      if (!this.#previousButton || !this.#nextButton || !this.#pageLabel)
        return;
      this.#previousButton.disabled = rendering || pageNumber <= 1;
      this.#nextButton.disabled = rendering || pageNumber >= this.#pageCount;
      this.#pageLabel.textContent = this.#pageCount
        ? `${pageNumber} / ${this.#pageCount}`
        : "加载中";
    }

    #fail(reason: string): void {
      this.#renderRevision += 1;
      this.#renderTask?.cancel();
      this.#renderTask = undefined;
      const task = this.#loadingTask;
      this.#loadingTask = undefined;
      this.#pdf = undefined;
      if (task) void task.destroy();
      if (this.#previousButton) this.#previousButton.disabled = true;
      if (this.#nextButton) this.#nextButton.disabled = true;
      if (this.#pageLabel) this.#pageLabel.textContent = "无法预览";
      if (this.#viewport) {
        const fallback = this.ownerDocument.createElement("div");
        fallback.className = "attachment-card__placeholder";
        const kind = this.ownerDocument.createElement("strong");
        kind.textContent = "PDF";
        const detail = this.ownerDocument.createElement("span");
        detail.textContent = "可使用上方下载按钮查看文件";
        fallback.append(kind, detail);
        this.#viewport.replaceChildren(fallback);
      }
      if (this.#status) {
        this.#status.textContent = reason;
        this.#status.hidden = false;
      }
      this.setAttribute("aria-busy", "false");
    }

    #dispose(): void {
      if (!this.#initialized || this.#disposed) return;
      this.#disposed = true;
      this.#initialized = false;
      this.#renderRevision += 1;
      this.#intersectionObserver?.disconnect();
      this.#resizeObserver?.disconnect();
      if (this.#resizeTimer !== undefined)
        elementWindow.clearTimeout(this.#resizeTimer);
      this.#renderTask?.cancel();
      const task = this.#loadingTask;
      const fetchController = this.#fetchController;
      this.#intersectionObserver = undefined;
      this.#resizeObserver = undefined;
      this.#resizeTimer = undefined;
      this.#renderTask = undefined;
      this.#fetchController = undefined;
      this.#loadingTask = undefined;
      this.#pdf = undefined;
      fetchController?.abort();
      if (task) void task.destroy();
    }
  }

  elementWindow.customElements.define(ELEMENT_NAME, AttachmentPdfPreview);
}
