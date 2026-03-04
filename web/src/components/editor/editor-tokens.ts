/** Unified design tokens for the editor UI (neumorphism style) */
export const EDITOR_TOKENS = {
  // Colors
  colorBg: '#e8ecf1',
  colorBgSecondary: '#e0e4e9',
  colorBgTertiary: '#d8dce1',
  colorBorder: '#c8ccd1',
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

  // Neumorphism shadows
  shadowRaised: '4px 4px 8px #c8ccd1, -4px -4px 8px #ffffff',
  shadowInset: 'inset 2px 2px 5px #c8ccd1, inset -2px -2px 5px #ffffff',
  shadowBtn: '3px 3px 6px #c8ccd1, -3px -3px 6px #ffffff',
  shadowBtnHover: '1px 1px 3px #c8ccd1, -1px -1px 3px #ffffff',

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
