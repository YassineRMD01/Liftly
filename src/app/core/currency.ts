import { Pipe, PipeTransform } from '@angular/core';

/** Currencies a gym can price its memberships in (ISO 4217). Liftly's own SaaS prices stay in USD. */
export const CURRENCIES: { code: string; label: string }[] = [
  { code: 'USD', label: 'US Dollar' },
  { code: 'EUR', label: 'Euro' },
  { code: 'GBP', label: 'British Pound' },
  { code: 'MAD', label: 'Moroccan Dirham' },
  { code: 'DZD', label: 'Algerian Dinar' },
  { code: 'TND', label: 'Tunisian Dinar' },
  { code: 'EGP', label: 'Egyptian Pound' },
  { code: 'AED', label: 'UAE Dirham' },
  { code: 'SAR', label: 'Saudi Riyal' },
  { code: 'QAR', label: 'Qatari Riyal' },
  { code: 'KWD', label: 'Kuwaiti Dinar' },
  { code: 'TRY', label: 'Turkish Lira' },
  { code: 'CAD', label: 'Canadian Dollar' },
  { code: 'CHF', label: 'Swiss Franc' },
  { code: 'XOF', label: 'West African CFA Franc' },
];

export const DEFAULT_CURRENCY = 'USD';

/**
 * Format an amount in a currency, e.g. "$49.00", "€39.00", "MAD 450.00".
 * Used by the `money` pipe and in plain-text places (toasts, tooltips).
 */
export function formatMoney(amount: number | null | undefined, currency = DEFAULT_CURRENCY, decimals?: 0 | 2): string {
  const value = amount ?? 0;
  try {
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency,
      currencyDisplay: 'symbol',
      ...(decimals !== undefined ? { minimumFractionDigits: decimals, maximumFractionDigits: decimals } : {}),
    }).format(value);
  } catch {
    return `${value} ${currency}`;
  }
}

/** `{{ amount | money: gym.currency }}` — `{{ total | money: cur : 0 }}` for whole numbers. */
@Pipe({ name: 'money' })
export class MoneyPipe implements PipeTransform {
  transform(amount: number | null | undefined, currency?: string | null, decimals?: 0 | 2): string {
    return formatMoney(amount, currency || DEFAULT_CURRENCY, decimals);
  }
}
