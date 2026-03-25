// Lightweight sync inline Markdown renderer for client-side preview.
// Supports: bold, italic, inline code, links, stickers, line breaks.

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function renderLine(line: string): string {
  let html = escapeHtml(line);
  html = html.replace(/`([^`]+)`/g, '<code>$1</code>');
  html = html.replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>');
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');
  html = html.replace(
    /\[([^\]]+)\]\(([^)]+)\)/g,
    '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>',
  );
  html = html.replace(
    /::sticker\[([^\]]+)\]::/g,
    '<div class="sticker-block"><img src="/stickers/$1" alt="$1" loading="lazy" /></div>',
  );
  html = html.replace(
    /:sticker\[([^\]]+)\]:/g,
    '<img class="sticker-inline" src="/stickers/$1" alt="$1" loading="lazy" />',
  );
  return html;
}

/** Sync inline Markdown renderer for editor preview */
export function renderPreviewMarkdown(content: string): string {
  return content
    .split('\n')
    .map((line) => {
      const trimmed = line.trim();
      if (!trimmed) return '<br/>';
      const hMatch = trimmed.match(/^(#{1,6})\s+(.+)$/);
      if (hMatch) return `<h${hMatch[1].length}>${renderLine(hMatch[2])}</h${hMatch[1].length}>`;
      return renderLine(trimmed);
    })
    .join('\n');
}
