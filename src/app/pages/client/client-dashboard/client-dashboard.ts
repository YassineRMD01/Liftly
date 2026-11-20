import { InputNumber } from 'primeng/inputnumber';
import { InputText } from 'primeng/inputtext';
import { isoDate } from '../../../core/schedule';
import { GymLogo } from '../../../shared/gym-logo/gym-logo';
import { TranslatePipe, t } from '../../../core/i18n/i18n';
import { Component, computed, inject, signal, viewChild } from '@angular/core';
import { MoneyPipe } from '../../../core/currency';
import { DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { FaIconComponent } from '@fortawesome/angular-fontawesome';
import { ButtonDirective } from 'primeng/button';
import { ProgressBar } from 'primeng/progressbar';
import { Tag } from 'primeng/tag';
import { AuthService } from '../../../core/auth.service';
import { ClientMembership } from '../../../core/models';
import { StoreService } from '../../../core/store.service';
import { PageHeader } from '../../../shared/page-header/page-header';
import { OpenStatusBadge } from '../../../shared/open-status/open-status';
import { WeekCalendar } from '../../../shared/week-calendar/week-calendar';
import { PaymentCalendar } from '../../../shared/payment-calendar/payment-calendar';
import { Modal } from '../../../shared/modal/modal';
import { FormsModule } from '@angular/forms';
import { Rating } from 'primeng/rating';
import { Textarea } from 'primeng/textarea';
import { MessageService } from 'primeng/api';
import { Stars } from '../../../shared/stars/stars';
import { statusSeverity } from '../../super-admin/sa-gyms/sa-gyms';

@Component({
  selector: 'app-client-dashboard',
  imports: [GymLogo, FormsModule, Rating, Textarea, Stars, TranslatePipe, MoneyPipe, DatePipe, RouterLink, FaIconComponent, ButtonDirective, ProgressBar, Tag, PageHeader, OpenStatusBadge, WeekCalendar, PaymentCalendar, Modal, InputNumber, InputText],
  templateUrl: './client-dashboard.html',
  styleUrl: './client-dashboard.css',
})
export class ClientDashboard {
  protected readonly auth = inject(AuthService);
  protected readonly store = inject(StoreService);
  protected readonly sev = statusSeverity;
  protected readonly payments = viewChild(PaymentCalendar);
  protected readonly scheduleVisible = signal(false);
  /** Freeze request being written. */
  protected readonly freezing = signal<{ m: ClientMembership; start: string; days: number; reason: string } | null>(null);
  pendingFreeze(m: ClientMembership) { return this.store.freezeRequestsOfClient(this.auth.user()?.id ?? '').find((r) => r.membershipId === m.id && r.status === 'PENDING'); }
  askFreeze(m: ClientMembership) { this.freezing.set({ m, start: isoDate(new Date(Date.now() + 86400000)), days: 14, reason: '' }); }
  closeFreeze(v: boolean) { if (!v) this.freezing.set(null); }
  sendFreeze() {
    const f = this.freezing();
    if (!f || !(f.days > 0) || !f.reason.trim()) { this.toast.add({ severity: 'error', summary: t('Give a start date, a number of days and a reason.') }); return; }
    this.store.requestFreeze({ membershipId: f.m.id, start: f.start, days: f.days, reason: f.reason.trim() });
    this.toast.add({ severity: 'success', summary: t('Request sent'), detail: t('Your gym will answer soon.') });
    this.freezing.set(null);
  }
  protected readonly scheduleGym = signal<string | null>(null);

  // ---------- rate a gym ----------
  private readonly toast = inject(MessageService);
  protected readonly ratingGym = signal<string | null>(null);
  protected gymForm = { rating: 0, comment: '' };
  protected readonly ratingLabels: Record<number, string> = { 1: t('Poor'), 2: t('Fair'), 3: t('Good'), 4: t('Great'), 5: t('Excellent!') };
  myGymReview(gymId: string) { return this.store.gymReviewBy(gymId, this.auth.user()?.id ?? ''); }
  rateGym(gymId: string) {
    const r = this.myGymReview(gymId);
    this.gymForm = { rating: r?.rating ?? 0, comment: r?.comment ?? '' };
    this.ratingGym.set(gymId);
  }
  closeRate(visible: boolean) { if (!visible) this.ratingGym.set(null); }
  saveGymReview() {
    const gymId = this.ratingGym();
    if (!gymId || !this.gymForm.rating) return;
    this.store.saveGymReview({ gymId, clientId: this.auth.user()!.id, rating: this.gymForm.rating, comment: this.gymForm.comment.trim() });
    this.toast.add({ severity: 'success', summary: t('Thanks for your review!') });
    this.ratingGym.set(null);
  }
  deleteGymReview() {
    const r = this.myGymReview(this.ratingGym() ?? '');
    if (r) this.store.deleteGymReview(r.id);
    this.ratingGym.set(null);
  }

  showSchedule(gymId: string) {
    this.scheduleGym.set(gymId);
    this.scheduleVisible.set(true);
  }
  private readonly mine = computed(() => this.store.membershipsOfClient((this.auth.user()?.id ?? '')));
  protected readonly active = computed(() => this.mine().filter((m) => m.status === 'ACTIVE'));
  protected readonly past = computed(() => this.mine().filter((m) => m.status !== 'ACTIVE'));

  daysLeft(m: ClientMembership) { return Math.max(0, Math.ceil((+new Date(m.endDate) - Date.now()) / 86400000)); }
  progress(m: ClientMembership) {
    const total = +new Date(m.endDate) - +new Date(m.startDate);
    return Math.min(100, Math.max(0, ((Date.now() - +new Date(m.startDate)) / total) * 100));
  }
}
