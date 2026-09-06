// @vitest-environment jsdom
import {
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

const pdf = vi.hoisted(() => ({
  workerOptions: { workerSrc: "" },
  getDocument: vi.fn(),
}));

vi.mock("pdfjs-dist", () => ({
  getDocument: pdf.getDocument,
  GlobalWorkerOptions: pdf.workerOptions,
}));
vi.mock("pdfjs-dist/build/pdf.worker.min.mjs?url", () => ({
  default: "/assets/pdf.worker.mjs",
}));

import { registerAttachmentPdf } from "../attachment-pdf";
import { PDF_JS_RUNTIME_ASSET_DIRECTORY } from "~/lib/pdf/assets";

const fetchPdf = vi.fn();
const cancel = vi.fn();
const destroy = vi.fn(async () => {});
const cleanup = vi.fn();
const render = vi.fn(() => ({ promise: Promise.resolve(), cancel }));
const getPage = vi.fn(async () => ({
  getViewport: ({ scale }: { scale: number }) => ({
    width: 600 * scale,
    height: 800 * scale,
  }),
  render,
  cleanup,
}));

function attachment(
  size = 1024,
  source = "/downloads/report.pdf",
): HTMLElement {
  const element = document.createElement("attachment-pdf-preview");
  element.dataset.attachmentPdfSrc = source;
  element.dataset.attachmentPdfName = "report.pdf";
  element.dataset.attachmentPdfSize = String(size);
  element.innerHTML =
    '<div class="attachment-card__placeholder"><span>fallback</span></div>';
  document.body.append(element);
  return element;
}

beforeAll(() => {
  Object.defineProperty(window, "fetch", {
    configurable: true,
    writable: true,
    value: fetchPdf,
  });
  Object.defineProperty(HTMLCanvasElement.prototype, "getContext", {
    configurable: true,
    value: vi.fn(() => ({})),
  });
  Object.defineProperty(HTMLElement.prototype, "scrollTo", {
    configurable: true,
    value: vi.fn(),
  });
  registerAttachmentPdf(window);
});

beforeEach(() => {
  fetchPdf.mockReset();
  fetchPdf.mockResolvedValue(
    new Response(new Uint8Array([0x25, 0x50, 0x44, 0x46]), {
      headers: { "content-length": "4" },
      status: 200,
    }),
  );
  destroy.mockClear();
  cancel.mockClear();
  cleanup.mockClear();
  render.mockClear();
  getPage.mockClear();
  pdf.getDocument.mockReset();
  pdf.getDocument.mockReturnValue({
    promise: Promise.resolve({ numPages: 2, getPage }),
    destroy,
    onPassword: undefined,
  });
});

afterEach(async () => {
  document.body.replaceChildren();
  await Promise.resolve();
});

describe("PDF attachment canvas renderer", () => {
  it("renders one bounded page at a time and keeps the document while the card moves", async () => {
    const element = attachment();
    await vi.waitFor(() =>
      expect(element.querySelector("canvas")).not.toBeNull(),
    );
    expect(pdf.workerOptions.workerSrc).toBe("/assets/pdf.worker.mjs");
    expect(fetchPdf).toHaveBeenCalledWith(
      "http://localhost:3000/downloads/report.pdf",
      expect.objectContaining({
        credentials: "omit",
        mode: "same-origin",
        redirect: "error",
        signal: expect.any(AbortSignal),
      }),
    );
    expect(pdf.getDocument).toHaveBeenCalledWith(
      expect.objectContaining({
        data: new Uint8Array([0x25, 0x50, 0x44, 0x46]),
        cMapUrl: `http://localhost:3000/${PDF_JS_RUNTIME_ASSET_DIRECTORY}/cmaps/`,
        cMapPacked: true,
        standardFontDataUrl: `http://localhost:3000/${PDF_JS_RUNTIME_ASSET_DIRECTORY}/standard_fonts/`,
        useWorkerFetch: false,
        enableXfa: false,
        disableFontFace: true,
        maxImageSize: 4 * 1024 * 1024,
      }),
    );
    expect(getPage).toHaveBeenLastCalledWith(1);
    expect(element.querySelector("iframe")).toBeNull();
    expect(
      element.querySelector("canvas")?.getAttribute("aria-label"),
    ).toContain("第 1 页，共 2 页");
    expect(element.getAttribute("aria-busy")).toBe("false");

    element
      .querySelector<HTMLButtonElement>(".attachment-pdf__button:last-of-type")!
      .click();
    await vi.waitFor(() => expect(getPage).toHaveBeenLastCalledWith(2));
    await vi.waitFor(() =>
      expect(
        element.querySelector("canvas")?.getAttribute("aria-label"),
      ).toContain("第 2 页"),
    );
    expect(render).toHaveBeenCalledTimes(2);
    expect(cleanup).toHaveBeenCalledTimes(2);

    const target = document.createElement("div");
    document.body.append(target);
    target.append(element);
    await Promise.resolve();
    expect(destroy).not.toHaveBeenCalled();
    expect(pdf.getDocument).toHaveBeenCalledTimes(1);

    element.remove();
    await vi.waitFor(() => expect(destroy).toHaveBeenCalledTimes(1));
  });

  it.each([
    [32 * 1024 * 1024 + 1, "/downloads/large.pdf", "32 MiB"],
    [1024, "https://other.example/report.pdf", "只允许加载本站附件"],
  ])(
    "rejects unsafe source bounds before fetching",
    async (size, source, diagnostic) => {
      const element = attachment(size, source);
      await vi.waitFor(() => expect(element.textContent).toContain(diagnostic));
      expect(pdf.getDocument).not.toHaveBeenCalled();
      expect(fetchPdf).not.toHaveBeenCalled();
      expect(element.getAttribute("aria-busy")).toBe("false");
      expect(element.querySelector("canvas")).toBeNull();
    },
  );

  it("aborts a response that exceeds the limit even when attachment metadata is smaller", async () => {
    const cancelResponse = vi.fn();
    let pulls = 0;
    const chunk = new Uint8Array(1024 * 1024);
    const body = new ReadableStream<Uint8Array>({
      pull(controller) {
        pulls += 1;
        if (pulls <= 128) controller.enqueue(chunk);
        else controller.close();
      },
      cancel: cancelResponse,
    });
    fetchPdf.mockResolvedValueOnce(
      new Response(body, {
        headers: { "content-length": "1024" },
        status: 200,
      }),
    );

    const element = attachment(1024, "/downloads/deceptive.pdf");
    await vi.waitFor(() => expect(element.textContent).toContain("32 MiB"));

    expect(fetchPdf).toHaveBeenCalledTimes(1);
    const request = fetchPdf.mock.calls[0]?.[1] as RequestInit;
    expect(request.signal?.aborted).toBe(true);
    expect(pulls).toBeGreaterThanOrEqual(33);
    expect(pulls).toBeLessThan(128);
    expect(cancelResponse).toHaveBeenCalledTimes(1);
    expect(pdf.getDocument).not.toHaveBeenCalled();
    expect(element.getAttribute("aria-busy")).toBe("false");
    expect(element.querySelector("canvas")).toBeNull();
  });

  it("destroys a failed loading task while the fallback remains connected", async () => {
    pdf.getDocument.mockReturnValueOnce({
      promise: Promise.reject(new Error("invalid document")),
      destroy,
      onPassword: undefined,
    });

    const element = attachment();
    await vi.waitFor(() =>
      expect(element.textContent).toContain("invalid document"),
    );

    expect(element.isConnected).toBe(true);
    expect(destroy).toHaveBeenCalledTimes(1);
    element.remove();
    await Promise.resolve();
    expect(destroy).toHaveBeenCalledTimes(1);
  });
});
