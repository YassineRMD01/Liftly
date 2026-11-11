import { TranslatePipe } from '../../../core/i18n/i18n';
import { Component, computed, inject } from '@angular/core';
import { DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { Button } from 'primeng/button';
import { AuthService } from '../../../core/auth.service';
import { StoreService } from '../../../core/store.service';
import { PageHeader } from '../../../shared/page-header/page-header';
import { StatCard } from '../../../shared/stat-card/stat-card';
import { Stars } from '../../../shared/stars/stars';
import { OpenStatusBadge } from '../../../shared/open-status/open-status';

@Component({
  selector: 'app-coach-dashboard',
  imports: [TranslatePipe, DatePipe, RouterLink, Button, PageHeader, StatCard, Stars, OpenStatusBadge],
  templateUrl: './coach-dashboard.html',
  styleUrl: './coach-dashboard.css',
})
export class CoachDashboard {
  protected readonly auth = inject(AuthService);
  protected readonly store = inject(StoreService);
  private readonly id = computed(() => (this.auth.user()?.id ?? ''));
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
