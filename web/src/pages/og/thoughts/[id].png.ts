import type { APIRoute, GetStaticPaths } from 'astro';
import { NICK_NAME } from '~/consts';
import { loadThoughts } from '~/data/thoughts';
import {
  BLOCK_STICKER_RE, INLINE_STICKER_RE,
  loadSticker, imageDimensions, fitSize,
} from '~/lib/sticker';
import { OG_W, OG_H, renderToPng, pngResponse } from '~/lib/og-utils';

/** Mood emoji to base hue based on color psychology. */
const moodBaseHue: Record<string, number> = {
  '🎉': 45, '🤔': 220, '✨': 275, '😤': 0, '🐛': 120,
  '💡': 50, '🔥': 15, '😂': 40, '🥲': 210, '👀': 180,
};

function moodHue(emoji: string): number {
  return moodBaseHue[emoji] ?? ((emoji.codePointAt(0) ?? 0) * 37) % 360;
}

/** Parse thought content into satori-compatible children array. */
function parseContentToChildren(text: string, fontSize: number, accentHue: number): any[] {
  const lines = text.split(/\n\n+/);
  const blocks: any[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    const blockMatch = trimmed.match(BLOCK_STICKER_RE);
    if (blockMatch) {
      const sticker = loadSticker(blockMatch[1]);
      if (sticker) {
        const { width, height } = fitSize(imageDimensions(sticker.buf), 160);
        blocks.push({
          type: 'div',
          props: {
            style: { display: 'flex', justifyContent: 'center', width: '100%', margin: '8px 0' },
            children: [{ type: 'img', props: { src: sticker.uri, width, height, style: { borderRadius: '12px' } } }],
          },
        });
        continue;
      }
    }

    blocks.push({
      type: 'div',
      props: {
        style: { display: 'flex', flexWrap: 'wrap', justifyContent: 'center', alignItems: 'center', width: '100%', margin: '4px 0' },
        children: parseInlineMarkdown(trimmed, fontSize, accentHue),
      },
    });
  }

  return blocks.length > 0 ? blocks : [text];
}

function parseInlineMarkdown(text: string, fontSize: number, accentHue: number): any[] {
  let isHeading = false;
  let processed = text;
  const headingMatch = processed.match(/^#{1,6}\s+/);
  if (headingMatch) { processed = processed.slice(headingMatch[0].length); isHeading = true; }

  const TOKEN_RE = new RegExp(`(\\*\\*(.+?)\\*\\*|\`([^\`]+)\`|${INLINE_STICKER_RE.source})`, 'g');
  const children: any[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = TOKEN_RE.exec(processed)) !== null) {
    if (match.index > lastIndex) children.push(wrapText(processed.slice(lastIndex, match.index), isHeading, fontSize));
    if (match[2] !== undefined) {
      children.push({ type: 'span', props: { style: { fontWeight: 700 }, children: match[2] } });
    } else if (match[3] !== undefined) {
      children.push({
        type: 'span',
        props: {
          style: { background: `hsl(${accentHue},30%,82%)`, padding: '2px 6px', borderRadius: '4px', fontSize: `${Math.round(fontSize * 0.85)}px`, color: `hsl(${accentHue},35%,30%)` },
          children: match[3],
        },
      });
    } else if (match[4] !== undefined) {
      const sticker = loadSticker(match[4]);
      if (sticker) {
        const maxSize = Math.round(fontSize * 1.6);
        const { width, height } = fitSize(imageDimensions(sticker.buf), maxSize);
        children.push({ type: 'img', props: { src: sticker.uri, width, height, style: { borderRadius: '4px' } } });
      } else {
        children.push(`[${match[4]}]`);
      }
    }
    lastIndex = TOKEN_RE.lastIndex;
  }

  if (lastIndex < processed.length) children.push(wrapText(processed.slice(lastIndex), isHeading, fontSize));
  return children.length > 0 ? children : [processed];
}

function wrapText(text: string, isHeading: boolean, fontSize: number): any {
  if (!isHeading) return text;
  return { type: 'span', props: { style: { fontWeight: 700, fontSize: `${Math.round(fontSize * 1.2)}px` }, children: text } };
}

export const getStaticPaths: GetStaticPaths = async () => {
  const thoughts = await loadThoughts();
  return thoughts.map((t) => ({
    params: { id: t.id },
    props: { content: t.content, mood: t.mood, createdAt: t.createdAt, tags: t.tags },
  }));
};

export const GET: APIRoute = async ({ props }) => {
  const { content, mood, createdAt, tags } = props as {
    content: string; mood?: string; createdAt: string; tags?: string[];
  };

  const moodEmoji = mood ?? '💭';
  const accentHue = moodHue(moodEmoji);
  const fontSize = content.length > 120 ? 28 : content.length > 60 ? 34 : 42;
  const contentChildren = parseContentToChildren(content, fontSize, accentHue);
  const dateStr = new Date(createdAt).toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric' });
  const tagStr = (tags ?? []).map(t => `#${t}`).join('  ');

  const element = {
    type: 'div',
    props: {
      style: {
        width: '100%', height: '100%', display: 'flex', flexDirection: 'column',
        fontFamily: 'ArkPixel', position: 'relative', overflow: 'hidden',
        background: `linear-gradient(145deg, hsl(${accentHue},60%,92%), hsl(${(accentHue + 20) % 360},50%,87%))`,
      },
      children: [
        { type: 'div', props: { style: { position: 'absolute', top: '-60px', right: '-60px', width: '260px', height: '260px', borderRadius: '50%', background: `hsl(${accentHue},55%,80%)`, opacity: 0.4 } } },
        { type: 'div', props: { style: { position: 'absolute', bottom: '-40px', left: '-40px', width: '200px', height: '200px', borderRadius: '50%', background: `hsl(${accentHue},50%,75%)`, opacity: 0.3 } } },
        { type: 'div', props: { style: { position: 'absolute', top: '40px', left: '50px', fontSize: '180px', lineHeight: '1', color: `hsl(${accentHue},40%,70%)`, opacity: 0.35 }, children: '\u201C' } },
        {
          type: 'div', props: {
            style: { flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '80px 70px 30px' },
            children: [{ type: 'div', props: {
              style: { fontSize: `${fontSize}px`, lineHeight: 1.6, color: `hsl(${accentHue},30%,25%)`, textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%' },
              children: contentChildren,
            } }],
          },
        },
        {
          type: 'div', props: {
            style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '20px 50px 30px', borderTop: `1px solid hsl(${accentHue},40%,80%)` },
            children: [
              { type: 'div', props: { style: { display: 'flex', alignItems: 'center', gap: '12px' }, children: [
                { type: 'span', props: { style: { fontSize: '24px', color: `hsl(${accentHue},50%,45%)` }, children: moodEmoji } },
                { type: 'span', props: { style: { fontSize: '22px', color: `hsl(${accentHue},20%,35%)` }, children: `— ${NICK_NAME}` } },
              ] } },
              { type: 'div', props: { style: { display: 'flex', alignItems: 'center', gap: '16px' }, children: [
                tagStr ? { type: 'span', props: { style: { fontSize: '18px', color: `hsl(${accentHue},40%,50%)` }, children: tagStr } } : null,
                { type: 'span', props: { style: { fontSize: '18px', color: `hsl(${accentHue},15%,55%)` }, children: dateStr } },
              ].filter(Boolean) } },
            ],
          },
        },
      ],
    },
  };

  const png = await renderToPng(element);
  return pngResponse(png);
};
