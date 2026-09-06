import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const attachmentCss = readFileSync(
  new URL('../../../styles/attachments.css', import.meta.url),
  'utf8',
);

describe('attachment accessibility styles', () => {
  it('keeps card actions compact and restores the article table treatment', () => {
    expect(attachmentCss).toMatch(/\.attachment-card__actions \{[\s\S]*?position: absolute;[\s\S]*?inset-inline-end: 0\.625rem;/);
    expect(attachmentCss).toMatch(/\.attachment-card__button \{[\s\S]*?inline-size: 2rem;[\s\S]*?block-size: 2rem;/);
    expect(attachmentCss).toMatch(/\.attachment-card__icon \{[\s\S]*?inline-size: 1rem;[\s\S]*?block-size: 1rem;/);
    expect(attachmentCss).toMatch(/\.attachment-card__preview--table \{[\s\S]*?padding: 0 var\(--space-md\) var\(--space-md\);/);
    expect(attachmentCss).toMatch(/\) th \{[\s\S]*?position: sticky;[\s\S]*?inset-block-start: 0;[\s\S]*?z-index: 1;[\s\S]*?background: var\(--neu-bg\);/);
    expect(attachmentCss).toMatch(/\.attachment-card__table tbody \{[\s\S]*?inset 4px 4px 8px var\(--neu-shadow-dark-strong\)/);
    expect(attachmentCss).toContain('.attachment-card__table tbody td:not(:last-child)');
    expect(attachmentCss).toContain('.attachment-card__table tbody tr + tr td:not(:last-child)');
  });

  it('restores every custom focus surface in forced-colors mode', () => {
    const forcedColors = attachmentCss.match(/@media \(forced-colors: active\) \{([\s\S]*?)\n\}/)?.[1];

    expect(forcedColors).toBeDefined();
    expect(forcedColors).toContain('.attachment-card__button:focus-visible');
    expect(forcedColors).toContain('.attachment-inline:focus-visible');
    expect(forcedColors).toContain('.attachment-card__preview:focus-visible');
    expect(forcedColors).toContain('.attachment-pdf__viewport:focus-visible');
    expect(forcedColors).toContain('outline: 2px solid Highlight');
    expect(forcedColors).toContain('.attachment-card__table :is(th, td)');
    expect(forcedColors).toContain('border: 1px solid CanvasText');
  });
});
