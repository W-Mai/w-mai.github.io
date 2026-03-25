/** Unified design tokens for the editor UI (neumorphism style).
 *  Theme-dependent values use CSS custom properties so dark mode works automatically. */
export const EDITOR_TOKENS = {
  // Colors — reference CSS variables for automatic dark mode support
  colorBg: 'var(--neu-bg)',
  colorBgSecondary: 'var(--editor-bg-secondary)',
  colorBgTertiary: 'var(--editor-bg-tertiary)',
  colorBorder: 'var(--border-divider)',
  colorBorderLight: 'var(--border-subtle)',
  colorText: 'var(--text-primary)',
  colorTextSecondary: 'var(--text-secondary)',
  colorTextMuted: 'var(--text-muted)',
  colorAccent: 'var(--text-heading)',
  colorError: '#dc2626',
  colorErrorBg: 'var(--editor-error-bg)',
  colorSuccess: '#10b981',
  colorWarning: '#f59e0b',
  colorWarningBg: 'var(--editor-warning-bg)',

  // Neumorphism shadows — reference CSS variables
  shadowRaised: '5px 5px 10px var(--neu-shadow-dark), -5px -5px 10px var(--neu-shadow-light)',
  shadowInset: 'inset 3px 3px 6px var(--neu-shadow-dark-strong), inset -3px -3px 6px var(--neu-shadow-light-strong)',
  shadowBtn: '3px 3px 6px var(--neu-shadow-dark), -3px -3px 6px var(--neu-shadow-light)',
  shadowBtnHover: '1px 1px 3px var(--neu-shadow-dark), -1px -1px 3px var(--neu-shadow-light)',

  // Spacing
  spacingXs: '0.25rem',
  spacingSm: '0.375rem',
  spacingMd: '0.5rem',
  spacingLg: '0.75rem',
  spacingXl: '1rem',
  spacing2xl: '1.25rem',
  spacing3xl: '1.5rem',

  // Typography
  fontSans: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
  fontMono: "'SF Mono', 'Fira Code', 'Fira Mono', Menlo, monospace",
  fontSizeXs: '0.75rem',
  fontSizeSm: '0.8125rem',
  fontSizeMd: '0.875rem',
  fontSizeBase: '0.9375rem',
  fontSizeLg: '1rem',

  // Border radius
  radiusSm: '0.5rem',
  radiusMd: '0.75rem',
  radiusLg: '1rem',
  radiusXl: '1.5rem',

  // Transitions
  transitionFast: '150ms ease',
} as const;
