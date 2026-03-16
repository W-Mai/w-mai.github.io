/**
 * Canonical blog categories — single source of truth.
 * Add new categories here; the build-time schema validates against this list.
 */
export const CATEGORIES = [
  '代码',
  'DevOps',
  '硬件',
  '生活',
  'CTF',
] as const;

export type Category = (typeof CATEGORIES)[number];
