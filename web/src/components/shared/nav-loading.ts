import { NAV_LOADING_TEXT } from '~/consts';

/**
 * Neumorphic loading overlay for slow network navigation.
 * Aborts pending low-priority images and shows a spinner after 400ms.
 */

const OVERLAY_ID = 'nav-loading-overlay';
const STYLE_ID = 'nav-loading-style';
const DELAY_MS = 400;

const CSS = `#${OVERLAY_ID}{position:fixed;inset:0;z-index:9999;display:flex;align-items:center;justify-content:center;background:color-mix(in srgb,var(--neu-bg,#e0e5ec) 85%,transparent);backdrop-filter:blur(6px);opacity:0;pointer-events:none;transition:opacity .4s ease}#${OVERLAY_ID}.visible{opacity:1;pointer-events:auto}.nav-loading-card{display:flex;flex-direction:column;align-items:center;gap:12px;padding:24px 32px;border-radius:20px;background:var(--neu-bg,#e0e5ec);box-shadow:4px 4px 8px var(--neu-shadow-dark,rgb(163 177 198/.6)),-4px -4px 8px var(--neu-shadow-light,rgb(255 255 255/.5));transform:scale(.92);transition:transform .4s cubic-bezier(.34,1.56,.64,1)}#${OVERLAY_ID}.visible .nav-loading-card{transform:scale(1)}.nav-spinner-ring{width:40px;height:40px;border-radius:50%;box-shadow:inset 4px 4px 8px var(--neu-shadow-dark-strong,rgb(163 177 198/.7)),inset -4px -4px 8px var(--neu-shadow-light-strong,rgb(255 255 255/.8));display:flex;align-items:center;justify-content:center}.nav-spinner{width:24px;height:24px;border:3px solid var(--neu-shadow-dark,rgb(163 177 198/.6));border-top-color:var(--text-link,#4a90d9);border-radius:50%;animation:nav-spin .8s linear infinite}@keyframes nav-spin{to{transform:rotate(360deg)}}`;

const OVERLAY_HTML = `<div class="nav-loading-card"><div class="nav-spinner-ring"><div class="nav-spinner"></div></div><div style="font-size:14px;color:var(--text-secondary,#64748b)">${NAV_LOADING_TEXT}</div></div>`;

let timer: ReturnType<typeof setTimeout> | null = null;

function injectStyle(doc: Document): void {
  if (doc.getElementById(STYLE_ID)) return;
  const style = doc.createElement('style');
  style.id = STYLE_ID;
  style.textContent = CSS;
  doc.head.appendChild(style);
}

function ensureOverlay(): void {
  injectStyle(document);
  if (document.getElementById(OVERLAY_ID) || !document.body) return;
  const el = document.createElement('div');
  el.id = OVERLAY_ID;
  el.setAttribute('aria-hidden', 'true');
  el.innerHTML = OVERLAY_HTML;
  document.body.appendChild(el);
}

function show(): void {
  ensureOverlay();
  document.getElementById(OVERLAY_ID)?.classList.add('visible');
}

function hide(): void {
  if (timer) { clearTimeout(timer); timer = null; }
  document.getElementById(OVERLAY_ID)?.classList.remove('visible');
}

function abortPendingImages(): void {
  document.querySelectorAll('img[fetchpriority="low"], img[loading="lazy"]:not(picture img)').forEach((img) => {
    if (!img.complete) { img.removeAttribute('src'); img.removeAttribute('srcset'); }
  });
}

// Initial setup
ensureOverlay();

// Astro client-side navigation
document.addEventListener('astro:before-preparation', () => {
  abortPendingImages();
  timer = setTimeout(show, DELAY_MS);
});

// Inject overlay into incoming document before swap
document.addEventListener('astro:before-swap', (e: any) => {
  const newDoc = e.newDocument as Document;
  injectStyle(newDoc);
  if (newDoc.body && !newDoc.getElementById(OVERLAY_ID)) {
    const el = newDoc.createElement('div');
    el.id = OVERLAY_ID;
    el.setAttribute('aria-hidden', 'true');
    el.innerHTML = OVERLAY_HTML;
    newDoc.body.appendChild(el);
  }
});

// Hide after navigation completes
document.addEventListener('astro:after-swap', () => { hide(); ensureOverlay(); });
document.addEventListener('astro:page-load', () => { hide(); ensureOverlay(); });
