/** Unified design tokens for the editor UI (neumorphism style) */
export const EDITOR_TOKENS = {
  // Colors (synced with --neu-bg in global.css)
  colorBg: '#e0e5ec',
  colorBgSecondary: '#d9dee5',
  colorBgTertiary: '#d1d6dd',
  colorBorder: '#c4c9d0',
  colorBorderLight: '#dde1e6',
  colorText: '#111827',
  colorTextSecondary: '#6b7280',
  colorTextMuted: '#9ca3af',
  colorAccent: '#111827',
  colorError: '#dc2626',
  colorErrorBg: '#fef2f2',
  colorSuccess: '#10b981',
  colorWarning: '#f59e0b',
  colorWarningBg: '#fffbeb',

  // Neumorphism shadows (synced with CSS variables in global.css)
  shadowRaised: '5px 5px 10px rgb(163 177 198 / 0.6), -5px -5px 10px rgb(255 255 255 / 0.5)',
  shadowInset: 'inset 3px 3px 6px rgb(163 177 198 / 0.7), inset -3px -3px 6px rgb(255 255 255 / 0.8)',
  shadowBtn: '3px 3px 6px rgb(163 177 198 / 0.6), -3px -3px 6px rgb(255 255 255 / 0.5)',
  shadowBtnHover: '1px 1px 3px rgb(163 177 198 / 0.6), -1px -1px 3px rgb(255 255 255 / 0.5)',

  // Spacing
  spacingXs: '0.25rem',
  spacingSm: '0.375rem',
  spacingMd: '0.5rem',
  spacingLg: '0.75rem',
  spacingXl: '1rem',

  // Typography
  fontSans: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
  fontMono: "'SF Mono', 'Fira Code', 'Fira Mono', Menlo, monospace",
  fontSizeXs: '0.65rem',
  fontSizeSm: '0.75rem',
  fontSizeMd: '0.8rem',
  fontSizeBase: '0.875rem',

  // Border radius
  radiusSm: '0.375rem',
  radiusMd: '0.5rem',
  radiusLg: '0.75rem',

  // Transitions
  transitionFast: '150ms ease',
} as const;
