import { Component, computed, inject } from '@angular/core';
import { CurrencyPipe, DatePipe } from '@angular/common';
import { ConfirmationService, MessageService } from 'primeng/api';
import { FaIconComponent } from '@fortawesome/angular-fontawesome';
import { Button } from 'primeng/button';
import { Tag } from 'primeng/tag';
import { AuthService } from '../../../core/auth.service';
import { BillingCycle, SaasPlan } from '../../../core/models';
import { StoreService } from '../../../core/store.service';
import { PageHeader } from '../../../shared/page-header/page-header';
import { statusSeverity } from '../../super-admin/sa-gyms/sa-gyms';

@Component({
  selector: 'app-admin-billing',
  imports: [CurrencyPipe, DatePipe, FaIconComponent, Button, Tag, PageHeader],
  templateUrl: './admin-billing.html',
  styleUrl: './admin-billing.css',
})
export class AdminBilling {
  private readonly auth = inject(AuthService);
  private readonly store = inject(StoreService);
  private readonly toast = inject(MessageService);
  private readonly confirm = inject(ConfirmationService);
  protected readonly sev = statusSeverity;
  protected readonly gym = this.auth.activeGym;
  protected readonly current = computed(() => this.store.saasPlan(this.gym()?.saasPlanId));
  protected readonly plans = computed(() => this.store.saasPlans().filter((p) => p.active || p.id === this.gym()?.saasPlanId));
  protected readonly invoices = computed(() => {
    const g = this.gym();
    const p = this.current();
    if (!g || !p || g.status === 'TRIAL') return [];
    const step = g.billingCycle === 'MONTHLY' ? 30 : 365;
    return Array.from({ length: 4 }, (_, i) => ({
      date: new Date(new Date(g.renewsAt).getTime() - (i + 1) * step * 86400000).toISOString(),
      label: `${p.name} · ${g.billingCycle.toLowerCase()}`,
      amount: this.price(p, g.billingCycle),
    })).filter((i) => i.date >= g.subscribedAt);
  });

  price(p: SaasPlan | undefined, cycle: BillingCycle) { return p ? (cycle === 'MONTHLY' ? p.monthlyPrice : p.yearlyPrice) : 0; }

  change(p: SaasPlan) {
    const g = this.gym()!;
    const coaches = this.store.coachesOfGym(g.id).length;
    const clients = this.store.clientsOfGym(g.id).length;
    if ((p.maxCoaches !== -1 && coaches > p.maxCoaches) || (p.maxClients !== -1 && clients > p.maxClients)) {
      this.toast.add({ severity: 'error', summary: 'Plan too small', detail: `You have ${coaches} coaches and ${clients} clients.` });
      return;
    }
    this.confirm.confirm({
      header: 'Change plan', message: `Move to ${p.name} for ${this.price(p, g.billingCycle)} USD per ${g.billingCycle === 'MONTHLY' ? 'month' : 'year'}?`,
      accept: () => {
        this.store.updateGym({ ...g, saasPlanId: p.id });
        this.toast.add({ severity: 'success', summary: 'Plan changed', detail: `You're now on ${p.name}.` });
      },
    });
  }

  switchCycle() {
    const g = this.gym()!;
    this.store.updateGym({ ...g, billingCycle: g.billingCycle === 'MONTHLY' ? 'YEARLY' : 'MONTHLY' });
    this.toast.add({ severity: 'success', summary: 'Billing cycle updated' });
  }

  activate() {
    const g = this.gym()!;
    const now = new Date();
    const days = g.billingCycle === 'MONTHLY' ? 30 : 365;
    this.store.updateGym({ ...g, status: 'ACTIVE', renewsAt: new Date(now.getTime() + days * 86400000).toISOString() });
    this.toast.add({ severity: 'success', summary: 'Subscription active', detail: 'Thanks for choosing Liftly!' });
  }
}
