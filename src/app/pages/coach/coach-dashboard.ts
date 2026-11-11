import { Component, computed, inject } from '@angular/core';
import { DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { Button } from 'primeng/button';
import { AuthService } from '../../core/auth.service';
import { StoreService } from '../../core/store.service';
import { PageHeader, StatCard, Stars } from '../../shared/ui';

@Component({
  selector: 'app-coach-dashboard',
  imports: [DatePipe, RouterLink, Button, PageHeader, StatCard, Stars],
  template: `
    <app-page-header [title]="'Hi coach ' + auth.user()?.firstName" subtitle="Your gyms, your athletes, your reputation.">
      <p-button label="Edit profile" [outlined]="true" routerLink="/coach/profile" />
    </app-page-header>

    <div class="grid sm:grid-cols-2 xl:grid-cols-4 gap-4">
      <app-stat-card icon="star" label="Average rating" [value]="rating().avg ? rating().avg.toFixed(1) : '—'" [hint]="rating().count + ' reviews'" />
      <app-stat-card icon="building" label="Gyms" [value]="gyms().length" />
      <app-stat-card icon="users" label="Assigned clients" [value]="athletes().length" />
      <app-stat-card icon="comment" label="Reviews this month" [value]="recentCount()" />
    </div>

    <div class="grid lg:grid-cols-2 gap-6 mt-6">
      <div class="card">
        <h2 class="font-semibold mb-4">My gyms</h2>
        <div class="space-y-3">
          @for (g of gyms(); track g.id) {
            <div class="flex items-center gap-3 p-3 rounded-xl border border-surface-200 dark:border-surface-700">
              <span class="w-10 h-10 rounded-lg grid place-items-center text-white text-xs font-bold" [style.background]="g.theme.primary">{{ g.theme.logoText }}</span>
              <div class="flex-1 min-w-0">
                <div class="font-medium">{{ g.name }}</div>
                <div class="text-xs muted">{{ g.sport }} · {{ g.city }}</div>
              </div>
              <span class="text-sm muted">{{ athletesAt(g.id) }} clients</span>
            </div>
          } @empty { <p class="muted text-sm">You're not linked to any gym yet. Gym admins can add you from the Liftly network.</p> }
        </div>
      </div>

      <div class="card">
        <div class="flex justify-between items-center mb-4">
          <h2 class="font-semibold">Latest reviews</h2>
          <a routerLink="/coach/reviews" class="text-sm text-primary font-semibold">See all</a>
        </div>
        <div class="space-y-3">
          @for (r of reviews().slice(0, 4); track r.id) {
            <div class="p-3 rounded-xl bg-surface-50 dark:bg-surface-800">
              <div class="flex justify-between gap-2"><span class="font-medium text-sm">{{ store.fullName(r.clientId) }}</span><app-stars [value]="r.rating" /></div>
              <p class="text-sm mt-1">{{ r.comment }}</p>
              <div class="text-xs muted mt-1">{{ store.gym(r.gymId)?.name }} · {{ r.createdAt | date }}</div>
            </div>
          } @empty { <p class="muted text-sm">No reviews yet.</p> }
        </div>
      </div>
    </div>

    <div class="card mt-6">
      <h2 class="font-semibold mb-4">My athletes</h2>
      <div class="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
        @for (a of athletes(); track a.m.id) {
          <div class="p-3 rounded-xl border border-surface-200 dark:border-surface-700">
            <div class="font-medium">{{ store.fullName(a.m.clientId) }}</div>
            <div class="text-xs muted">{{ store.gym(a.m.gymId)?.name }} · {{ store.plan(a.m.planId)?.name }}</div>
            <div class="text-xs muted">Until {{ a.m.endDate | date }}</div>
          </div>
        } @empty { <p class="muted text-sm">No clients assigned yet.</p> }
      </div>
    </div>
  `,
})
export class CoachDashboard {
  protected readonly auth = inject(AuthService);
  protected readonly store = inject(StoreService);
  private readonly id = computed(() => this.auth.user()!.id);
  protected readonly gyms = computed(() => this.store.gymsOfCoach(this.id()));
  protected readonly rating = computed(() => this.store.coachRating(this.id()));
  protected readonly reviews = computed(() => this.store.reviewsOfCoach(this.id()));
  protected readonly athletes = computed(() => this.store.memberships().filter((m) => m.coachId === this.id() && m.status === 'ACTIVE').map((m) => ({ m })));
  protected readonly recentCount = computed(() => {
    const since = new Date(Date.now() - 30 * 86400000).toISOString();
    return this.reviews().filter((r) => r.createdAt >= since).length;
  });
  athletesAt(gymId: string) { return this.athletes().filter((a) => a.m.gymId === gymId).length; }
}
