import { Component, computed, inject, input, signal } from '@angular/core';
import { DatePipe, DecimalPipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { FaIconComponent } from '@fortawesome/angular-fontawesome';
import { ButtonDirective } from 'primeng/button';
import { AuthService } from '../../../core/auth.service';
import { MoneyPipe } from '../../../core/currency';
import { CURRENT_LANGUAGE, TranslatePipe } from '../../../core/i18n/i18n';
import { StoreService } from '../../../core/store.service';
import { GymLogo } from '../../../shared/gym-logo/gym-logo';
import { LEDGER_CATEGORY } from '../../../shared/accounting-view/accounting-view';

/** One-page monthly report of a gym, laid out for A4 printing. */
@Component({
  selector: 'app-monthly-report',
  imports: [TranslatePipe, DatePipe, DecimalPipe, MoneyPipe, RouterLink, FaIconComponent, ButtonDirective, GymLogo],
  templateUrl: './monthly-report.html',
  styleUrl: './monthly-report.css',
})
export class MonthlyReport {
  private readonly auth = inject(AuthService);
  protected readonly store = inject(StoreService);
  /** YYYY-MM (route param) */
  readonly month = input.required<string>();
  protected readonly gym = this.auth.activeGym;
  protected readonly cat = LEDGER_CATEGORY;
  protected readonly generatedAt = new Date();
  protected readonly cur = computed(() => this.gym()?.currency ?? 'USD');
  protected readonly label = computed(() => new Date(this.month() + '-01T00:00:00'));
  private readonly range = computed(() => { const [y, m] = this.month().split('-').map(Number); return { from: `${this.month()}-01`, to: new Date(y, m, 0).toISOString().slice(0, 10), days: new Date(y, m, 0).getDate() }; });
  private readonly prevMonth = computed(() => { const [y, m] = this.month().split('-').map(Number); const d = new Date(y, m - 2, 1); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`; });
  protected readonly nextMonth = computed(() => { const [y, m] = this.month().split('-').map(Number); const d = new Date(y, m, 1); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`; });
  protected readonly prev = this.prevMonth;

  private monthLines(month: string) { return this.store.gymLedger(this.gym()?.id ?? '', this.cur()).filter((l) => l.date.startsWith(month)); }
  protected readonly r = computed(() => {
    const g = this.gym();
    if (!g) return null;
    const { from, to, days } = this.range();
    const lines = this.monthLines(this.month()), prevLines = this.monthLines(this.prevMonth());
    const sum = (l: typeof lines, type: 'INCOME' | 'EXPENSE') => l.filter((x) => x.type === type).reduce((s, x) => s + x.amount, 0);
    const income = sum(lines, 'INCOME'), expenses = sum(lines, 'EXPENSE'), prevIncome = sum(prevLines, 'INCOME');
    const ms = this.store.membershipsOfGym(g.id);
    const firstStart = new Map<string, string>();
    for (const m of ms) { const s = m.startDate.slice(0, 10); if (!firstStart.has(m.clientId) || s < firstStart.get(m.clientId)!) firstStart.set(m.clientId, s); }
    const newMembers = [...firstStart.values()].filter((s) => s >= from && s <= to).length;
    const active = new Set(ms.filter((m) => m.status !== 'CANCELLED' && m.startDate.slice(0, 10) <= to && m.endDate.slice(0, 10) >= from).map((m) => m.clientId)).size;
    const visits = this.store.checkInsOfGym(g.id).filter((c) => c.ok && c.at.slice(0, 10) >= from && c.at.slice(0, 10) <= to);
    const bookings = this.store.bookings().filter((b) => b.gymId === g.id && b.date >= from && b.date <= to && b.date < new Date().toISOString().slice(0, 10) && b.status !== 'CANCELLED' && b.status !== 'WAITLIST');
    const attended = bookings.filter((b) => b.status === 'ATTENDED').length;
    const byClass = new Map<string, number>();
    for (const b of bookings.filter((x) => x.status === 'ATTENDED')) { const n = this.store.gymClass(b.classId)?.name ?? '?'; byClass.set(n, (byClass.get(n) ?? 0) + 1); }
    const topClasses = [...byClass.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);
    const byWeekday = Array(7).fill(0);
    for (const v of visits) byWeekday[new Date(v.at).getDay()]++;
    const wd = new Intl.DateTimeFormat(CURRENT_LANGUAGE.locale, { weekday: 'short' });
    const weekdays = [1, 2, 3, 4, 5, 6, 0].map((d) => ({ label: wd.format(new Date(2024, 0, 7 + d)), n: byWeekday[d] }));
    const coachPay = lines.filter((l) => l.source === 'PAYOUT').reduce((s, l) => s + l.amount, 0);
    const expByCat = new Map<string, number>();
    for (const l of lines.filter((x) => x.type === 'EXPENSE')) expByCat.set(l.category, (expByCat.get(l.category) ?? 0) + l.amount);
    return {
      income, expenses, net: income - expenses, incomeChange: prevIncome ? Math.round(((income - prevIncome) / prevIncome) * 100) : null,
      newMembers, active, visits: visits.length, visitors: new Set(visits.map((v) => v.clientId)).size, perDay: visits.length / days,
      showRate: bookings.length ? Math.round((attended / bookings.length) * 100) : null, attended, topClasses, weekdays, maxWeekday: Math.max(1, ...byWeekday),
      coachPay, expByCat: [...expByCat.entries()].sort((a, b) => b[1] - a[1]), rating: this.store.gymRating(g.id),
      freezes: this.store.freezeRequestsOf(g.id).filter((x) => x.createdAt.slice(0, 10) >= from && x.createdAt.slice(0, 10) <= to).length,
    };
  });
  print() { window.print(); }
}
