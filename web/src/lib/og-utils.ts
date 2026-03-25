/**
 * Shared utilities for OG image generation.
 * Provides font loading, emoji rendering, and satori-to-PNG conversion.
 */

import satori from 'satori';
import { Resvg } from '@resvg/resvg-js';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

export const OG_W = 1200;
export const OG_H = 630;

const fontPath = resolve(process.cwd(), 'public/fonts/ark-pixel-12px-monospaced-zh_cn.ttf');
export const fontData = readFileSync(fontPath);

let fallbackFontData: ArrayBuffer | null = null;

/** Lazy-load Noto Sans SC fallback for characters missing in ArkPixel. */
async function getFallbackFont(): Promise<ArrayBuffer> {
  if (fallbackFontData) return fallbackFontData;
  try {
    const url = 'https://fonts.googleapis.com/css2?family=Noto+Sans+SC:wght@400;700&display=swap';
    const css = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } }).then(r => r.text());
    const fontUrl = css.match(/src:\s*url\(([^)]+)\)/)?.[1];
    if (fontUrl) {
      fallbackFontData = await fetch(fontUrl).then(r => r.arrayBuffer());
    }
  } catch { /* proceed without fallback */ }
  if (!fallbackFontData) fallbackFontData = new ArrayBuffer(0);
  return fallbackFontData;
}

/** Convert emoji character to Twemoji hex code. */
function emojiToTwemojiCode(emoji: string): string {
  const codePoints: string[] = [];
  for (const cp of emoji) {
    const hex = cp.codePointAt(0)?.toString(16);
    if (hex) codePoints.push(hex);
  }
  return codePoints.filter(c => c !== 'fe0f').join('-');
}

/** Fetch emoji SVG from Twemoji CDN. */
async function loadEmoji(code: string): Promise<ArrayBuffer> {
  const url = `https://cdnjs.cloudflare.com/ajax/libs/twemoji/14.0.2/svg/${code}.svg`;
  try {
    const res = await fetch(url);
    if (res.ok) return res.arrayBuffer();
  } catch { /* fallback below */ }
  const empty = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1 1"></svg>';
  return new TextEncoder().encode(empty).buffer;
}

/** Satori loadAdditionalAsset handler for emoji + CJK fallback font. */
export async function loadAdditionalAsset(languageCode: string, segment: string): Promise<any> {
  if (languageCode === 'emoji') {
    return `data:image/svg+xml;base64,${Buffer.from(
      await loadEmoji(emojiToTwemojiCode(segment))
    ).toString('base64')}`;
  }
  const fallback = await getFallbackFont();
  if (fallback.byteLength > 0) {
    return [{ name: 'NotoSansSC', data: fallback, weight: 400, style: 'normal' as const }];
  }
  return '';
}

/** Default satori options with ArkPixel font + asset loader. */
export function satoriOptions() {
  return {
    width: OG_W,
    height: OG_H,
    fonts: [{ name: 'ArkPixel', data: fontData, style: 'normal' as const }],
    loadAdditionalAsset,
  };
}

/** Render satori element tree to PNG buffer. */
export async function renderToPng(element: any): Promise<Uint8Array> {
  const svg = await satori(element, satoriOptions());
  const resvg = new Resvg(svg, { fitTo: { mode: 'width', value: OG_W } });
  return resvg.render().asPng();
}

/** Create a standard PNG Response with caching headers. */
export function pngResponse(png: Uint8Array): Response {
  return new Response(new Uint8Array(png), {
    headers: { 'Content-Type': 'image/png', 'Cache-Control': 'public, max-age=31536000' },
  });
}
