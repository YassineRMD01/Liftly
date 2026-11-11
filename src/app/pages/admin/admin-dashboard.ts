import { Component, computed, inject } from '@angular/core';
import { CurrencyPipe, DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { Button } from 'primeng/button';
import { ProgressBar } from 'primeng/progressbar';
import { TableModule } from 'primeng/table';
import { Tag } from 'primeng/tag';
import { AuthService } from '../../core/auth.service';
import { StoreService } from '../../core/store.service';
import { PageHeader, StatCard, Stars } from '../../shared/ui';
import { statusSeverity } from '../super-admin/sa-gyms';

@Component({
  selector: 'app-admin-dashboard',
  imports: [CurrencyPipe, DatePipe, RouterLink, Button, ProgressBar, TableModule, Tag, PageHeader, StatCard, Stars],
  template: `
    @if (gym(); as g) {
      <app-page-header [title]="'Welcome back, ' + auth.user()?.firstName" [subtitle]="g.name + ' · ' + g.sports.join(', ') + ' · ' + g.city">
        <p-button label="New promo code" [outlined]="true" routerLink="/admin/promos" />
        <p-button label="Add client" routerLink="/admin/clients" />
      </app-page-header>

      @if (g.status === 'TRIAL') {
        <div class="card !bg-primary-50 dark:!bg-primary-950 !border-primary-200 dark:!border-primary-800 mb-6 flex flex-col sm:flex-row sm:items-center gap-3">
          <div class="flex-1">
            <b>You're on a free trial</b> — ends {{ g.renewsAt | date }}. Add billing to keep your gym running.
          </div>
          <p-button label="Manage billing" size="small" routerLink="/admin/billing" />
        </div>
      }

      <div class="grid sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <app-stat-card icon="users" label="Active members" [value]="activeMembers()" />
        <app-stat-card icon="sack-dollar" label="Total revenue" [value]="(revenue() | currency: 'USD' : 'symbol' : '1.0-0')!" />
        <app-stat-card icon="user-tie" label="Coaches" [value]="coaches().length" />
        <app-stat-card icon="ticket" label="Active promo codes" [value]="activePromos()" />
      </div>

      <div class="grid lg:grid-cols-3 gap-6 mt-6">
        <div class="card lg:col-span-2">
          <h2 class="font-semibold mb-4">Recent memberships</h2>
          <p-table [value]="recent()" [tableStyle]="{ 'min-width': '36rem' }">
            <ng-template #header><tr><th>Client</th><th>Plan</th><th>Paid</th><th>Ends</th><th>Status</th></tr></ng-template>
            <ng-template #body let-m>
              <tr>
                <td class="font-medium">{{ store.fullName(m.clientId) }}</td>
                <td>{{ store.plan(m.planId)?.name }}</td>
                <td>{{ m.pricePaid | currency }}</td>
                <td>{{ m.endDate | date }}</td>
                <td><p-tag [value]="m.status" [severity]="sev(m.status)" /></td>
              </tr>
            </ng-template>
            <ng-template #emptymessage><tr><td colspan="5" class="muted text-center py-6">No memberships yet.</td></tr></ng-template>
          </p-table>
        </div>
        <div class="space-y-6">
          <div class="card">
            <h2 class="font-semibold mb-4">Plan usage · {{ saas()?.name }}</h2>
            <div class="space-y-4 text-sm">
              <div>
                <div class="flex justify-between mb-1"><span>Coaches</span><span class="muted">{{ coaches().length }} / {{ limit(saas()?.maxCoaches) }}</span></div>
                <p-progressbar [value]="pct(coaches().length, saas()?.maxCoaches)" [showValue]="false" styleClass="!h-2" />
              </div>
              <div>
                <div class="flex justify-between mb-1"><span>Clients</span><span class="muted">{{ clientCount() }} / {{ limit(saas()?.maxClients) }}</span></div>
                <p-progressbar [value]="pct(clientCount(), saas()?.maxClients)" [showValue]="false" styleClass="!h-2" />
              </div>
            </div>
          </div>
          <div class="card">
            <h2 class="font-semibold mb-4">Top coaches</h2>
            <div class="space-y-3">
              @for (c of topCoaches(); track c.id) {
                <div class="flex items-center justify-between gap-2">
                  <span class="text-sm font-medium truncate">{{ c.firstName }} {{ c.lastName }}</span>
                  <app-stars [value]="c.avg" [count]="c.count" />
                </div>
              } @empty { <p class="text-sm muted">No coaches yet.</p> }
            </div>
          </div>
        </div>
      </div>
    } @else {
      <p class="muted">No gym found for this account.</p>
    }
  `,
})
export class AdminDashboard {
  protected readonly auth = inject(AuthService);
  protected readonly store = inject(StoreService);
  protected readonly sev = statusSeverity;
  protected readonly gym = this.auth.activeGym;
  protected readonly saas = computed(() => this.store.saasPlan(this.gym()?.saasPlanId));
  private readonly memberships = computed(() => (this.gym() ? this.store.membershipsOfGym(this.gym()!.id) : []));
  protected readonly coaches = computed(() => (this.gym() ? this.store.coachesOfGym(this.gym()!.id) : []));
  protected readonly activeMembers = computed(() => new Set(this.memberships().filter((m) => m.status === 'ACTIVE').map((m) => m.clientId)).size);
  protected readonly clientCount = computed(() => new Set(this.memberships().map((m) => m.clientId)).size);
  protected readonly revenue = computed(() => this.memberships().reduce((s, m) => s + m.pricePaid, 0));
  protected readonly activePromos = computed(() => (this.gym() ? this.store.promosOfGym(this.gym()!.id).filter((p) => p.active && p.validUntil > new Date().toISOString()).length : 0));
  protected readonly recent = computed(() => [...this.memberships()].sort((a, b) => b.startDate.localeCompare(a.startDate)).slice(0, 6));
  protected readonly topCoaches = computed(() =>
    this.coaches().map((c) => ({ ...c, ...this.store.coachRating(c.id) })).sort((a, b) => b.avg - a.avg).slice(0, 5));

  limit(n?: number) { return n === -1 ? '∞' : n ?? 0; }
  pct(v: number, max?: number) { return !max || max === -1 ? 5 : Math.min(100, Math.round((v / max) * 100)); }
}
