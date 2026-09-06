import { version as pdfJsVersion } from "pdfjs-dist/package.json";

export const PDF_JS_RUNTIME_ASSET_DIRECTORY = `_pdfjs/${pdfJsVersion}`;

export type PdfJsRuntimeAssetUrls = {
  cMapUrl: string;
  standardFontDataUrl: string;
};

/** Resolve versioned PDF.js support assets below the configured Astro base. */
export function pdfJsRuntimeAssetUrls(
  applicationBase: URL,
): PdfJsRuntimeAssetUrls {
  const normalizedBase = new URL(applicationBase);
  normalizedBase.search = "";
  normalizedBase.hash = "";
  if (!normalizedBase.pathname.endsWith("/")) normalizedBase.pathname += "/";
  const root = new URL(`${PDF_JS_RUNTIME_ASSET_DIRECTORY}/`, normalizedBase);
  return {
    cMapUrl: new URL("cmaps/", root).href,
    standardFontDataUrl: new URL("standard_fonts/", root).href,
  };
}
