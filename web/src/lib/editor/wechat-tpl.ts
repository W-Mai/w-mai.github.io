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
  'p', 'strong', 'em', 'del', 'sup', 'a',
  'ul', 'ol', 'li',
  'blockquote', 'hr',
  'code-block', 'inline-code',
  'image',
  'table', 'thead', 'tbody', 'tr', 'th', 'td',
  'sticker-inline', 'sticker-block',
  'formula-inline', 'formula-block', 'diagram',
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
  del: 'text-decoration: line-through; color: #999999;',
  sup: 'font-size: 80%; color: #1a6fb5; vertical-align: super; line-height: 0;',
  a: 'color: #1a6fb5; text-decoration: none; border-bottom: 1px solid #1a6fb5;',
  ul: 'list-style: none; padding-left: 1.5em; margin: 10px 0; color: #333333;',
  ol: 'list-style: none; padding-left: 1.5em; margin: 10px 0; color: #333333;',
  li: 'display: block; font-size: 15px; line-height: 1.8; margin: 4px 0; color: #333333; text-align: justify;',
  blockquote: 'border-left: 4px solid #1a6fb5; padding: 10px 16px; margin: 16px 0; background-color: #f0f7ff; color: #555555; font-size: 14px; line-height: 1.6;',
  hr: 'border: none; border-top: 1px solid #d0d7de; margin: 24px 0;',
  'code-block': 'display: block; background-color: #1e1e1e; color: #d4d4d4; padding: 16px; border-radius: 6px; font-family: Consolas, Monaco, "Courier New", monospace; font-size: 13px; line-height: 1.6; overflow-x: auto; margin: 16px 0; white-space: pre; word-wrap: normal;',
  'inline-code': 'background-color: #f0f2f5; color: #d14; padding: 2px 6px; border-radius: 3px; font-family: Consolas, Monaco, "Courier New", monospace; font-size: 90%;',
  image: 'max-width: 100%; height: auto; display: block; margin: 16px auto; border-radius: 4px;',
  table: 'border-collapse: collapse; width: 100%; margin: 16px 0; font-size: 14px; line-height: 1.6;',
  thead: '',
  tbody: '',
  tr: 'border-bottom: 1px solid #d0d7de;',
  th: 'border: 1px solid #d0d7de; padding: 8px 12px; background-color: #f0f7ff; font-weight: bold; color: #1a6fb5; text-align: left;',
  td: 'border: 1px solid #d0d7de; padding: 8px 12px; color: #333333;',
  'sticker-inline': 'height: 1.5em; vertical-align: middle; display: inline;',
  'sticker-block': 'text-align: center; margin: 16px 0; max-width: 200px; display: block; margin-left: auto; margin-right: auto;',
  'formula-inline': 'display: inline-block; vertical-align: middle; line-height: 0;',
  'formula-block': 'display: block; text-align: center; margin: 16px auto; max-width: 100%; overflow-x: auto;',
  'diagram': 'display: block; text-align: center; margin: 16px auto; max-width: 100%; overflow-x: auto;',
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
  del: 'text-decoration: line-through; color: #999999;',
  sup: 'font-size: 80%; color: #a0522d; vertical-align: super; line-height: 0;',
  a: 'color: #a0522d; text-decoration: none; border-bottom: 1px dashed #a0522d;',
  ul: 'list-style: none; padding-left: 1.5em; margin: 12px 0; color: #3b3b3b;',
  ol: 'list-style: none; padding-left: 1.5em; margin: 12px 0; color: #3b3b3b;',
  li: 'display: block; font-size: 17px; line-height: 2; margin: 6px 0; color: #3b3b3b; text-align: justify;',
  blockquote: 'border-left: 3px solid #d4b896; padding: 12px 20px; margin: 18px 0; background-color: #fdf8f0; color: #6b5b4b; font-style: italic; font-size: 16px; line-height: 1.8;',
  hr: 'border: none; border-top: 1px dashed #d4b896; margin: 28px auto; width: 60%;',
  'code-block': 'display: block; background-color: #faf6f0; color: #5b4636; padding: 14px; border-radius: 8px; font-family: Consolas, Monaco, "Courier New", monospace; font-size: 14px; line-height: 1.6; overflow-x: auto; margin: 16px 0; white-space: pre; word-wrap: normal; border: 1px solid #e8ddd0;',
  'inline-code': 'background-color: #faf6f0; color: #8b5e3c; padding: 2px 6px; border-radius: 3px; font-family: Consolas, Monaco, "Courier New", monospace; font-size: 90%;',
  image: 'max-width: 100%; height: auto; display: block; margin: 20px auto; border-radius: 8px;',
  table: 'border-collapse: collapse; width: 100%; margin: 18px 0; font-size: 16px; line-height: 1.8;',
  thead: '',
  tbody: '',
  tr: 'border-bottom: 1px solid #e8ddd0;',
  th: 'border: 1px solid #e8ddd0; padding: 10px 14px; background-color: #fdf8f0; font-weight: bold; color: #8b5e3c; text-align: left;',
  td: 'border: 1px solid #e8ddd0; padding: 10px 14px; color: #3b3b3b;',
  'sticker-inline': 'height: 1.5em; vertical-align: middle; display: inline;',
  'sticker-block': 'text-align: center; margin: 20px 0; max-width: 200px; display: block; margin-left: auto; margin-right: auto;',
  'formula-inline': 'display: inline-block; vertical-align: middle; line-height: 0;',
  'formula-block': 'display: block; text-align: center; margin: 16px auto; max-width: 100%; overflow-x: auto;',
  'diagram': 'display: block; text-align: center; margin: 16px auto; max-width: 100%; overflow-x: auto;',
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
  del: 'text-decoration: line-through; color: #999999;',
  sup: 'font-size: 80%; color: #c0392b; vertical-align: super; line-height: 0;',
  a: 'color: #c0392b; text-decoration: none; font-weight: bold; border-bottom: 2px solid #c0392b;',
  ul: 'list-style: none; padding-left: 1.5em; margin: 10px 0; color: #2c2c2c;',
  ol: 'list-style: none; padding-left: 1.5em; margin: 10px 0; color: #2c2c2c;',
  li: 'display: block; font-size: 16px; line-height: 1.8; margin: 4px 0; color: #2c2c2c; text-align: justify;',
  blockquote: 'border-left: 5px solid #c0392b; padding: 12px 18px; margin: 18px 0; background-color: #fdf2f2; color: #1a1a1a; font-weight: bold; font-size: 15px; line-height: 1.7;',
  hr: 'border: none; border-top: 3px solid #333333; margin: 28px 0;',
  'code-block': 'display: block; background-color: #2d2d2d; color: #f8f8f2; padding: 16px; border-radius: 4px; font-family: Consolas, Monaco, "Courier New", monospace; font-size: 13px; line-height: 1.6; overflow-x: auto; margin: 16px 0; white-space: pre; word-wrap: normal;',
  'inline-code': 'background-color: #f2e6e6; color: #c0392b; padding: 2px 6px; border-radius: 3px; font-family: Consolas, Monaco, "Courier New", monospace; font-size: 90%; font-weight: bold;',
  image: 'max-width: 100%; height: auto; display: block; margin: 16px auto;',
  table: 'border-collapse: collapse; width: 100%; margin: 16px 0; font-size: 15px; line-height: 1.6;',
  thead: '',
  tbody: '',
  tr: 'border-bottom: 2px solid #333333;',
  th: 'border: 1px solid #333333; padding: 8px 12px; background-color: #2d2d2d; font-weight: 900; color: #f8f8f2; text-align: left;',
  td: 'border: 1px solid #666666; padding: 8px 12px; color: #2c2c2c;',
  'sticker-inline': 'height: 1.5em; vertical-align: middle; display: inline;',
  'sticker-block': 'text-align: center; margin: 16px 0; max-width: 200px; display: block; margin-left: auto; margin-right: auto;',
  'formula-inline': 'display: inline-block; vertical-align: middle; line-height: 0;',
  'formula-block': 'display: block; text-align: center; margin: 16px auto; max-width: 100%; overflow-x: auto;',
  'diagram': 'display: block; text-align: center; margin: 16px auto; max-width: 100%; overflow-x: auto;',
};

// ---------- Editorial template (媒体资讯类) ----------
// Magazine-style: clean headings, large body text, generous spacing, muted palette
const editorialStyles: Record<string, string> = {
  h1: 'font-size: 24px; font-weight: 700; color: #1a1a1a; margin: 32px 0 14px 0; line-height: 1.4; letter-spacing: 0.5px;',
  h2: 'font-size: 20px; font-weight: 700; color: #1a1a1a; margin: 24px 0 12px 0; line-height: 1.4; letter-spacing: 0.3px;',
  h3: 'font-size: 17px; font-weight: 600; color: #333333; margin: 20px 0 8px 0; line-height: 1.4;',
  h4: 'font-size: 15px; font-weight: 600; color: #444444; margin: 16px 0 6px 0; line-height: 1.4;',
  p: 'font-size: 15px; color: #333333; line-height: 1.75; margin: 10px 0; text-align: justify; letter-spacing: 0.3px;',
  strong: 'font-weight: 700; color: #1a1a1a;',
  em: 'font-style: italic; color: #555555;',
  del: 'text-decoration: line-through; color: #999999;',
  sup: 'font-size: 80%; color: #2b6cb0; vertical-align: super; line-height: 0;',
  a: 'color: #2b6cb0; text-decoration: none;',
  ul: 'list-style: none; padding-left: 1.5em; margin: 12px 0; color: #333333;',
  ol: 'list-style: none; padding-left: 1.5em; margin: 12px 0; color: #333333;',
  li: 'display: block; font-size: 15px; line-height: 1.75; margin: 4px 0; color: #333333; text-align: justify;',
  blockquote: 'border-left: 3px solid #d0d0d0; padding: 10px 16px; margin: 16px 0; color: #666666; font-size: 14px; line-height: 1.7; background-color: #fafafa;',
  hr: 'border: none; border-top: 1px solid #e5e5e5; margin: 24px 0;',
  'code-block': 'display: block; background-color: #f6f8fa; color: #24292e; padding: 16px; border-radius: 6px; font-family: Consolas, Monaco, "Courier New", monospace; font-size: 14px; line-height: 1.6; overflow-x: auto; margin: 18px 0; white-space: pre; word-wrap: normal; border: 1px solid #e1e4e8;',
  'inline-code': 'background-color: #f0f2f5; color: #476582; padding: 2px 6px; border-radius: 3px; font-family: Consolas, Monaco, "Courier New", monospace; font-size: 90%;',
  image: 'max-width: 100%; height: auto; display: block; margin: 18px auto;',
  table: 'border-collapse: collapse; width: 100%; margin: 16px 0; font-size: 14px; line-height: 1.6;',
  thead: '',
  tbody: '',
  tr: 'border-bottom: 1px solid #e5e5e5;',
  th: 'border: 1px solid #e1e4e8; padding: 8px 12px; background-color: #f6f8fa; font-weight: 600; color: #1a1a1a; text-align: left;',
  td: 'border: 1px solid #e1e4e8; padding: 8px 12px; color: #333333;',
  'sticker-inline': 'height: 1.5em; vertical-align: middle; display: inline;',
  'sticker-block': 'text-align: center; margin: 16px 0; max-width: 200px; display: block; margin-left: auto; margin-right: auto;',
  'formula-inline': 'display: inline-block; vertical-align: middle; line-height: 0;',
  'formula-block': 'display: block; text-align: center; margin: 14px auto; max-width: 100%; overflow-x: auto;',
  'diagram': 'display: block; text-align: center; margin: 14px auto; max-width: 100%; overflow-x: auto;',
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
  {
    id: 'editorial',
    name: '媒体资讯类',
    description: '杂志风格，标题简洁无装饰，正文大字号宽行距，配色低调专业，适合新闻、资讯、深度报道',
    styles: editorialStyles,
  },
];

// --- Style override types and constants ---

export interface StyleOverrides {
  fontFamily?: string;
  fontSizeRatio?: number;
  themeColor?: string;
  textIndent?: boolean;
}

export const FONT_FAMILY_OPTIONS = [
  {
    id: 'sans-serif',
    label: '无衬线',
    value: `-apple-system-font,BlinkMacSystemFont, Helvetica Neue, PingFang SC, Hiragino Sans GB, Microsoft YaHei UI, Microsoft YaHei, Arial, sans-serif`,
  },
  {
    id: 'serif',
    label: '衬线',
    value: `Optima-Regular, Optima, PingFangSC-light, PingFangTC-light, 'PingFang SC', Cambria, Cochin, Georgia, Times, 'Times New Roman', serif`,
  },
  {
    id: 'monospace',
    label: '等宽',
    value: `Menlo, Monaco, 'Courier New', monospace`,
  },
] as const;

export const FONT_SIZE_OPTIONS = [14, 15, 16, 17, 18] as const;

export const PRESET_COLORS = [
  { label: '经典蓝', value: '#0F4C81' },
  { label: '翡翠绿', value: '#009874' },
  { label: '活力橘', value: '#FA5151' },
  { label: '柠檬黄', value: '#FECE00' },
  { label: '薰衣紫', value: '#92617E' },
  { label: '天空蓝', value: '#55C9EA' },
  { label: '玫瑰金', value: '#B76E79' },
  { label: '橄榄绿', value: '#556B2F' },
  { label: '石墨黑', value: '#333333' },
  { label: '雾烟灰', value: '#A9A9A9' },
  { label: '樱花粉', value: '#FFB7C5' },
] as const;

// Tags where font-family override applies
export const TEXT_BEARING_TAGS = ['p', 'li', 'blockquote', 'h1', 'h2', 'h3', 'h4'];

// Tags where theme color replaces the `color` property
export const ACCENT_COLOR_TAGS = ['h1', 'h2', 'h3', 'h4', 'a', 'strong'];

// Tags where theme color replaces border color
export const ACCENT_BORDER_TAGS = ['blockquote', 'h2'];

// Tags where text-indent applies
export const INDENT_TAGS = ['p', 'li'];

// Parse an inline style string into a Map of property→value pairs.
// Handles empty strings, trailing semicolons, whitespace, and
// values containing colons (e.g. "border-left: 4px solid #1a6fb5").
export function parseInlineStyle(style: string): Map<string, string> {
  const map = new Map<string, string>();
  if (!style.trim()) return map;

  const declarations = style.split(';');
  for (const decl of declarations) {
    const trimmed = decl.trim();
    if (!trimmed) continue;
    const colonIdx = trimmed.indexOf(':');
    if (colonIdx === -1) continue;
    const prop = trimmed.slice(0, colonIdx).trim();
    const value = trimmed.slice(colonIdx + 1).trim();
    if (prop) map.set(prop, value);
  }
  return map;
}

// Serialize a Map of property→value pairs back to an inline style string.
// Each entry becomes "property: value;" separated by spaces.
// Empty maps return an empty string.
export function serializeInlineStyle(map: Map<string, string>): string {
  if (map.size === 0) return '';
  const parts: string[] = [];
  for (const [prop, value] of map) {
    parts.push(`${prop}: ${value};`);
  }
  return parts.join(' ');
}

// Extract the base paragraph font-size (in px) from a template.
// Parses the 'p' style key's font-size value. Falls back to 15 if not found.
export function getTemplateBaseFontSize(template: WechatTemplate): number {
  const pStyle = template.styles['p'];
  if (!pStyle) return 15;
  const parsed = parseInlineStyle(pStyle);
  const fontSize = parsed.get('font-size');
  if (!fontSize) return 15;
  const match = fontSize.match(/^(\d+(?:\.\d+)?)px$/);
  return match ? parseFloat(match[1]) : 15;
}

// Apply style overrides to a parsed style map for a given tag.
// Returns a new Map — the input map is never mutated.
export function applyOverridesToStyle(
  styleMap: Map<string, string>,
  tag: string,
  overrides: StyleOverrides,
): Map<string, string> {
  const result = new Map(styleMap);

  // 1. fontFamily: replace font-family on text-bearing tags
  if (overrides.fontFamily && TEXT_BEARING_TAGS.includes(tag)) {
    result.set('font-family', overrides.fontFamily);
  }

  // 2. fontSizeRatio: scale existing px font-size values
  if (overrides.fontSizeRatio != null) {
    const fs = result.get('font-size');
    if (fs) {
      const match = fs.match(/^(\d+(?:\.\d+)?)px$/);
      if (match) {
        const scaled = Math.max(1, Math.round(parseFloat(match[1]) * overrides.fontSizeRatio));
        result.set('font-size', `${scaled}px`);
      }
    }
  }

  // 3. themeColor: replace accent colors and border colors
  if (overrides.themeColor) {
    if (ACCENT_COLOR_TAGS.includes(tag)) {
      result.set('color', overrides.themeColor);
    }
    if (ACCENT_BORDER_TAGS.includes(tag)) {
      const hexPattern = /\#[0-9a-fA-F]{3,8}/g;
      for (const prop of ['border-left', 'border-left-color', 'border-bottom', 'border-bottom-color']) {
        const val = result.get(prop);
        if (val) {
          result.set(prop, val.replace(hexPattern, overrides.themeColor));
        }
      }
    }
  }

  // 4. textIndent: add text-indent on indent-eligible tags when enabled;
  // when false or undefined, preserve the template's original value.
  if (overrides.textIndent === true && INDENT_TAGS.includes(tag)) {
    result.set('text-indent', '2em');
  }

  return result;
}

const SETTINGS_STORAGE_KEY = 'editor:wechatExportSettings';

export interface PersistedSettings {
  fontFamilyId?: string;    // 'sans-serif' | 'serif' | 'monospace'
  fontSize?: number;        // 14-18
  themeColor?: string;      // hex color
  textIndent?: boolean;
}

// Validate a hex color string: #RGB, #RGBA, #RRGGBB, or #RRGGBBAA
export function isValidHexColor(color: string): boolean {
  return /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/.test(color);
}

// Load persisted settings from localStorage. Returns defaults on error or missing data.
export function loadSettings(): PersistedSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null) {
      localStorage.removeItem(SETTINGS_STORAGE_KEY);
      return {};
    }
    // Validate and sanitize each field
    const result: PersistedSettings = {};
    if (typeof parsed.fontFamilyId === 'string' && FONT_FAMILY_OPTIONS.some(o => o.id === parsed.fontFamilyId)) {
      result.fontFamilyId = parsed.fontFamilyId;
    }
    if (typeof parsed.fontSize === 'number' && FONT_SIZE_OPTIONS.includes(parsed.fontSize as any)) {
      result.fontSize = parsed.fontSize;
    }
    if (typeof parsed.themeColor === 'string' && isValidHexColor(parsed.themeColor)) {
      result.themeColor = parsed.themeColor;
    }
    if (typeof parsed.textIndent === 'boolean') {
      result.textIndent = parsed.textIndent;
    }
    return result;
  } catch {
    try { localStorage.removeItem(SETTINGS_STORAGE_KEY); } catch { /* ignore */ }
    return {};
  }
}

// Persist settings to localStorage.
export function saveSettings(settings: PersistedSettings): void {
  try {
    localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings));
  } catch { /* localStorage unavailable */ }
}

// Clear all persisted settings.
export function clearSettings(): void {
  try {
    localStorage.removeItem(SETTINGS_STORAGE_KEY);
  } catch { /* ignore */ }
}

// Convert persisted settings to StyleOverrides for use with applyTemplate.
export function toStyleOverrides(
  persisted: PersistedSettings,
  templateBaseFontSize: number,
): StyleOverrides {
  const overrides: StyleOverrides = {};

  if (persisted.fontFamilyId) {
    const opt = FONT_FAMILY_OPTIONS.find(o => o.id === persisted.fontFamilyId);
    if (opt) overrides.fontFamily = opt.value;
  }

  if (persisted.fontSize) {
    overrides.fontSizeRatio = persisted.fontSize / templateBaseFontSize;
  }

  if (persisted.themeColor) {
    overrides.themeColor = persisted.themeColor;
  }

  if (persisted.textIndent != null) {
    overrides.textIndent = persisted.textIndent;
  }

  return overrides;
}

// Apply a style template to tagged HTML (client-side, uses DOMParser).
// Walks all elements with data-wechat-tag, writes inline styles from the
// template, then strips class attributes, data-wechat-tag markers, and
// any <style> tags so the output is pure inline-styled HTML.
// When overrides are provided with at least one field set, merges them
// into each element's template style via parseInlineStyle/applyOverridesToStyle.
export function applyTemplate(
  taggedHtml: string,
  template: WechatTemplate,
  overrides?: StyleOverrides,
): string {
  const doc = new DOMParser().parseFromString(taggedHtml, 'text/html');

  const hasOverrides = overrides && (
    overrides.fontFamily != null ||
    overrides.fontSizeRatio != null ||
    overrides.themeColor != null ||
    overrides.textIndent != null
  );

  // Apply inline styles based on data-wechat-tag
  const tagged = doc.querySelectorAll('[data-wechat-tag]');
  for (const el of tagged) {
    const tag = el.getAttribute('data-wechat-tag');
    if (tag && template.styles[tag]) {
      if (hasOverrides) {
        const styleMap = parseInlineStyle(template.styles[tag]);
        const merged = applyOverridesToStyle(styleMap, tag, overrides);
        el.setAttribute('style', serializeInlineStyle(merged));
      } else {
        el.setAttribute('style', template.styles[tag]);
      }
    }
    el.removeAttribute('data-wechat-tag');
  }

  // Inline list markers: WeChat strips list-style, so prepend bullet/number as text
  const lists = doc.querySelectorAll('ul, ol');
  for (const list of lists) {
    const isOrdered = list.tagName.toLowerCase() === 'ol';
    const startAttr = list.getAttribute('start');
    let counter = startAttr ? Number(startAttr) : 1;
    for (const child of list.children) {
      if (child.tagName.toLowerCase() !== 'li') continue;
      const prefix = isOrdered ? `${counter}. ` : `• `;
      child.insertBefore(doc.createTextNode(prefix), child.firstChild);
      counter++;
    }
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
