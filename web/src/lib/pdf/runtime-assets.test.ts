import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import { beforeEach, describe, expect, it } from "vitest";

type AssetKind = "cMapUrl" | "standardFontDataUrl" | "wasmUrl";
type FactoryOptions = Partial<Record<AssetKind, string>>;

const require = createRequire(import.meta.url);
const packageRoot = dirname(require.resolve("pdfjs-dist/package.json"));

class RecordingBinaryDataFactory {
  static requests: string[] = [];
  readonly options: FactoryOptions;

  constructor(options: FactoryOptions) {
    this.options = options;
  }

  async fetch({
    kind,
    filename,
  }: {
    kind: AssetKind;
    filename: string;
  }): Promise<Uint8Array> {
    RecordingBinaryDataFactory.requests.push(`${kind}:${filename}`);
    const base = this.options[kind];
    if (!base) throw new Error(`Missing ${kind}`);
    return new Uint8Array(await readFile(`${base}${filename}`));
  }
}

function pdf(objects: readonly string[]): Uint8Array {
  const chunks = ["%PDF-1.7\n%\xff\xff\xff\xff\n"];
  const offsets: number[] = [];
  let length = Buffer.byteLength(chunks[0], "latin1");
  for (const [index, body] of objects.entries()) {
    offsets.push(length);
    const object = `${index + 1} 0 obj\n${body}\nendobj\n`;
    chunks.push(object);
    length += Buffer.byteLength(object, "latin1");
  }
  const xrefOffset = length;
  chunks.push(`xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`);
  for (const offset of offsets) {
    chunks.push(`${String(offset).padStart(10, "0")} 00000 n \n`);
  }
  chunks.push(
    `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`,
  );
  return new Uint8Array(Buffer.from(chunks.join(""), "latin1"));
}

function stream(contents: string): string {
  return `<< /Length ${Buffer.byteLength(contents, "latin1")} >>\nstream\n${contents}\nendstream`;
}

const commonObjects = [
  "<< /Type /Catalog /Pages 2 0 R >>",
  "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
];

const base14Document = pdf([
  ...commonObjects,
  "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 300 100] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>",
  "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>",
  stream("BT /F1 24 Tf 20 40 Td (Hello PDF) Tj ET"),
]);

const predefinedCMapDocument = pdf([
  ...commonObjects,
  "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 300 100] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>",
  "<< /Type /Font /Subtype /Type0 /BaseFont /HeiseiMin-W3 /Encoding /90ms-RKSJ-H /DescendantFonts [6 0 R] >>",
  stream("BT /F1 24 Tf 20 40 Td <82A0> Tj ET"),
  "<< /Type /Font /Subtype /CIDFontType0 /BaseFont /HeiseiMin-W3 /CIDSystemInfo << /Registry (Adobe) /Ordering (Japan1) /Supplement 5 >> /FontDescriptor 7 0 R /DW 1000 >>",
  "<< /Type /FontDescriptor /FontName /HeiseiMin-W3 /Flags 6 /FontBBox [-123 -257 1001 910] /ItalicAngle 0 /Ascent 752 /Descent -271 /CapHeight 737 /StemV 80 >>",
]);

async function parseOperators(data: Uint8Array): Promise<void> {
  const task = getDocument({
    data,
    cMapUrl: `${join(packageRoot, "cmaps")}/`,
    cMapPacked: true,
    standardFontDataUrl: `${join(packageRoot, "standard_fonts")}/`,
    useWorkerFetch: false,
    disableFontFace: true,
    useSystemFonts: false,
    useWasm: false,
    stopAtErrors: true,
    BinaryDataFactory: RecordingBinaryDataFactory,
  });
  try {
    const document = await task.promise;
    const page = await document.getPage(1);
    expect((await page.getOperatorList()).fnArray.length).toBeGreaterThan(0);
  } finally {
    await task.destroy();
  }
}

describe("PDF.js support asset consumption", () => {
  beforeEach(() => {
    RecordingBinaryDataFactory.requests = [];
  });

  it("loads the local substitute for an unembedded Base-14 font", async () => {
    await parseOperators(base14Document.slice());
    expect(RecordingBinaryDataFactory.requests).toContain(
      "standardFontDataUrl:LiberationSans-Regular.ttf",
    );
  });

  it("loads a packed predefined CMap for a composite font", async () => {
    await parseOperators(predefinedCMapDocument.slice());
    expect(RecordingBinaryDataFactory.requests).toContain(
      "cMapUrl:90ms-RKSJ-H.bcmap",
    );
  });
});
