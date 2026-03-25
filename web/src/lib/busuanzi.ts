// Shared busuanzi script loader for SPA navigation support.
// Both BusuanziCounter and BusuanziFooter use this to avoid duplicate logic.

let reloadPromise: Promise<void> | null = null;

function loadScript(): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    (window as any).busuanziRequestSent = false;

    const old = document.getElementById('busuanzi-script');
    if (old) old.remove();

    const script = document.createElement('script');
    script.id = 'busuanzi-script';
    script.src = '/busuanzi.min.js';
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('busuanzi script failed'));
    document.head.appendChild(script);
  });
}

/** Trigger a busuanzi reload (deduped across concurrent callers). */
export function triggerReload(): Promise<void> {
  if (!reloadPromise) {
    reloadPromise = loadScript().finally(() => {
      reloadPromise = null;
    });
  }
  return reloadPromise;
}
