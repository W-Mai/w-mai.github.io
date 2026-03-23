import type { APIRoute, GetStaticPaths } from 'astro';
import satori from 'satori';
import { Resvg } from '@resvg/resvg-js';
import { readFileSync, existsSync } from 'node:fs';
import { resolve, extname } from 'node:path';
import { NICK_NAME } from '~/consts';
import { loadThoughts } from '~/data/thoughts';

const fontPath = resolve(process.cwd(), 'public/fonts/ark-pixel-12px-monospaced-zh_cn.ttf');
const fontData = readFileSync(fontPath);
const STICKERS_DIR = resolve(process.cwd(), '..', 'assets', 'stickers');

const OG_W = 1200;
const OG_H = 630;

const INLINE_STICKER_RE = /:sticker\[([^\]]+)\]:/g;
const BLOCK_STICKER_RE = /^::sticker\[([^\]]+)\]::$/;

const MIME_MAP: Record<string, string> = {
  '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.png': 'image/png', '.gif': 'image/gif',
  '.webp': 'image/webp', '.svg': 'image/svg+xml',
};

/** Read a sticker file as base64 data URI + raw buffer. */
function loadSticker(name: string): { uri: string; buf: Buffer } | null {
  const filePath = resolve(STICKERS_DIR, name);
  if (!existsSync(filePath)) return null;
  try {
    const buf = readFileSync(filePath);
    const mime = MIME_MAP[extname(name).toLowerCase()] ?? 'application/octet-stream';
    return { uri: `data:${mime};base64,${buf.toString('base64')}`, buf };
  } catch { return null; }
}

/** Extract image dimensions from GIF/PNG/JPEG header bytes. */
function imageDimensions(buf: Buffer): { w: number; h: number } | null {
  // GIF: bytes 6-9 = width (LE 16), height (LE 16)
  if (buf[0] === 0x47 && buf[1] === 0x49 && buf[2] === 0x46) {
    return { w: buf.readUInt16LE(6), h: buf.readUInt16LE(8) };
  }
  // PNG: bytes 16-23 = width (BE 32), height (BE 32)
  if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) {
    return { w: buf.readUInt32BE(16), h: buf.readUInt32BE(20) };
  }
  // JPEG: scan for SOF0/SOF2 marker
  let i = 2;
  while (i < buf.length - 8) {
    if (buf[i] === 0xff && (buf[i + 1] === 0xc0 || buf[i + 1] === 0xc2)) {
      return { w: buf.readUInt16BE(i + 7), h: buf.readUInt16BE(i + 5) };
    }
    i += 2 + buf.readUInt16BE(i + 2);
  }
  return null;
}

/** Compute width/height that fit within maxSize while preserving aspect ratio. */
function fitSize(dim: { w: number; h: number } | null, maxSize: number): { width: number; height: number } {
  if (!dim || dim.w === 0 || dim.h === 0) return { width: maxSize, height: maxSize };
  const ratio = dim.w / dim.h;
  if (ratio >= 1) return { width: maxSize, height: Math.round(maxSize / ratio) };
  return { width: Math.round(maxSize * ratio), height: maxSize };
}

/** Mood emoji to base hue based on color psychology. */
const moodBaseHue: Record<string, number> = {
  '🎉': 45,   // warm yellow-orange — celebration, joy
  '🤔': 220,  // calm blue — contemplation, thought
  '✨': 275,  // purple-violet — creativity, magic
  '😤': 0,    // red — frustration, anger
  '🐛': 120,  // green — bugs, nature
  '💡': 50,   // golden yellow — ideas, inspiration
  '🔥': 15,   // red-orange — passion, intensity
  '😂': 40,   // warm yellow — happiness, laughter
  '🥲': 210,  // soft blue — bittersweet, melancholy
  '👀': 180,  // teal-cyan — curiosity, observation
};

/** Get base hue for a mood emoji, fallback to codepoint-derived value. */
function moodHue(emoji: string): number {
  return moodBaseHue[emoji] ?? ((emoji.codePointAt(0) ?? 0) * 37) % 360;
}

/**
 * Parse thought content into satori-compatible children array.
 * Handles :sticker[name]: inline syntax and plain text segments.
 */
function parseContentToChildren(text: string, fontSize: number): any[] {
  // Check for block sticker (entire content is one sticker)
  const blockMatch = text.match(BLOCK_STICKER_RE);
  if (blockMatch) {
    const sticker = loadSticker(blockMatch[1]);
    if (sticker) {
      const { width, height } = fitSize(imageDimensions(sticker.buf), 160);
      return [{
        type: 'img',
        props: { src: sticker.uri, width, height, style: { borderRadius: '12px' } },
      }];
    }
  }

  const children: any[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  const re = new RegExp(INLINE_STICKER_RE.source, 'g');

  while ((match = re.exec(text)) !== null) {
    // Text before sticker
    if (match.index > lastIndex) {
      children.push(text.slice(lastIndex, match.index));
    }
    // Sticker image
    const sticker = loadSticker(match[1]);
    if (sticker) {
      const maxSize = Math.round(fontSize * 1.6);
      const { width, height } = fitSize(imageDimensions(sticker.buf), maxSize);
      children.push({
        type: 'img',
        props: {
          src: sticker.uri,
          width,
          height,
          style: { borderRadius: '4px' },
        },
      });
    } else {
      children.push(`[${match[1]}]`);
    }
    lastIndex = re.lastIndex;
  }

  // Remaining text
  if (lastIndex < text.length) {
    children.push(text.slice(lastIndex));
  }

  return children.length > 0 ? children : [text];
}

/** Fetch emoji SVG from Twemoji CDN for satori rendering. */
async function loadEmoji(code: string): Promise<ArrayBuffer> {
  const url = `https://cdnjs.cloudflare.com/ajax/libs/twemoji/14.0.2/svg/${code}.svg`;
  try {
    const res = await fetch(url);
    if (res.ok) return res.arrayBuffer();
  } catch { /* fallback below */ }
  // Return empty SVG as fallback
  const empty = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1 1"></svg>';
  return new TextEncoder().encode(empty).buffer;
}

/** Convert emoji character to Twemoji hex code. */
function emojiToTwemojiCode(emoji: string): string {
  const codePoints: string[] = [];
  for (const cp of emoji) {
    const hex = cp.codePointAt(0)?.toString(16);
    if (hex) codePoints.push(hex);
  }
  // Remove fe0f (variation selector) for Twemoji compatibility
  return codePoints.filter(c => c !== 'fe0f').join('-');
}

export const getStaticPaths: GetStaticPaths = async () => {
  const thoughts = await loadThoughts();
  return thoughts.map((t) => ({
    params: { id: t.id },
    props: {
      content: t.content,
      mood: t.mood,
      createdAt: t.createdAt,
      tags: t.tags,
    },
  }));
};


export const GET: APIRoute = async ({ props }) => {
  const { content, mood, createdAt, tags } = props as {
    content: string; mood?: string; createdAt: string; tags?: string[];
  };

  const moodEmoji = mood ?? '💭';
  const accentHue = moodHue(moodEmoji);

  // Adaptive font size based on content length
  const fontSize = content.length > 120 ? 28 : content.length > 60 ? 34 : 42;
  const contentChildren = parseContentToChildren(content, fontSize);

  const dateStr = new Date(createdAt).toLocaleDateString('zh-CN', {
    year: 'numeric', month: 'long', day: 'numeric',
  });

  const tagStr = (tags ?? []).map(t => `#${t}`).join('  ');

  const svg = await satori(
    {
      type: 'div',
      props: {
        style: {
          width: '100%', height: '100%', display: 'flex', flexDirection: 'column',
          fontFamily: 'ArkPixel', position: 'relative', overflow: 'hidden',
          background: `linear-gradient(145deg, hsl(${accentHue},60%,92%), hsl(${(accentHue + 20) % 360},50%,87%))`,
        },
        children: [
          // Decorative circles
          {
            type: 'div', props: {
              style: {
                position: 'absolute', top: '-60px', right: '-60px',
                width: '260px', height: '260px', borderRadius: '50%',
                background: `hsl(${accentHue},55%,80%)`, opacity: 0.4,
              },
            },
          },
          {
            type: 'div', props: {
              style: {
                position: 'absolute', bottom: '-40px', left: '-40px',
                width: '200px', height: '200px', borderRadius: '50%',
                background: `hsl(${accentHue},50%,75%)`, opacity: 0.3,
              },
            },
          },
          // Large decorative quotation mark
          {
            type: 'div', props: {
              style: {
                position: 'absolute', top: '40px', left: '50px',
                fontSize: '180px', lineHeight: '1',
                color: `hsl(${accentHue},40%,70%)`, opacity: 0.35,
              },
              children: '\u201C',
            },
          },
          // Main content area
          {
            type: 'div', props: {
              style: {
                flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
                padding: '80px 70px 30px',
              },
              children: [{
                type: 'div', props: {
                  style: {
                    fontSize: `${fontSize}px`, lineHeight: 1.6,
                    color: `hsl(${accentHue},30%,25%)`, textAlign: 'center',
                    display: 'flex', flexWrap: 'wrap', justifyContent: 'center', alignItems: 'center',
                  },
                  children: contentChildren,
                },
              }],
            },
          },
          // Attribution bar
          {
            type: 'div', props: {
              style: {
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                padding: '20px 50px 30px',
                borderTop: `1px solid hsl(${accentHue},40%,80%)`,
              },
              children: [
                {
                  type: 'div', props: {
                    style: { display: 'flex', alignItems: 'center', gap: '12px' },
                    children: [
                      {
                        type: 'span', props: {
                          style: { fontSize: '24px', color: `hsl(${accentHue},50%,45%)` },
                          children: moodEmoji,
                        },
                      },
                      {
                        type: 'span', props: {
                          style: { fontSize: '22px', color: `hsl(${accentHue},20%,35%)` },
                          children: `— ${NICK_NAME}`,
                        },
                      },
                    ],
                  },
                },
                {
                  type: 'div', props: {
                    style: { display: 'flex', alignItems: 'center', gap: '16px' },
                    children: [
                      tagStr ? {
                        type: 'span', props: {
                          style: { fontSize: '18px', color: `hsl(${accentHue},40%,50%)` },
                          children: tagStr,
                        },
                      } : null,
                      {
                        type: 'span', props: {
                          style: { fontSize: '18px', color: `hsl(${accentHue},15%,55%)` },
                          children: dateStr,
                        },
                      },
                    ].filter(Boolean),
                  },
                },
              ],
            },
          },
        ],
      },
    } as any,
    {
      width: OG_W,
      height: OG_H,
      fonts: [{ name: 'ArkPixel', data: fontData, style: 'normal' as const }],
      loadAdditionalAsset: async (languageCode: string, segment: string) => {
        if (languageCode === 'emoji') {
          return `data:image/svg+xml;base64,${Buffer.from(
            await loadEmoji(emojiToTwemojiCode(segment))
          ).toString('base64')}`;
        }
        return '';
      },
    },
  );

  const resvg = new Resvg(svg, { fitTo: { mode: 'width', value: OG_W } });
  const png = resvg.render().asPng();

  return new Response(new Uint8Array(png), {
    headers: { 'Content-Type': 'image/png', 'Cache-Control': 'public, max-age=31536000' },
  });
};
