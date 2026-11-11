import { Component, computed, inject } from '@angular/core';
import { CurrencyPipe, DatePipe } from '@angular/common';
import { ProgressBar } from 'primeng/progressbar';
import { TableModule } from 'primeng/table';
import { Tag } from 'primeng/tag';
import { StoreService } from '../../core/store.service';
import { PageHeader, StatCard } from '../../shared/ui';
import { statusSeverity } from './sa-gyms';

@Component({
  selector: 'app-sa-dashboard',
  imports: [CurrencyPipe, DatePipe, ProgressBar, TableModule, Tag, PageHeader, StatCard],
  template: `
    <app-page-header title="Platform overview" subtitle="Health of the Liftly SaaS across all tenants." />
    <div class="grid sm:grid-cols-2 xl:grid-cols-4 gap-4">
      <app-stat-card icon="sack-dollar" label="MRR" [value]="(mrr() | currency: 'USD' : 'symbol' : '1.0-0')!" hint="Monthly recurring revenue" />
      <app-stat-card icon="building" label="Gyms" [value]="store.gyms().length" [hint]="trials() + ' on trial'" />
      <app-stat-card icon="user-tie" label="Coaches" [value]="store.coaches().length" />
      <app-stat-card icon="users" label="Members" [value]="store.clients().length" />
    </div>

    <div class="grid lg:grid-cols-3 gap-6 mt-6">
      <div class="card lg:col-span-2">
        <h2 class="font-semibold mb-4">Latest gyms</h2>
        <p-table [value]="latest()" [tableStyle]="{ 'min-width': '36rem' }">
          <ng-template #header>
            <tr><th>Gym</th><th>Plan</th><th>Status</th><th>Since</th></tr>
          </ng-template>
          <ng-template #body let-g>
            <tr>
              <td>
                <div class="flex items-center gap-2">
                  <span class="w-3 h-3 rounded-full" [style.background]="g.theme.primary"></span>
                  <span class="font-medium">{{ g.name }}</span><span class="text-xs muted">· {{ g.sport }}</span>
                </div>
              </td>
              <td>{{ store.saasPlan(g.saasPlanId)?.name }}</td>
              <td><p-tag [value]="g.status" [severity]="sev(g.status)" /></td>
              <td>{{ g.subscribedAt | date }}</td>
            </tr>
          </ng-template>
        </p-table>
      </div>
      <div class="card">
        <h2 class="font-semibold mb-4">Plan distribution</h2>
        <div class="space-y-5">
          @for (d of distribution(); track d.name) {
            <div>
              <div class="flex justify-between text-sm mb-1.5"><span>{{ d.name }}</span><span class="muted">{{ d.count }} gyms</span></div>
              <p-progressbar [value]="d.pct" [showValue]="false" styleClass="!h-2" />
            </div>
          }
        </div>
      </div>
    </div>
  `,
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
