import { IconProp } from '@fortawesome/fontawesome-svg-core';
import { Audience, Gender, ScheduleClosure, ScheduleSlot } from './models';
import { DAY_NAMES, DAY_NAMES_SHORT, t } from './i18n/i18n';

/** Display order Monday → Sunday (values are JS getDay()). */
export const WEEK = [1, 2, 3, 4, 5, 6, 0];
/** Day names in the current language, indexed by getDay(). */
export const DAY_LABEL: Record<number, string> = { ...DAY_NAMES };
export const DAY_SHORT: Record<number, string> = { ...DAY_NAMES_SHORT };

export const AUDIENCE: Record<Audience, { label: string; short: string; color: string; icon: IconProp }> = {
  MIXED: { label: t('Mixed'), short: t('Mixed'), color: '#6366f1', icon: 'people-group' },
  MEN: { label: t('Men only'), short: t('Men'), color: '#0ea5e9', icon: 'person' },
  WOMEN: { label: t('Women only'), short: t('Women'), color: '#ec4899', icon: 'person-dress' },
};

export const toMin = (t: string) => {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
};
export const nowHHmm = (d = new Date()) => `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
export const isoDate = (d = new Date()) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

/** Can a person of this gender attend the slot? Unknown gender sees everything. */
export const canAttend = (slot: ScheduleSlot, gender?: Gender) =>
  !gender || slot.audience === 'MIXED' || (slot.audience === 'MEN' ? gender === 'MALE' : gender === 'FEMALE');

/**
 * Two slots conflict when they overlap in time on the same day for the same area (sport)
 * and they are not a men/women pair (separate areas/sessions may run in parallel).
 */
export function conflicts(a: Pick<ScheduleSlot, 'day' | 'open' | 'close' | 'audience' | 'sportId'>, b: ScheduleSlot) {
  if (a.day !== b.day) return false;
  if ((a.sportId ?? '') !== (b.sportId ?? '')) return false;
  const overlap = toMin(a.open) < toMin(b.close) && toMin(b.open) < toMin(a.close);
  if (!overlap) return false;
  const pair = new Set([a.audience, b.audience]);
  return !(pair.has('MEN') && pair.has('WOMEN') && pair.size === 2);
}

export interface OpenStatus {
  open: boolean;
  closure?: ScheduleClosure;
  current: ScheduleSlot[];
  /** Next slot that starts later (within 7 days). */
  next?: { slot: ScheduleSlot; day: number; today: boolean };
}

export function openStatus(slots: ScheduleSlot[], closures: ScheduleClosure[], gender?: Gender, at = new Date()): OpenStatus {
  const visible = slots.filter((s) => canAttend(s, gender));
  const closure = closures.find((c) => c.date === isoDate(at));
  const t = nowHHmm(at);
  const current = closure ? [] : visible.filter((s) => s.day === at.getDay() && s.open <= t && t < s.close);
  let next: OpenStatus['next'];
  for (let i = 0; i < 7 && !next; i++) {
    const d = new Date(at.getTime() + i * 86400000);
    if (closures.some((c) => c.date === isoDate(d))) continue;
    const cand = visible
      .filter((s) => s.day === d.getDay() && (i > 0 || s.open > t))
      .sort((a, b) => a.open.localeCompare(b.open))[0];
    if (cand) next = { slot: cand, day: d.getDay(), today: i === 0 };
  }
  return { open: current.length > 0, closure, current, next };
}
