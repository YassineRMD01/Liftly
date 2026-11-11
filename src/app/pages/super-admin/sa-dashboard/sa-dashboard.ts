import { Component, computed, inject } from '@angular/core';
import { CurrencyPipe, DatePipe } from '@angular/common';
import { ProgressBar } from 'primeng/progressbar';
import { TableModule } from 'primeng/table';
import { Tag } from 'primeng/tag';
import { StoreService } from '../../../core/store.service';
import { PageHeader } from '../../../shared/page-header/page-header';
import { StatCard } from '../../../shared/stat-card/stat-card';
import { statusSeverity } from '../sa-gyms/sa-gyms';

@Component({
  selector: 'app-sa-dashboard',
  imports: [CurrencyPipe, DatePipe, ProgressBar, TableModule, Tag, PageHeader, StatCard],
  templateUrl: './sa-dashboard.html',
  styleUrl: './sa-dashboard.css',
})
export class SaDashboard {
  protected readonly store = inject(StoreService);
  protected readonly sev = statusSeverity;
  protected readonly mrr = computed(() =>
    this.store.gyms().filter((g) => g.status === 'ACTIVE').reduce((sum, g) => {
      const p = this.store.saasPlan(g.saasPlanId);
      return sum + (p ? (g.billingCycle === 'MONTHLY' ? p.monthlyPrice : p.yearlyPrice / 12) : 0);
    }, 0),
  );
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
