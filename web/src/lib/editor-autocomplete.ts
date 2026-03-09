import {
  autocompletion,
  type CompletionContext,
  type CompletionResult,
  type Completion,
} from '@codemirror/autocomplete';
import type { Extension } from '@codemirror/state';

interface AssetInfo { name: string; size: number; ext: string; }
interface StickerInfo { name: string; size: number; }

const IMAGE_EXTS = new Set(['.png', '.jpg', '.jpeg', '.gif', '.svg', '.webp', '.avif', '.ico']);

let assetCache: AssetInfo[] = [];
let stickerCache: StickerInfo[] = [];
let assetFetched = false;
let stickerFetched = false;

async function fetchAssets(): Promise<AssetInfo[]> {
  if (assetFetched) return assetCache;
  try {
    const res = await fetch('/api/editor/assets');
    assetCache = await res.json();
    assetFetched = true;
  } catch { assetCache = []; }
  return assetCache;
}

async function fetchStickers(): Promise<StickerInfo[]> {
  if (stickerFetched) return stickerCache;
  try {
    const res = await fetch('/api/editor/stickers');
    stickerCache = await res.json();
    stickerFetched = true;
  } catch { stickerCache = []; }
  return stickerCache;
}

/** Invalidate caches so next completion re-fetches */
export function invalidateAutocompleteCaches() {
  assetFetched = false;
  stickerFetched = false;
}

/** Build preview info HTML for tooltip */
function assetPreviewInfo(name: string, isImage: boolean): Node | null {
  const container = document.createElement('div');
  container.style.cssText = 'padding:4px;max-width:220px;';
  if (isImage) {
    const img = document.createElement('img');
    img.src = `/api/editor/assets/${encodeURIComponent(name)}`;
    img.alt = name;
    img.style.cssText = 'max-width:200px;max-height:120px;object-fit:contain;border-radius:4px;display:block;margin-bottom:4px;';
    container.appendChild(img);
  }
  const label = document.createElement('span');
  label.style.cssText = 'font-size:11px;color:#6b7280;';
  label.textContent = name;
  container.appendChild(label);
  return container;
}

function stickerPreviewInfo(name: string): Node {
  const container = document.createElement('div');
  container.style.cssText = 'padding:4px;max-width:180px;text-align:center;';
  const img = document.createElement('img');
  img.src = `/api/editor/stickers/${encodeURIComponent(name)}`;
  img.alt = name;
  img.style.cssText = 'max-width:120px;max-height:120px;object-fit:contain;border-radius:4px;display:block;margin:0 auto 4px;';
  container.appendChild(img);
  const label = document.createElement('span');
  label.style.cssText = 'font-size:11px;color:#6b7280;';
  label.textContent = name.replace(/\.[^.]+$/, '');
  container.appendChild(label);
  return container;
}

/**
 * Asset path completion — triggers after:
 *   - `](` in markdown image/link syntax
 *   - `src="` or `src='` in JSX/HTML
 *   - `./assets/` typed manually
 */
async function assetCompletion(ctx: CompletionContext): Promise<CompletionResult | null> {
  const line = ctx.state.doc.lineAt(ctx.pos);
  const textBefore = line.text.slice(0, ctx.pos - line.from);

  // Match patterns where asset path is expected
  const patterns = [
    /\]\(\.?\/?\/?assets\/([^\s)]*)$/,       // ![alt](./assets/...
    /\]\(([^\s)]*)$/,                          // ![alt](...
    /src=["']\.?\/?\/?assets\/([^\s"']*)$/,   // src="./assets/...
    /heroImage:\s*['"]?\.?\/?\/?assets\/([^\s'"]*)?$/,  // frontmatter heroImage
    /:\s*['"]?\.?\/?\/?assets\/([^\s'"]*)?$/,  // generic yaml: ./assets/...
  ];

  let matchedFrom: number | null = null;
  let prefix = '';
  let insertPrefix = '';

  for (const re of patterns) {
    const m = textBefore.match(re);
    if (m) {
      prefix = m[1] || '';
      matchedFrom = ctx.pos - prefix.length;
      // For bare ]( pattern, prepend ./assets/
      if (re === patterns[1] && !textBefore.match(/\]\(\.?\/?\/?assets\//)) {
        insertPrefix = './assets/';
      }
      break;
    }
  }

  if (matchedFrom === null) return null;

  const assets = await fetchAssets();
  if (assets.length === 0) return null;

  const options: Completion[] = assets
    .filter(a => a.name.toLowerCase().includes(prefix.toLowerCase()))
    .map(a => {
      const isImage = IMAGE_EXTS.has(a.ext);
      return {
        label: a.name,
        apply: `${insertPrefix}${a.name}`,
        type: isImage ? 'variable' : 'text',
        detail: a.ext.replace('.', '').toUpperCase(),
        info: () => assetPreviewInfo(a.name, isImage),
        boost: isImage ? 1 : 0,
      };
    });

  return options.length > 0 ? { from: matchedFrom, options, filter: true } : null;
}

/**
 * Sticker name completion — triggers after `:sticker[` or `::sticker[`
 */
async function stickerCompletion(ctx: CompletionContext): Promise<CompletionResult | null> {
  const line = ctx.state.doc.lineAt(ctx.pos);
  const textBefore = line.text.slice(0, ctx.pos - line.from);

  const m = textBefore.match(/::?sticker\[([^\]]*)$/);
  if (!m) return null;

  const prefix = m[1];
  const from = ctx.pos - prefix.length;

  const stickers = await fetchStickers();
  if (stickers.length === 0) return null;

  const options: Completion[] = stickers
    .filter(s => s.name.toLowerCase().includes(prefix.toLowerCase()))
    .map(s => ({
      label: s.name,
      type: 'variable',
      detail: 'sticker',
      info: () => stickerPreviewInfo(s.name),
    }));

  return options.length > 0 ? { from, options, filter: true } : null;
}

/** CodeMirror extension: asset + sticker autocomplete with preview tooltips */
export function editorAutocomplete(): Extension {
  return autocompletion({
    override: [assetCompletion, stickerCompletion],
    icons: false,
    optionClass: () => 'cm-editor-autocomplete',
    tooltipClass: () => 'cm-editor-autocomplete-tooltip',
  });
}
