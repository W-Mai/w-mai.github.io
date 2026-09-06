import pdfJsPackage from "pdfjs-dist/package.json";
import { describe, expect, it } from "vitest";
import {
  PDF_JS_RUNTIME_ASSET_DIRECTORY,
  pdfJsRuntimeAssetUrls,
} from "./assets";

describe("PDF.js runtime asset URLs", () => {
  it("versions the asset namespace with the installed PDF.js package", () => {
    expect(PDF_JS_RUNTIME_ASSET_DIRECTORY).toBe(
      `_pdfjs/${pdfJsPackage.version}`,
    );
  });

  it.each([
    ["https://example.test/", `https://example.test/${PDF_JS_RUNTIME_ASSET_DIRECTORY}/`],
    [
      "https://example.test/docs",
      `https://example.test/docs/${PDF_JS_RUNTIME_ASSET_DIRECTORY}/`,
    ],
    [
      "https://example.test/docs/?draft=1#preview",
      `https://example.test/docs/${PDF_JS_RUNTIME_ASSET_DIRECTORY}/`,
    ],
  ])("keeps runtime resources below the Astro base", (base, expectedRoot) => {
    expect(pdfJsRuntimeAssetUrls(new URL(base))).toEqual({
      cMapUrl: `${expectedRoot}cmaps/`,
      standardFontDataUrl: `${expectedRoot}standard_fonts/`,
    });
  });
});
