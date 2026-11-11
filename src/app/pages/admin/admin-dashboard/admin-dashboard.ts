import { TranslatePipe, t } from '../../../core/i18n/i18n';
import { ChartCard, ChartSeries } from '../../../shared/chart-card/chart-card';
import { lastMonths } from '../../../core/stats';
import { formatMoney } from '../../../core/currency';
import { Component, computed, inject } from '@angular/core';
import { MoneyPipe } from '../../../core/currency';
import { DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { Button } from 'primeng/button';
import { ProgressBar } from 'primeng/progressbar';
import { TableModule } from 'primeng/table';
import { Tag } from 'primeng/tag';
import { AuthService } from '../../../core/auth.service';
import { StoreService } from '../../../core/store.service';
import { PageHeader } from '../../../shared/page-header/page-header';
import { StatCard } from '../../../shared/stat-card/stat-card';
import { Stars } from '../../../shared/stars/stars';
import { statusSeverity } from '../../super-admin/sa-gyms/sa-gyms';

@Component({
  selector: 'app-admin-dashboard',
  imports: [ChartCard, TranslatePipe, MoneyPipe, DatePipe, RouterLink, Button, ProgressBar, TableModule, Tag, PageHeader, StatCard, Stars],
  templateUrl: './admin-dashboard.html',
  styleUrl: './admin-dashboard.css',
})
export class AdminDashboard {
  protected readonly auth = inject(AuthService);
  protected readonly store = inject(StoreService);
  protected readonly sev = statusSeverity;
  protected readonly cur = computed(() => this.auth.activeGym()?.currency ?? 'USD');
  protected readonly gym = this.auth.activeGym;
  protected readonly saas = computed(() => this.store.saasPlan(this.gym()?.saasPlanId));
  // ---------- charts ----------
  private readonly months = lastMonths(12);
  protected readonly monthLabels = this.months.map((m) => m.label);
  protected readonly money = (v: number) => formatMoney(v, this.cur(), 0);
  protected readonly rating = computed(() => (this.gym() ? this.store.gymRating(this.gym()!.id) : { avg: 0, count: 0 }));

  /** Payments received per month, converted to the gym currency. */
  protected readonly revenueByMonth = computed<ChartSeries[]>(() => {
    const g = this.gym();
    if (!g) return [];
    const pays = this.store.payments().filter((p) => p.gymId === g.id);
    return [{
      label: t('Revenue'),
      data: this.months.map((m) => Math.round(pays.filter((p) => p.date >= m.start.slice(0, 10) && p.date <= m.end.slice(0, 10))
        .reduce((s, p) => s + this.store.convert(p.amount, this.store.paymentCurrency(p), g.currency), 0))),
    }];
  });

  /** Members with a membership covering each month. */
  protected readonly membersByMonth = computed<ChartSeries[]>(() => [{
    label: t('Active members'),
    data: this.months.map((m) => new Set(this.memberships().filter((x) => x.status !== 'CANCELLED' && x.startDate <= m.end && x.endDate >= m.start).map((x) => x.clientId)).size),
  }]);

  protected readonly clientsByStatus = computed(() => {
    const g = this.gym();
    const ids = g ? [...new Set(this.store.membershipsOfGym(g.id).map((m) => m.clientId)), ...this.store.bans().filter((b) => b.gymId === g.id).map((b) => b.clientId)] : [];
    const statuses = [...new Set(ids)].map((id) => this.store.clientStatus(g!.id, id));
    const n = (s: string) => statuses.filter((x) => x === s).length;
    return {
      labels: [t('Active'), t('Expired'), t('Banned')],
      series: [{ label: t('Clients'), data: [n('ACTIVE'), n('EXPIRED'), n('BANNED')], statusColors: ['good', 'neutral', 'critical'] }] as ChartSeries[],
    };
  });

  protected readonly membersByPlan = computed(() => {
    const g = this.gym();
    const plans = g ? this.store.plansOfGym(g.id) : [];
    const active = this.memberships().filter((m) => m.status === 'ACTIVE');
    const rows = plans.map((p) => ({ name: p.name, n: active.filter((m) => m.planId === p.id).length })).sort((a, b) => b.n - a.n);
    return { labels: rows.map((r) => r.name), series: [{ label: t('Active members'), data: rows.map((r) => r.n) }] as ChartSeries[] };
  });

  private readonly memberships = computed(() => (this.gym() ? this.store.membershipsOfGym(this.gym()!.id) : []));
  protected readonly coaches = computed(() => (this.gym() ? this.store.coachesOfGym(this.gym()!.id) : []));
  protected readonly activeMembers = computed(() => new Set(this.memberships().filter((m) => m.status === 'ACTIVE').map((m) => m.clientId)).size);
  protected readonly clientCount = computed(() => new Set(this.memberships().map((m) => m.clientId)).size);
  protected readonly revenue = computed(() => (this.gym() ? this.store.gymRevenue(this.gym()!.id, 0) : ''));
  protected readonly activePromos = computed(() => (this.gym() ? this.store.promosOfGym(this.gym()!.id).filter((p) => p.active && p.validUntil > new Date().toISOString()).length : 0));
  protected readonly recent = computed(() => [...this.memberships()].sort((a, b) => b.startDate.localeCompare(a.startDate)).slice(0, 6));
  protected readonly topCoaches = computed(() =>
    this.coaches().map((c) => ({ ...c, ...this.store.coachRating(c.id) })).sort((a, b) => b.avg - a.avg).slice(0, 5));

  limit(n?: number) { return n === -1 ? '∞' : n ?? 0; }
  pct(v: number, max?: number) { return !max || max === -1 ? 5 : Math.min(100, Math.round((v / max) * 100)); }
}
