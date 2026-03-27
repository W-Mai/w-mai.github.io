import { SITE_TZ_OFFSET } from '~/consts';

/**
 * Shift a Date to the site timezone and return UTC-based accessors.
 * This ensures consistent year/month/day extraction regardless of
 * the build environment's local timezone (e.g. UTC on GitHub CI).
 */
function shifted(date: Date): Date {
  return new Date(date.getTime() + SITE_TZ_OFFSET * 60 * 60 * 1000);
}

export function siteYear(date: Date): number {
  return shifted(date).getUTCFullYear();
}

export function siteMonth(date: Date): number {
  return shifted(date).getUTCMonth() + 1;
}

export function siteDay(date: Date): number {
  return shifted(date).getUTCDate();
}

/** Day of week (0=Sun, 6=Sat) in site timezone */
export function siteDayOfWeek(date: Date): number {
  return shifted(date).getUTCDay();
}

/** Chinese month name (e.g. "三月") in site timezone */
export function siteMonthLong(date: Date): string {
  const s = shifted(date);
  return s.toLocaleDateString('zh-CN', { month: 'long', timeZone: 'UTC' });
}

/** Chinese weekday name (e.g. "星期一") in site timezone */
export function siteWeekdayLong(date: Date): string {
  const s = shifted(date);
  return s.toLocaleDateString('zh-CN', { weekday: 'long', timeZone: 'UTC' });
}

/** ISO date string (YYYY-MM-DD) in site timezone */
export function siteISODate(date: Date): string {
  const s = shifted(date);
  const y = s.getUTCFullYear();
  const m = String(s.getUTCMonth() + 1).padStart(2, '0');
  const d = String(s.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** Locale-formatted date string in site timezone */
export function siteLocaleDateString(date: Date, locale: string, options?: Intl.DateTimeFormatOptions): string {
  const s = shifted(date);
  return s.toLocaleDateString(locale, { ...options, timeZone: 'UTC' });
}
