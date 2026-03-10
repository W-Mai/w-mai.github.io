import {
  autocompletion,
  type CompletionContext,
  type CompletionResult,
  type Completion,
} from '@codemirror/autocomplete';
import type { Extension } from '@codemirror/state';
import { EditorView } from '@codemirror/view';

interface AssetInfo { name: string; size: number; ext: string; }
interface StickerInfo { name: string; size: number; meta?: { aiName?: string; description?: string; tags?: string[] } }

const IMAGE_EXTS = new Set(['.png', '.jpg', '.jpeg', '.gif', '.svg', '.webp', '.avif', '.ico']);

let assetCache: AssetInfo[] = [];
let stickerCache: StickerInfo[] = [];
let assetFetched = false;
let stickerFetched = false;

/** Callback invoked when sticker syntax is selected — opens the grid picker */
let onStickerPickerOpen: ((pos: { x: number; y: number }, isBlock: boolean) => void) | null = null;

/** Register the sticker picker callback from React */
export function setStickerPickerCallback(cb: typeof onStickerPickerOpen) {
  onStickerPickerOpen = cb;
}

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
 * Stage 1: Sticker syntax completion — triggers on `:s` or `::s` prefix,
 * offers `:sticker[` and `::sticker[` commands. Selecting one inserts the
 * syntax and places cursor inside `[` ready for stage 2 name completion.
 */
function stickerSyntaxCompletion(ctx: CompletionContext): CompletionResult | null {
  const line = ctx.state.doc.lineAt(ctx.pos);
  const textBefore = line.text.slice(0, ctx.pos - line.from);

  // Already inside sticker bracket — let stage 2 handle it
  if (/::?sticker\[/.test(textBefore)) return null;

  // Match `:` or `::` followed by partial text (at least 1 char after colon)
  const m = textBefore.match(/(:{1,2})(\w*)$/);
  if (!m || m[2].length === 0) return null;

  const colons = m[1];
  const typed = m[2];
  const from = ctx.pos - colons.length - typed.length;

  const options: Completion[] = [];

  // Inline sticker: :sticker[name]:
  if (':sticker['.startsWith(colons + typed) || ('sticker'.startsWith(typed) && colons === ':')) {
    options.push({
      label: ':sticker[…]:',
      apply: (view, _completion, from, to) => {
        view.dispatch({ changes: { from, to, insert: ':sticker[' } });
        // Get cursor screen coords and open grid picker
        const coords = view.coordsAtPos(view.state.selection.main.head);
        if (coords && onStickerPickerOpen) {
          onStickerPickerOpen({ x: coords.left, y: coords.bottom + 4 }, false);
        }
      },
      detail: 'inline sticker',
      type: 'keyword',
    });
  }

  // Block sticker: ::sticker[name]::
  if ('::sticker['.startsWith(colons + typed) || ('sticker'.startsWith(typed) && colons === '::')) {
    options.push({
      label: '::sticker[…]::',
      apply: (view, _completion, from, to) => {
        view.dispatch({ changes: { from, to, insert: '::sticker[' } });
        const coords = view.coordsAtPos(view.state.selection.main.head);
        if (coords && onStickerPickerOpen) {
          onStickerPickerOpen({ x: coords.left, y: coords.bottom + 4 }, true);
        }
      },
      detail: 'block sticker',
      type: 'keyword',
    });
  }

  return options.length > 0 ? { from, options, filter: false } : null;
}

/** CodeMirror extension: asset + sticker autocomplete with preview tooltips */
export function editorAutocomplete(): Extension {
  return autocompletion({
    override: [stickerSyntaxCompletion, assetCompletion],
    icons: false,
    optionClass: () => 'cm-editor-autocomplete',
    tooltipClass: () => 'cm-editor-autocomplete-tooltip',
  });
}
