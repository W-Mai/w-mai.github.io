// Lightweight inline Markdown renderer for short-form content.
// Supports: bold, italic, inline code, links. No block-level elements.

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function renderInlineMarkdown(content: string): string {
  let html = escapeHtml(content);

  // Inline code (must be first to prevent inner patterns from matching)
  html = html.replace(/`([^`]+)`/g, '<code>$1</code>');

  // Bold + italic
  html = html.replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>');
  // Bold
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  // Italic
  html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');

  // Links [text](url)
  html = html.replace(
    /\[([^\]]+)\]\(([^)]+)\)/g,
    '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>',
  );

  // Block sticker ::sticker[name]::
  html = html.replace(
    /::sticker\[([^\]]+)\]::/g,
    '<div class="sticker-block"><img src="/stickers/$1" alt="$1" loading="lazy" /></div>',
  );

  // Inline sticker :sticker[name]:
  html = html.replace(
    /:sticker\[([^\]]+)\]:/g,
    '<img class="sticker-inline" src="/stickers/$1" alt="$1" loading="lazy" />',
  );

  return html;
}
