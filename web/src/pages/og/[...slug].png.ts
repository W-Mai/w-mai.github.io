import type { APIRoute, GetStaticPaths } from 'astro';
import { getCollection } from 'astro:content';
import satori from 'satori';
import { Resvg } from '@resvg/resvg-js';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { SITE_TITLE } from '~/consts';
import { pinyin } from 'pinyin-pro';

const fontPath = resolve(process.cwd(), 'public/fonts/ark-pixel-12px-monospaced-zh_cn.ttf');
const fontData = readFileSync(fontPath);

const OG_W = 1200;
const OG_H = 630;
const HERO_H = Math.round(OG_H * 0.55);

/** Derive a hue from title characters, matching BlogHeroFallback logic. */
function titleHue(title: string): number {
  return title.split('').reduce((a, c) => a + c.charCodeAt(0), 0) % 360;
}

/** Simple seeded PRNG for deterministic layout. */
function seededRandom(seed: number) {
  let s = seed;
  return () => { s = (s * 16807 + 0) % 2147483647; return s / 2147483647; };
}

/** Extract uppercase letters from title pinyin + original ASCII chars. */
function titleLetters(title: string): string[] {
  const py = pinyin(title, { toneType: 'none', type: 'array' });
  const letters = py.map(s => s.replace(/\s/g, '').toUpperCase()).filter(Boolean);
  // Also include original ASCII uppercase letters
  for (const ch of title) {
    if (/[A-Za-z0-9]/.test(ch)) letters.push(ch.toUpperCase());
  }
  return letters.length > 0 ? letters : ['A', 'B', 'C'];
}

/** Generate a fallback hero image buffer with scattered pinyin letters. */
async function generateFallbackHero(title: string): Promise<Buffer> {
  const hue = titleHue(title);
  const letters = titleLetters(title);
  const rand = seededRandom(hue + title.length * 7);

  // Scatter 20-30 letters across the canvas
  const count = 20 + Math.floor(rand() * 10);
  const scattered: any[] = [];
  for (let i = 0; i < count; i++) {
    const letter = letters[i % letters.length];
    const x = Math.floor(rand() * (OG_W - 60));
    const y = Math.floor(rand() * (HERO_H - 40));
    const size = 24 + Math.floor(rand() * 36);
    const opacity = 0.06 + rand() * 0.12;
    scattered.push({
      type: 'div',
      props: {
        style: {
          position: 'absolute', left: `${x}px`, top: `${y}px`,
          fontSize: `${size}px`, fontWeight: 700,
          color: `hsl(${hue}, 50%, 55%)`, opacity,
        },
        children: letter,
      },
    });
  }

  const svg = await satori(
    {
      type: 'div',
      props: {
        style: {
          width: '100%', height: '100%', display: 'flex', position: 'relative',
          background: `linear-gradient(135deg, hsl(${hue},55%,92%) 0%, hsl(${hue + 30},45%,87%) 50%, hsl(${hue + 60},35%,90%) 100%)`,
        },
        children: [
          ...scattered,
          // Decorative circles
          { type: 'div', props: { style: { position: 'absolute', top: '20px', right: '40px', width: '160px', height: '160px', borderRadius: '50%', background: `hsl(${hue},50%,60%)`, opacity: 0.12 } } },
          { type: 'div', props: { style: { position: 'absolute', bottom: '-40px', left: '-40px', width: '200px', height: '200px', borderRadius: '50%', background: `hsl(${hue},50%,60%)`, opacity: 0.08 } } },
          // Center title
          {
            type: 'div',
            props: {
              style: {
                position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
                display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px',
              },
              children: [
                {
                  type: 'span',
                  props: {
                    style: { fontSize: '40px', fontWeight: 700, color: `hsl(${hue},40%,30%)`, textAlign: 'center', lineHeight: 1.4 },
                    children: title,
                  },
                },
              ],
            },
          },
        ],
      },
    } as any,
    { width: OG_W, height: HERO_H, fonts: [{ name: 'ArkPixel', data: fontData, style: 'normal' as const }] },
  );

  const resvg = new Resvg(svg, { fitTo: { mode: 'width', value: OG_W } });
  const pngBytes = resvg.render().asPng();
  return Buffer.from(pngBytes.buffer, pngBytes.byteOffset, pngBytes.byteLength);
}

/** Build a composited hero data URI: blurred bg + centered foreground. */
async function buildHeroDataUri(imgBuffer: Buffer): Promise<string> {
  const { default: sharp } = await import('sharp');

  const blurBg = await sharp(imgBuffer)
    .resize(OG_W, HERO_H, { fit: 'cover' })
    .blur(30)
    .jpeg({ quality: 60 })
    .toBuffer();

  const fg = await sharp(imgBuffer)
    .resize(OG_W, HERO_H, { fit: 'inside' })
    .toBuffer();
  const fgMeta = await sharp(fg).metadata();

  const composite = await sharp(blurBg)
    .composite([{
      input: fg,
      left: Math.round((OG_W - fgMeta.width!) / 2),
      top: Math.round((HERO_H - fgMeta.height!) / 2),
    }])
    .jpeg({ quality: 80 })
    .toBuffer();

  return `data:image/jpeg;base64,${composite.toString('base64')}`;
}

export const getStaticPaths: GetStaticPaths = async () => {
  const posts = await getCollection('blog');

  return await Promise.all(posts.map(async (post) => {
    let heroDataUri = '';

    try {
      if (post.data.heroImage) {
        // Read original image from filesystem
        const fsPath = (post.data.heroImage as any).fsPath;
        if (fsPath) {
          const imgBuf = readFileSync(fsPath);
          heroDataUri = await buildHeroDataUri(imgBuf);
        }
      } else {
        // Generate fallback hero directly as jpeg data URI (exact size, no blur needed)
        const fallbackPng = await generateFallbackHero(post.data.title);
        const { default: sharp } = await import('sharp');
        const jpegBuf = await sharp(fallbackPng).jpeg({ quality: 85 }).toBuffer();
        heroDataUri = `data:image/jpeg;base64,${jpegBuf.toString('base64')}`;
      }
    } catch { /* graceful degradation */ }

    return {
      params: { slug: post.id },
      props: { title: post.data.title, description: post.data.description ?? '', heroDataUri, hue: titleHue(post.data.title) },
    };
  }));
};

export const GET: APIRoute = async ({ props }) => {
  const { title, description, heroDataUri, hue } = props as {
    title: string; description: string; heroDataUri: string; hue: number;
  };

  // Bottom bar gradient derived from title hue for color harmony
  const barBg = `linear-gradient(135deg, hsl(${hue}, 30%, 18%), hsl(${hue + 20}, 25%, 12%))`;

  // Unified split layout: hero image top + text bar bottom
  const children = [
    {
      type: 'div',
      props: {
        style: {
          width: '100%', height: '55%', display: 'flex',
          backgroundImage: `url(${heroDataUri})`,
          backgroundSize: 'cover', backgroundPosition: 'center', backgroundRepeat: 'no-repeat',
        } as any,
      },
    },
    {
      type: 'div',
      props: {
        style: {
          width: '100%', height: '45%', display: 'flex', flexDirection: 'column',
          justifyContent: 'center', padding: '30px 50px',
          background: barBg,
        },
        children: [
          { type: 'div', props: { style: { fontSize: '40px', fontWeight: 700, color: '#f1f5f9', lineHeight: 1.3 }, children: title } },
          description ? { type: 'div', props: { style: { fontSize: '22px', color: 'rgba(241,245,249,0.6)', lineHeight: 1.4, marginTop: '12px' }, children: description } } : null,
          {
            type: 'div',
            props: {
              style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '16px' },
              children: [
                { type: 'span', props: { style: { fontSize: '20px', color: 'rgba(241,245,249,0.4)' }, children: SITE_TITLE } },
                { type: 'span', props: { style: { fontSize: '20px', color: 'rgba(241,245,249,0.3)' }, children: 'benign.host' } },
              ],
            },
          },
        ].filter(Boolean),
      },
    },
  ];

  const svg = await satori(
    {
      type: 'div',
      props: {
        style: { width: '100%', height: '100%', display: 'flex', flexDirection: 'column', fontFamily: 'ArkPixel' } as any,
        children,
      },
    } as any,
    { width: OG_W, height: OG_H, fonts: [{ name: 'ArkPixel', data: fontData, style: 'normal' as const }] },
  );

  const resvg = new Resvg(svg, { fitTo: { mode: 'width', value: OG_W } });
  const png = resvg.render().asPng();

  return new Response(new Uint8Array(png), {
    headers: { 'Content-Type': 'image/png', 'Cache-Control': 'public, max-age=31536000' },
  });
};
