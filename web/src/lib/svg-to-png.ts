import { Resvg } from '@resvg/resvg-js';

export interface SvgToPngOptions {
  /** Scale factor for output resolution (default: 2 for Retina) */
  scale?: number;
}

/**
 * Convert an SVG string to a PNG base64 data URI.
 * Uses @resvg/resvg-js for server-side rasterization.
 * Returns `data:image/png;base64,{encoded}` string.
 * Throws on invalid SVG or conversion failure.
 */
export async function svgToPngDataUri(
  svg: string,
  options?: SvgToPngOptions,
): Promise<string> {
  const scale = options?.scale ?? 2;

  if (!svg || !svg.includes('<svg')) {
    throw new Error('Invalid SVG: input does not contain an <svg> element');
  }

  try {
    const resvg = new Resvg(svg, {
      fitTo: { mode: 'zoom', value: scale },
      background: 'rgba(0, 0, 0, 0)',
    });
    const rendered = resvg.render();
    const pngBytes = rendered.asPng();
    const base64 = Buffer.from(
      pngBytes.buffer,
      pngBytes.byteOffset,
      pngBytes.byteLength,
    ).toString('base64');
    return `data:image/png;base64,${base64}`;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    throw new Error(`SVG to PNG conversion failed: ${message}`);
  }
}
