/**
 * Build-time search content normalization.
 *
 * Keep this separate from the browser search engine: attachment-aware parsing
 * depends on the Markdown toolchain and is only needed while generating the
 * static search index.
 */

import { prepareAttachmentText } from '~/lib/attachments/text';

/** Strip MDX/HTML markup from raw content, returning plain text. */
export function stripMdx(raw: string): string {
  let text = raw;

  text = text.replace(/^---[\s\S]*?---/gm, '');
  text = text.replace(/^(?:import|export)\s+.*$/gm, '');

  const attachments = prepareAttachmentText(text, { mdx: 'auto' });
  text = attachments.source;

  text = text.replace(/<[^>]+>/g, '');
  text = text.replace(/^#{1,6}\s+/gm, '');
  text = text.replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1');
  text = text.replace(/\[([^\]]*)\]\([^)]*\)/g, '$1');
  text = text.replace(/```[\s\S]*?```/g, '');
  text = text.replace(/`([^`]*)`/g, '$1');
  text = text.replace(/\*\*([^*]*)\*\*/g, '$1');
  text = text.replace(/__([^_]*)__/g, '$1');
  text = text.replace(/\*([^*]*)\*/g, '$1');
  text = text.replace(/_([^_]*)_/g, '$1');
  text = text.replace(/~~([^~]*)~~/g, '$1');
  text = text.replace(/^[-*_]{3,}\s*$/gm, '');
  text = text.replace(/^>\s?/gm, '');
  text = text.replace(/^[\s]*[-*+]\s+/gm, '');
  text = text.replace(/^[\s]*\d+\.\s+/gm, '');
  text = text.replace(/::?sticker\[[^\]]*\]::?/g, '');
  text = text.replace(/\n{2,}/g, '\n').replace(/[ \t]+/g, ' ').trim();

  return attachments.restore(text);
}
