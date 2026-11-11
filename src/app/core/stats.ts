import { CURRENT_LANGUAGE } from './i18n/i18n';

export interface MonthBucket {
  /** First day of the month (ISO date). */
  start: string;
  /** Last moment of the month (ISO). */
  end: string;
  /** Short localized label, e.g. "Nov" / "nov." / "نونبر". */
  label: string;
}

/** The last `n` calendar months, oldest first, ending with the current month. */
export function lastMonths(n = 12, now = new Date()): MonthBucket[] {
  const fmt = new Intl.DateTimeFormat(CURRENT_LANGUAGE.locale, { month: 'short' });
  return Array.from({ length: n }, (_, k) => {
    const i = n - 1 - k;
    const start = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const end = new Date(now.getFullYear(), now.getMonth() - i + 1, 0, 23, 59, 59, 999);
    return { start: start.toISOString(), end: end.toISOString(), label: fmt.format(start) };
  });
}
