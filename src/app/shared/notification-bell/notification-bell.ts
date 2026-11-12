import { Component, computed, effect, inject } from '@angular/core';
import { DatePipe } from '@angular/common';
import { Router } from '@angular/router';
import { FaIconComponent } from '@fortawesome/angular-fontawesome';
import { Button } from 'primeng/button';
import { OverlayBadge } from 'primeng/overlaybadge';
import { Popover } from 'primeng/popover';
import { AuthService } from '../../core/auth.service';
import { TranslatePipe } from '../../core/i18n/i18n';
import { AppNotification } from '../../core/models';
import { StoreService } from '../../core/store.service';

/** Header bell: the user's in-app notifications (waitlist places, reminders, messages…). */
@Component({
  selector: 'app-notification-bell',
  imports: [TranslatePipe, DatePipe, FaIconComponent, Button, OverlayBadge, Popover],
  templateUrl: './notification-bell.html',
  styleUrl: './notification-bell.css',
})
export class NotificationBell {
  private readonly auth = inject(AuthService);
  private readonly store = inject(StoreService);
  private readonly router = inject(Router);

  protected readonly items = computed(() => this.store.notificationsOf(this.auth.user()?.id ?? '').slice(0, 30));
  protected readonly unread = computed(() => this.items().filter((n) => !n.read).length);

  constructor() {
    // members get their renewal reminders automatically (once per membership)
    effect(() => {
      const u = this.auth.user();
      // gym owners are reminded when their free trial is about to end
      if (u?.role === 'ADMIN') {
        for (const g of this.store.gymsOfAdmin(u.id).filter((x) => x.status === 'TRIAL' && this.store.trialDaysLeft(x) <= 7)) {
          this.store.notify(u.id, 'Your trial ends soon', 'The free trial of {gym} ends in {days} days. Choose a plan in Billing to keep your data and members.',
            { gym: g.name, days: this.store.trialDaysLeft(g) }, '/admin/billing', `trial-${g.id}-${g.renewsAt.slice(0, 10)}`);
        }
        return;
      }
      if (u?.role !== 'CLIENT') return;
      for (const g of this.store.gymsOfClient(u.id)) {
        for (const m of this.store.endingSoon(g.id).filter((x) => x.clientId === u.id)) {
          this.store.notify(u.id, 'Your membership ends soon', 'Your {plan} membership at {gym} ends on {date}. Ask the gym to renew it.',
            { plan: this.store.plan(m.planId)?.name ?? '', gym: g.name, date: m.endDate.slice(0, 10) }, '/client', `renew-${m.id}`);
        }
      }
    });
  }

  open(n: AppNotification, pop: Popover) {
    this.store.markRead(n.id);
    if (n.link) {
      pop.hide();
      this.router.navigateByUrl(n.link);
    }
  }
  markAll() { this.store.markAllRead(this.auth.user()?.id ?? ''); }
}
