import { Component, computed, inject, signal, viewChild } from '@angular/core';
import { MoneyPipe } from '../../../core/currency';
import { DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { FaIconComponent } from '@fortawesome/angular-fontawesome';
import { Button } from 'primeng/button';
import { ProgressBar } from 'primeng/progressbar';
import { Tag } from 'primeng/tag';
import { AuthService } from '../../../core/auth.service';
import { ClientMembership } from '../../../core/models';
import { StoreService } from '../../../core/store.service';
import { PageHeader } from '../../../shared/page-header/page-header';
import { OpenStatusBadge } from '../../../shared/open-status/open-status';
import { WeekCalendar } from '../../../shared/week-calendar/week-calendar';
import { PaymentCalendar } from '../../../shared/payment-calendar/payment-calendar';
import { Dialog } from 'primeng/dialog';
import { statusSeverity } from '../../super-admin/sa-gyms/sa-gyms';

@Component({
  selector: 'app-client-dashboard',
  imports: [MoneyPipe, DatePipe, RouterLink, FaIconComponent, Button, ProgressBar, Tag, PageHeader, OpenStatusBadge, WeekCalendar, PaymentCalendar, Dialog],
  templateUrl: './client-dashboard.html',
  styleUrl: './client-dashboard.css',
})
export class ClientDashboard {
  protected readonly auth = inject(AuthService);
  protected readonly store = inject(StoreService);
  protected readonly sev = statusSeverity;
  protected readonly payments = viewChild(PaymentCalendar);
  protected scheduleVisible = false;
  protected readonly scheduleGym = signal<string | null>(null);

  showSchedule(gymId: string) {
    this.scheduleGym.set(gymId);
    this.scheduleVisible = true;
  }
  private readonly mine = computed(() => this.store.membershipsOfClient(this.auth.user()!.id));
  protected readonly active = computed(() => this.mine().filter((m) => m.status === 'ACTIVE'));
  protected readonly past = computed(() => this.mine().filter((m) => m.status !== 'ACTIVE'));

  daysLeft(m: ClientMembership) { return Math.max(0, Math.ceil((+new Date(m.endDate) - Date.now()) / 86400000)); }
  progress(m: ClientMembership) {
    const total = +new Date(m.endDate) - +new Date(m.startDate);
    return Math.min(100, Math.max(0, ((Date.now() - +new Date(m.startDate)) / total) * 100));
  }
}
