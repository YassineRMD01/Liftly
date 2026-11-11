import { Component, computed, inject } from '@angular/core';
import { CurrencyPipe, DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { FaIconComponent } from '@fortawesome/angular-fontawesome';
import { Button } from 'primeng/button';
import { ProgressBar } from 'primeng/progressbar';
import { Tag } from 'primeng/tag';
import { AuthService } from '../../core/auth.service';
import { ClientMembership } from '../../core/models';
import { StoreService } from '../../core/store.service';
import { PageHeader } from '../../shared/ui';
import { OpenStatusBadge, WeekSchedule } from '../../shared/schedule-ui';
import { statusSeverity } from '../super-admin/sa-gyms';

@Component({
  selector: 'app-client-dashboard',
  imports: [CurrencyPipe, DatePipe, RouterLink, FaIconComponent, Button, ProgressBar, Tag, PageHeader, OpenStatusBadge, WeekSchedule],
  template: `
    <app-page-header [title]="'Hey ' + auth.user()?.firstName + ' 👋'" subtitle="Your memberships across all your gyms.">
      <p-button label="Find a gym" routerLink="/client/gyms"><ng-template #icon><fa-icon icon="magnifying-glass" /></ng-template></p-button>
    </app-page-header>

    <div class="grid md:grid-cols-2 xl:grid-cols-3 gap-5">
      @for (m of active(); track m.id) {
        @let g = store.gym(m.gymId);
        <div class="card !p-0 overflow-hidden flex flex-col">
          <div class="p-5 text-white" [style.background]="g?.theme?.primary">
            <div class="flex items-center gap-3">
              <span class="w-10 h-10 rounded-lg bg-white/20 grid place-items-center font-bold text-sm">{{ g?.theme?.logoText }}</span>
              <div><div class="font-bold">{{ g?.name }}</div><div class="text-sm opacity-80">{{ g?.sports?.join(', ') }} · {{ g?.city }}</div></div>
            </div>
          </div>
          <div class="p-5 space-y-3 flex-1">
            <div class="flex justify-between"><span class="font-semibold">{{ store.plan(m.planId)?.name }}</span><p-tag [value]="m.status" [severity]="sev(m.status)" /></div>
            <app-open-status [gymId]="m.gymId" [gender]="auth.user()?.gender" />
            <div class="text-sm muted">{{ m.startDate | date }} → {{ m.endDate | date }}</div>
            <p-progressbar [value]="progress(m)" [showValue]="false" styleClass="!h-2" />
            <div class="text-xs muted">{{ daysLeft(m) }} days left · paid {{ m.pricePaid | currency }}
              @if (store.promo(m.promoCodeId); as p) { with <b>{{ p.code }}</b> }</div>
            @if (m.coachId) {
              <div class="text-sm flex items-center gap-2"><fa-icon icon="user-tie" class="text-primary" /> Coach: <b>{{ store.fullName(m.coachId) }}</b></div>
            }
            <details class="text-sm">
              <summary class="cursor-pointer text-primary font-medium">Opening hours</summary>
              <div class="mt-2"><app-week-schedule [gymId]="m.gymId" [gender]="auth.user()?.gender" /></div>
            </details>
          </div>
        </div>
      } @empty {
        <div class="card md:col-span-2 xl:col-span-3 text-center py-12">
          <fa-icon icon="dumbbell" class="text-4xl text-primary" />
          <p class="mt-3 font-semibold">No active membership</p>
          <p class="muted text-sm mb-4">Browse gyms near you and join in a minute.</p>
          <p-button label="Find a gym" routerLink="/client/gyms" />
        </div>
      }
    </div>

    @if (past().length) {
      <h2 class="font-semibold text-lg mt-8 mb-3">History</h2>
      <div class="card divide-y divide-surface-200 dark:divide-surface-800">
        @for (m of past(); track m.id) {
          <div class="py-3 flex flex-wrap items-center gap-3 text-sm">
            <span class="font-medium flex-1">{{ store.gym(m.gymId)?.name }} · {{ store.plan(m.planId)?.name }}</span>
            <span class="muted">{{ m.endDate | date }}</span>
            <p-tag [value]="m.status" [severity]="sev(m.status)" />
          </div>
        }
      </div>
    }
  `,
})
export class ClientDashboard {
  protected readonly auth = inject(AuthService);
  protected readonly store = inject(StoreService);
  protected readonly sev = statusSeverity;
  private readonly mine = computed(() => this.store.membershipsOfClient(this.auth.user()!.id));
  protected readonly active = computed(() => this.mine().filter((m) => m.status === 'ACTIVE'));
  protected readonly past = computed(() => this.mine().filter((m) => m.status !== 'ACTIVE'));

  daysLeft(m: ClientMembership) { return Math.max(0, Math.ceil((+new Date(m.endDate) - Date.now()) / 86400000)); }
  progress(m: ClientMembership) {
    const total = +new Date(m.endDate) - +new Date(m.startDate);
    return Math.min(100, Math.max(0, ((Date.now() - +new Date(m.startDate)) / total) * 100));
  }
}
