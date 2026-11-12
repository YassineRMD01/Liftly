import { Component, computed, inject } from '@angular/core';
import { AuthService } from '../../../core/auth.service';
import { CURRENT_LANGUAGE, TranslatePipe, t } from '../../../core/i18n/i18n';
import { DAY_SHORT, WEEK, isoDate } from '../../../core/schedule';
import { StoreService } from '../../../core/store.service';
import { ChartCard, ChartSeries } from '../../../shared/chart-card/chart-card';
import { PageHeader } from '../../../shared/page-header/page-header';
import { StatCard } from '../../../shared/stat-card/stat-card';

/** Attendance statistics from check-ins and class bookings, plus members at risk of leaving. */
@Component({
  selector: 'app-admin-attendance',
  imports: [TranslatePipe, ChartCard, PageHeader, StatCard],
  templateUrl: './admin-attendance.html',
  styleUrl: './admin-attendance.css',
})
export class AdminAttendance {
  private readonly auth = inject(AuthService);
  protected readonly store = inject(StoreService);
  private readonly gymId = computed(() => this.auth.activeGym()?.id ?? '');
  /** Successful check-ins of the last 30 days. */
  private readonly visits = computed(() => {
    const since = new Date(Date.now() - 30 * 86400000).toISOString();
    return this.store.checkInsOfGym(this.gymId()).filter((c) => c.ok && c.at >= since);
  });

  protected readonly total = computed(() => this.visits().length);
  protected readonly uniqueMembers = computed(() => new Set(this.visits().map((v) => v.clientId)).size);
  protected readonly perDay = computed(() => (this.total() / 30).toFixed(1));
  protected readonly showRate = computed(() => {
    const today = isoDate();
    const past = this.store.bookings().filter((b) => b.gymId === this.gymId() && b.date < today && (b.status === 'ATTENDED' || b.status === 'NO_SHOW' || b.status === 'BOOKED'));
    if (!past.length) return '—';
    return Math.round((past.filter((b) => b.status === 'ATTENDED').length / past.length) * 100) + '%';
  });

  protected readonly days = computed(() => {
    const labels: string[] = [];
    const data: number[] = [];
    const f = new Intl.DateTimeFormat(CURRENT_LANGUAGE.locale, { day: 'numeric', month: 'short' });
    for (let i = 29; i >= 0; i--) {
      const d = new Date(Date.now() - i * 86400000);
      const key = isoDate(d);
      labels.push(f.format(d));
      data.push(this.visits().filter((v) => isoDate(new Date(v.at)) === key).length);
    }
    return { labels, series: [{ label: t('Check-ins'), data }] as ChartSeries[] };
  });

  protected readonly hours = computed(() => {
    const counts = Array<number>(24).fill(0);
    for (const v of this.visits()) counts[new Date(v.at).getHours()]++;
    const first = Math.max(0, counts.findIndex((c) => c > 0));
    const last = Math.max(first, 23 - [...counts].reverse().findIndex((c) => c > 0));
    const range = counts.slice(first, last + 1);
    return { labels: range.map((_, i) => `${String(first + i).padStart(2, '0')}:00`), series: [{ label: t('Check-ins'), data: range }] as ChartSeries[] };
  });

  protected readonly weekdays = computed(() => {
    const counts = Array<number>(7).fill(0);
    for (const v of this.visits()) counts[new Date(v.at).getDay()]++;
    return { labels: WEEK.map((d) => DAY_SHORT[d]), series: [{ label: t('Check-ins'), data: WEEK.map((d) => counts[d]) }] as ChartSeries[] };
  });

  /** Active members who have not come for 14+ days (or never). */
  protected readonly atRisk = computed(() => {
    const gymId = this.gymId();
    const all = this.store.checkInsOfGym(gymId).filter((c) => c.ok);
    const limit = Date.now() - 14 * 86400000;
    return this.store.clientsOfGym(gymId)
      .filter((c) => this.store.clientStatus(gymId, c.id) === 'ACTIVE')
      .map((c) => ({ client: c, last: all.find((v) => v.clientId === c.id)?.at }))
      .filter((x) => !x.last || new Date(x.last).getTime() < limit)
      .sort((a, b) => (a.last ?? '').localeCompare(b.last ?? ''));
  });
  daysAgo(at?: string) { return at ? Math.floor((Date.now() - new Date(at).getTime()) / 86400000) : null; }
}
