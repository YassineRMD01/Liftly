import { Pipe, PipeTransform } from '@angular/core';
import { CURRENT_LANGUAGE } from './i18n/i18n';

/** Currencies a gym can price its memberships in (ISO 4217). Liftly's own SaaS prices stay in USD. */
const CURRENCY_CODES = ['USD', 'EUR', 'GBP', 'MAD', 'DZD', 'TND', 'EGP', 'AED', 'SAR', 'QAR', 'KWD', 'TRY', 'CAD', 'CHF', 'XOF'];

/** Currency names in the current language ("Moroccan Dirham", "dirham marocain", "درهم مغربي"…). */
const currencyName = (code: string) => {
  try {
    return new Intl.DisplayNames([CURRENT_LANGUAGE.locale], { type: 'currency' }).of(code) ?? code;
  } catch {
    return code;
  }
};

export const CURRENCIES: { code: string; label: string }[] = CURRENCY_CODES.map((code) => ({ code, label: currencyName(code) }));

export const DEFAULT_CURRENCY = 'USD';

/**
 * Format an amount in a currency, e.g. "$49.00", "€39.00", "MAD 450.00".
 * Used by the `money` pipe and in plain-text places (toasts, tooltips).
 */
export function formatMoney(amount: number | null | undefined, currency = DEFAULT_CURRENCY, decimals?: 0 | 2): string {
  const value = amount ?? 0;
  try {
    return new Intl.NumberFormat(CURRENT_LANGUAGE.locale, {
      style: 'currency',
      currency,
      currencyDisplay: 'symbol',
      ...(decimals !== undefined ? { minimumFractionDigits: decimals, maximumFractionDigits: decimals } : {}),
    }).format(value);
  } catch {
    return `${value} ${currency}`;
  }
}

/**
 * Sum amounts per currency: "€120.00 + MAD 450.00". Used where several currencies can mix
 * (a gym whose plans use different currencies, platform-wide revenue…).
 */
export function formatTotals(items: { amount: number; currency: string }[], fallbackCurrency = DEFAULT_CURRENCY, decimals?: 0 | 2): string {
  const sums = new Map<string, number>();
  for (const i of items) sums.set(i.currency, (sums.get(i.currency) ?? 0) + i.amount);
  if (!sums.size) return formatMoney(0, fallbackCurrency, decimals);
  return [...sums.entries()].sort((a, b) => (a[0] === fallbackCurrency ? -1 : b[0] === fallbackCurrency ? 1 : b[1] - a[1]))
    .map(([c, v]) => formatMoney(v, c, decimals)).join(' + ');
}

/** `{{ amount | money: gym.currency }}` — `{{ total | money: cur : 0 }}` for whole numbers. */
@Pipe({ name: 'money' })
export class MoneyPipe implements PipeTransform {
  transform(amount: number | null | undefined, currency?: string | null, decimals?: 0 | 2): string {
    return formatMoney(amount, currency || DEFAULT_CURRENCY, decimals);
  }
}
