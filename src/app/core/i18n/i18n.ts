import { registerLocaleData } from '@angular/common';
import { Pipe, PipeTransform } from '@angular/core';

export type Lang = 'en' | 'fr' | 'es' | 'ar' | 'pt' | 'de' | 'tr';

export interface LanguageInfo {
  code: Lang;
  /** Name of the language in that language. */
  label: string;
  /** Locale used for dates, numbers and currencies. */
  locale: string;
  dir: 'ltr' | 'rtl';
}

export const LANGUAGES: LanguageInfo[] = [
  { code: 'en', label: 'English', locale: 'en-US', dir: 'ltr' },
  { code: 'fr', label: 'Français', locale: 'fr-FR', dir: 'ltr' },
  { code: 'es', label: 'Español', locale: 'es-ES', dir: 'ltr' },
  { code: 'pt', label: 'Português (Brasil)', locale: 'pt-BR', dir: 'ltr' },
  { code: 'de', label: 'Deutsch', locale: 'de-DE', dir: 'ltr' },
  { code: 'tr', label: 'Türkçe', locale: 'tr-TR', dir: 'ltr' },
  // ar-MA: Arabic with Latin digits (0-9), common for prices and dates in the Maghreb
  { code: 'ar', label: 'العربية', locale: 'ar-MA', dir: 'rtl' },
];

const STORAGE_KEY = 'liftly-lang';

function detectLanguage(): Lang {
  try {
    const saved = localStorage.getItem(STORAGE_KEY) as Lang | null;
    if (saved && LANGUAGES.some((l) => l.code === saved)) return saved;
  } catch { /* storage unavailable */ }
  const browser = (typeof navigator !== 'undefined' ? navigator.language : 'en').slice(0, 2) as Lang;
  return LANGUAGES.some((l) => l.code === browser) ? browser : 'en';
}

/**
 * The language is chosen once per page load: switching language saves the choice
 * and reloads, so Angular's LOCALE_ID (dates, numbers), PrimeNG texts and the
 * text direction all follow it. That keeps the `t` pipe pure and cheap.
 */
export const CURRENT_LANG: Lang = detectLanguage();
export const CURRENT_LANGUAGE: LanguageInfo = LANGUAGES.find((l) => l.code === CURRENT_LANG)!;

/** Translations of the current language, keyed by the English text. Missing keys fall back to English. */
let DICTIONARY: Record<string, string> = {};

type Loaded = [Record<string, string>, unknown];
/** Each language (dictionary + Angular locale data) is its own lazy chunk: only the one in use is downloaded. */
const LOADERS: Record<Exclude<Lang, 'en'>, () => Promise<Loaded>> = {
  fr: () => Promise.all([import('./fr').then((m) => m.FR), import('@angular/common/locales/fr').then((m) => m.default)]),
  es: () => Promise.all([import('./es').then((m) => m.ES), import('@angular/common/locales/es').then((m) => m.default)]),
  ar: () => Promise.all([import('./ar').then((m) => m.AR), import('@angular/common/locales/ar-MA').then((m) => m.default)]),
  pt: () => Promise.all([import('./pt').then((m) => m.PT), import('@angular/common/locales/pt').then((m) => m.default)]),
  de: () => Promise.all([import('./de').then((m) => m.DE), import('@angular/common/locales/de').then((m) => m.default)]),
  tr: () => Promise.all([import('./tr').then((m) => m.TR), import('@angular/common/locales/tr').then((m) => m.default)]),
};

/** Loads the dictionary and locale data of the current language. Called once in main.ts, before the app starts. */
export async function loadLanguage(lang: Lang = CURRENT_LANG) {
  if (lang === 'en') return;
  const [dict, locale] = await LOADERS[lang]();
  DICTIONARY = dict;
  registerLocaleData(locale, LANGUAGES.find((l) => l.code === lang)!.locale);
}

/** English labels for enum values shown in the UI (statuses, roles). */
const ENUM_EN: Record<string, string> = {
  ACTIVE: 'Active', TRIAL: 'Trial', SUSPENDED: 'Suspended', EXPIRED: 'Expired', CANCELLED: 'Cancelled',
  SUPER_ADMIN: 'Super admin', ADMIN: 'Gym admin', COACH: 'Coach', CLIENT: 'Member',
  BANNED: 'Banned', OPEN: 'Open', RESOLVED: 'Resolved', DISMISSED: 'Dismissed',
  NEW: 'New', CONTACTED: 'Contacted', CONVERTED: 'Converted',
  RUNNING: 'Running', UPCOMING: 'Upcoming', ENDED: 'Ended', PENDING: 'Pending', APPROVED: 'Approved',
  SERVICE_DUE: 'Service due', OUT_OF_ORDER: 'Out of order',
  REQUESTED: 'Requested', CONFIRMED: 'Confirmed', DECLINED: 'Declined', DONE: 'Done', WORKOUT: 'Workout', NUTRITION: 'Nutrition',
  STAFF: 'Front desk', FROZEN: 'Frozen', WAITLIST: 'Waitlist', BOOKED: 'Booked', ATTENDED: 'Attended', NO_SHOW: 'No-show',
};

/**
 * Translate an English text. Placeholders like `{name}` are replaced from params.
 *   t('Welcome back, {name}', { name: 'Alex' })
 */
export function t(key: string, params?: Record<string, string | number>): string {
  const english = ENUM_EN[key] ?? key;
  let text = DICTIONARY[english] ?? english;
  if (params) text = text.replace(/\{(\w+)\}/g, (_, k: string) => (k in params ? String(params[k]) : `{${k}}`));
  return text;
}

export function setLanguage(lang: Lang) {
  if (lang === CURRENT_LANG) return;
  try { localStorage.setItem(STORAGE_KEY, lang); } catch { /* ignore */ }
  location.reload();
}

/** Sets <html lang> and <html dir> for the current language. */
export function applyDocumentLanguage() {
  document.documentElement.lang = CURRENT_LANGUAGE.code;
  document.documentElement.dir = CURRENT_LANGUAGE.dir;
}

/** `{{ 'Save' | t }}` — `{{ 'Hello {name}' | t: { name: user.firstName } }}` */
@Pipe({ name: 't' })
export class TranslatePipe implements PipeTransform {
  transform(key: string | null | undefined, params?: Record<string, string | number>): string {
    return key ? t(key, params) : '';
  }
}

/** Translate each item of a list and join it: `{{ gym.sports | tjoin }}` → "Natation, Aquagym". */
@Pipe({ name: 'tjoin' })
export class TranslateJoinPipe implements PipeTransform {
  transform(list: readonly string[] | null | undefined, separator = ', '): string {
    return (list ?? []).map((x) => t(x)).join(separator);
  }
}

// ---------- locale-aware names (no hand translation needed) ----------
const fmt = (opts: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat(CURRENT_LANGUAGE.locale, opts);

/** January … December in the current language. */
export const MONTH_NAMES = Array.from({ length: 12 }, (_, m) => fmt({ month: 'long' }).format(new Date(2024, m, 1)));
/** Day names indexed like Date.getDay() (0 = Sunday). 2024-01-07 was a Sunday. */
export const DAY_NAMES = Array.from({ length: 7 }, (_, d) => fmt({ weekday: 'long' }).format(new Date(2024, 0, 7 + d)));
export const DAY_NAMES_SHORT = Array.from({ length: 7 }, (_, d) => fmt({ weekday: 'short' }).format(new Date(2024, 0, 7 + d)));
export const DAY_NAMES_NARROW = Array.from({ length: 7 }, (_, d) => fmt({ weekday: 'narrow' }).format(new Date(2024, 0, 7 + d)));
