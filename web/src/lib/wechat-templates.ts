// WeChat article style templates.
// Each template maps data-wechat-tag values to inline CSS strings.
// WeChat official accounts only support inline styles — no class or external CSS.

export interface WechatTemplate {
  id: string;
  name: string;
  description: string;
  styles: Record<string, string>;
}

// Required style keys that every template must define
export const REQUIRED_STYLE_KEYS = [
  'h1', 'h2', 'h3', 'h4',
  'p', 'strong', 'em', 'a',
  'ul', 'ol', 'li',
  'blockquote', 'hr',
  'code-block', 'inline-code',
  'image',
  'sticker-inline', 'sticker-block',
] as const;

export type RequiredStyleKey = (typeof REQUIRED_STYLE_KEYS)[number];

// ---------- Tutorial template (教程类) ----------
// Clean, structured, blue-accented headings, prominent code blocks
const tutorialStyles: Record<string, string> = {
  h1: 'font-size: 24px; font-weight: bold; color: #1a6fb5; border-bottom: 2px solid #1a6fb5; padding-bottom: 8px; margin: 30px 0 16px 0; line-height: 1.4;',
  h2: 'font-size: 20px; font-weight: bold; color: #1a6fb5; border-left: 4px solid #1a6fb5; padding-left: 10px; margin: 24px 0 12px 0; line-height: 1.4;',
  h3: 'font-size: 18px; font-weight: bold; color: #2a7dc9; margin: 20px 0 10px 0; line-height: 1.4;',
  h4: 'font-size: 16px; font-weight: bold; color: #3a8dd9; margin: 16px 0 8px 0; line-height: 1.4;',
  p: 'font-size: 15px; color: #333333; line-height: 1.8; margin: 10px 0; text-align: justify;',
  strong: 'font-weight: bold; color: #1a1a1a;',
  em: 'font-style: italic; color: #555555;',
  a: 'color: #1a6fb5; text-decoration: none; border-bottom: 1px solid #1a6fb5;',
  ul: 'list-style-type: disc; padding-left: 24px; margin: 10px 0; color: #333333;',
  ol: 'list-style-type: decimal; padding-left: 24px; margin: 10px 0; color: #333333;',
  li: 'font-size: 15px; line-height: 1.8; margin: 4px 0; color: #333333; text-align: justify;',
  blockquote: 'border-left: 4px solid #1a6fb5; padding: 10px 16px; margin: 16px 0; background-color: #f0f7ff; color: #555555; font-size: 14px; line-height: 1.6;',
  hr: 'border: none; border-top: 1px solid #d0d7de; margin: 24px 0;',
  'code-block': 'display: block; background-color: #1e1e1e; color: #d4d4d4; padding: 16px; border-radius: 6px; font-family: Consolas, Monaco, "Courier New", monospace; font-size: 13px; line-height: 1.6; overflow-x: auto; margin: 16px 0; white-space: pre-wrap; word-wrap: break-word;',
  'inline-code': 'background-color: #f0f2f5; color: #d14; padding: 2px 6px; border-radius: 3px; font-family: Consolas, Monaco, "Courier New", monospace; font-size: 90%;',
  image: 'max-width: 100%; height: auto; display: block; margin: 16px auto; border-radius: 4px;',
  'sticker-inline': 'height: 1.5em; vertical-align: middle; display: inline;',
  'sticker-block': 'text-align: center; margin: 16px 0; max-width: 200px; display: block; margin-left: auto; margin-right: auto;',
};

// ---------- Narrative template (记叙抒情类) ----------
// Warm tones, larger text, generous line-height, soft blockquotes
const narrativeStyles: Record<string, string> = {
  h1: 'font-size: 26px; font-weight: bold; color: #8b5e3c; text-align: center; margin: 32px 0 20px 0; line-height: 1.5;',
  h2: 'font-size: 22px; font-weight: bold; color: #a0522d; margin: 28px 0 14px 0; line-height: 1.5;',
  h3: 'font-size: 19px; font-weight: bold; color: #b5651d; margin: 22px 0 10px 0; line-height: 1.5;',
  h4: 'font-size: 17px; font-weight: bold; color: #c47a2c; margin: 18px 0 8px 0; line-height: 1.5;',
  p: 'font-size: 17px; color: #3b3b3b; line-height: 2; margin: 12px 0; text-indent: 0; text-align: justify;',
  strong: 'font-weight: bold; color: #2b2b2b;',
  em: 'font-style: italic; color: #6b4c3b;',
  a: 'color: #a0522d; text-decoration: none; border-bottom: 1px dashed #a0522d;',
  ul: 'list-style-type: disc; padding-left: 24px; margin: 12px 0; color: #3b3b3b;',
  ol: 'list-style-type: decimal; padding-left: 24px; margin: 12px 0; color: #3b3b3b;',
  li: 'font-size: 17px; line-height: 2; margin: 6px 0; color: #3b3b3b; text-align: justify;',
  blockquote: 'border-left: 3px solid #d4b896; padding: 12px 20px; margin: 18px 0; background-color: #fdf8f0; color: #6b5b4b; font-style: italic; font-size: 16px; line-height: 1.8;',
  hr: 'border: none; border-top: 1px dashed #d4b896; margin: 28px auto; width: 60%;',
  'code-block': 'display: block; background-color: #faf6f0; color: #5b4636; padding: 14px; border-radius: 8px; font-family: Consolas, Monaco, "Courier New", monospace; font-size: 14px; line-height: 1.6; overflow-x: auto; margin: 16px 0; white-space: pre-wrap; word-wrap: break-word; border: 1px solid #e8ddd0;',
  'inline-code': 'background-color: #faf6f0; color: #8b5e3c; padding: 2px 6px; border-radius: 3px; font-family: Consolas, Monaco, "Courier New", monospace; font-size: 90%;',
  image: 'max-width: 100%; height: auto; display: block; margin: 20px auto; border-radius: 8px;',
  'sticker-inline': 'height: 1.5em; vertical-align: middle; display: inline;',
  'sticker-block': 'text-align: center; margin: 20px 0; max-width: 200px; display: block; margin-left: auto; margin-right: auto;',
};

// ---------- Opinion template (议论批判类) ----------
// Bold emphasis, red/dark accents, strong blockquotes, thick dividers
const opinionStyles: Record<string, string> = {
  h1: 'font-size: 24px; font-weight: 900; color: #1a1a1a; border-bottom: 3px solid #c0392b; padding-bottom: 8px; margin: 30px 0 16px 0; line-height: 1.4;',
  h2: 'font-size: 20px; font-weight: 800; color: #2c2c2c; border-left: 5px solid #c0392b; padding-left: 12px; margin: 24px 0 12px 0; line-height: 1.4;',
  h3: 'font-size: 18px; font-weight: 700; color: #333333; margin: 20px 0 10px 0; line-height: 1.4;',
  h4: 'font-size: 16px; font-weight: 700; color: #444444; margin: 16px 0 8px 0; line-height: 1.4;',
  p: 'font-size: 16px; color: #2c2c2c; line-height: 1.8; margin: 10px 0; text-align: justify;',
  strong: 'font-weight: 900; color: #c0392b;',
  em: 'font-style: italic; color: #2c2c2c; font-weight: bold;',
  a: 'color: #c0392b; text-decoration: none; font-weight: bold; border-bottom: 2px solid #c0392b;',
  ul: 'list-style-type: square; padding-left: 24px; margin: 10px 0; color: #2c2c2c;',
  ol: 'list-style-type: decimal; padding-left: 24px; margin: 10px 0; color: #2c2c2c;',
  li: 'font-size: 16px; line-height: 1.8; margin: 4px 0; color: #2c2c2c; text-align: justify;',
  blockquote: 'border-left: 5px solid #c0392b; padding: 12px 18px; margin: 18px 0; background-color: #fdf2f2; color: #1a1a1a; font-weight: bold; font-size: 15px; line-height: 1.7;',
  hr: 'border: none; border-top: 3px solid #333333; margin: 28px 0;',
  'code-block': 'display: block; background-color: #2d2d2d; color: #f8f8f2; padding: 16px; border-radius: 4px; font-family: Consolas, Monaco, "Courier New", monospace; font-size: 13px; line-height: 1.6; overflow-x: auto; margin: 16px 0; white-space: pre-wrap; word-wrap: break-word;',
  'inline-code': 'background-color: #f2e6e6; color: #c0392b; padding: 2px 6px; border-radius: 3px; font-family: Consolas, Monaco, "Courier New", monospace; font-size: 90%; font-weight: bold;',
  image: 'max-width: 100%; height: auto; display: block; margin: 16px auto;',
  'sticker-inline': 'height: 1.5em; vertical-align: middle; display: inline;',
  'sticker-block': 'text-align: center; margin: 16px 0; max-width: 200px; display: block; margin-left: auto; margin-right: auto;',
};

export const WECHAT_TEMPLATES: WechatTemplate[] = [
  {
    id: 'tutorial',
    name: '教程类',
    description: '强调代码块和步骤编号，标题层级清晰，适合技术教程和操作指南',
    styles: tutorialStyles,
  },
  {
    id: 'narrative',
    name: '记叙抒情类',
    description: '正文字号偏大、行距宽松，引用块柔和，适合叙事、随笔、生活类文章',
    styles: narrativeStyles,
  },
  {
    id: 'opinion',
    name: '议论批判类',
    description: '粗体和强调更醒目，引用块和分割线风格鲜明，适合观点输出、评论、分析类文章',
    styles: opinionStyles,
  },
];

// Apply a style template to tagged HTML (client-side, uses DOMParser).
// Walks all elements with data-wechat-tag, writes inline styles from the
// template, then strips class attributes, data-wechat-tag markers, and
// any <style> tags so the output is pure inline-styled HTML.
export function applyTemplate(
  taggedHtml: string,
  template: WechatTemplate,
): string {
  const doc = new DOMParser().parseFromString(taggedHtml, 'text/html');

  // Apply inline styles based on data-wechat-tag
  const tagged = doc.querySelectorAll('[data-wechat-tag]');
  for (const el of tagged) {
    const tag = el.getAttribute('data-wechat-tag');
    if (tag && template.styles[tag]) {
      el.setAttribute('style', template.styles[tag]);
    }
    el.removeAttribute('data-wechat-tag');
  }

  // Remove all class attributes (WeChat doesn't support them)
  const withClass = doc.querySelectorAll('[class]');
  for (const el of withClass) {
    el.removeAttribute('class');
  }

  // Remove any <style> tags
  const styleTags = doc.querySelectorAll('style');
  for (const el of styleTags) {
    el.remove();
  }

  return doc.body.innerHTML;
}
