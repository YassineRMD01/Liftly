import { CohortTable } from '../../../shared/cohort-table/cohort-table';
import { MessageService } from 'primeng/api';
import { ButtonDirective } from 'primeng/button';
import { TranslatePipe, t } from '../../../core/i18n/i18n';
import { ChartCard, ChartSeries } from '../../../shared/chart-card/chart-card';
import { lastMonths } from '../../../core/stats';
import { countryName, formatMoney } from '../../../core/currency';
import { Component, computed, inject } from '@angular/core';
import { DatePipe } from '@angular/common';
import { ProgressBar } from 'primeng/progressbar';
import { TableModule } from 'primeng/table';
import { Tag } from 'primeng/tag';
import { StoreService } from '../../../core/store.service';
import { PageHeader } from '../../../shared/page-header/page-header';
import { StatCard } from '../../../shared/stat-card/stat-card';
import { statusSeverity } from '../sa-gyms/sa-gyms';

@Component({
  selector: 'app-sa-dashboard',
  imports: [ChartCard, CohortTable, TranslatePipe, DatePipe, ButtonDirective, ProgressBar, TableModule, Tag, PageHeader, StatCard],
  templateUrl: './sa-dashboard.html',
  styleUrl: './sa-dashboard.css',
})
export class SaDashboard {
  private readonly toast = inject(MessageService);
  /** Trials ending in the next 7 days. */
  protected readonly trialsSoon = computed(() => this.store.trialsEnding(7));
  sendTrialReminders() {
    const n = this.store.sendTrialReminders(7);
    this.toast.add({ severity: n ? 'success' : 'info', summary: n ? t('{0} reminders sent', { 0: n }) : t('Everyone was already reminded') });
  }
  protected readonly store = inject(StoreService);
  protected readonly sev = statusSeverity;
  /** Monthly recurring revenue in USD: each active gym's plan price for its country, converted with the super-admin's rates. */
  protected readonly mrr = computed(() => this.store.gyms().reduce((sum, g) => sum + this.store.gymMrrUsd(g), 0));
  protected readonly mrrLabel = computed(() => formatMoney(this.mrr(), 'USD', 0));
  protected readonly openReports = computed(() => this.store.reports().filter((r) => r.status === 'OPEN').length);
  protected readonly usd = (v: number) => formatMoney(v, 'USD', 0);

  // ---------- charts ----------
  private readonly months = lastMonths(12);
  protected readonly monthLabels = this.months.map((m) => m.label);

  /** MRR at the end of each month (gyms subscribed by then, at today's prices and rates). */
  protected readonly mrrTrend = computed<ChartSeries[]>(() => [{
    label: t('MRR'),
    data: this.months.map((m) => Math.round(this.store.gyms().filter((g) => g.subscribedAt <= m.end).reduce((s, g) => s + this.store.gymMrrUsd(g), 0))),
  }]);

  /** New accounts per month by role. */
  protected readonly newUsers = computed<ChartSeries[]>(() => {
    const count = (role: string) => this.months.map((m) => this.store.users().filter((u) => u.role === role && u.createdAt >= m.start && u.createdAt <= m.end).length);
    return [
      { label: t('Members'), data: count('CLIENT') },
      { label: t('Coaches'), data: count('COACH') },
      { label: t('Gym admins'), data: count('ADMIN') },
    ];
  });

  protected readonly byCountry = computed(() => {
    const counts = new Map<string, number>();
    for (const g of this.store.gyms()) counts.set(g.country, (counts.get(g.country) ?? 0) + 1);
    const rows = [...counts.entries()].sort((a, b) => b[1] - a[1]);
    return { labels: rows.map(([c]) => countryName(c)), series: [{ label: t('Gyms'), data: rows.map(([, n]) => n) }] as ChartSeries[] };
  });

  protected readonly reportsByStatus = computed(() => {
    const r = this.store.reports();
    const n = (s: string) => r.filter((x) => x.status === s).length;
    return {
      labels: [t('Open'), t('Resolved'), t('Dismissed')],
      series: [{ label: t('Reports'), data: [n('OPEN'), n('RESOLVED'), n('DISMISSED')], statusColors: ['critical', 'good', 'neutral'] }] as ChartSeries[],
    };
  });

  protected readonly trials = computed(() => this.store.gyms().filter((g) => g.status === 'TRIAL').length);
  protected readonly latest = computed(() => [...this.store.gyms()].sort((a, b) => b.subscribedAt.localeCompare(a.subscribedAt)).slice(0, 6));
  protected readonly distribution = computed(() => {
    const total = this.store.gyms().length || 1;
    return this.store.saasPlans().map((p) => {
      const count = this.store.gyms().filter((g) => g.saasPlanId === p.id).length;
      return { name: p.name, count, pct: Math.round((count / total) * 100) };
    });
  });
}
