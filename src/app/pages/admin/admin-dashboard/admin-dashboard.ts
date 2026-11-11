import { TranslatePipe, TranslateJoinPipe } from '../../../core/i18n/i18n';
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
  imports: [TranslateJoinPipe, TranslatePipe, MoneyPipe, DatePipe, RouterLink, Button, ProgressBar, TableModule, Tag, PageHeader, StatCard, Stars],
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
