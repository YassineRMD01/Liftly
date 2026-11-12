import { countryName, formatMoney } from '../../../core/currency';
import { TranslatePipe, t } from '../../../core/i18n/i18n';
import { Component, computed, inject } from '@angular/core';
import { DatePipe } from '@angular/common';
import { ConfirmationService, MessageService } from 'primeng/api';
import { FaIconComponent } from '@fortawesome/angular-fontawesome';
import { Button } from 'primeng/button';
import { Tag } from 'primeng/tag';
import { Message } from 'primeng/message';
import { RouterLink } from '@angular/router';
import { MoneyPipe } from '../../../core/currency';
import { AuthService } from '../../../core/auth.service';
import { BillingCycle, SaasPlan } from '../../../core/models';
import { StoreService } from '../../../core/store.service';
import { PageHeader } from '../../../shared/page-header/page-header';
import { statusSeverity } from '../../super-admin/sa-gyms/sa-gyms';

@Component({
  selector: 'app-admin-billing',
  imports: [TranslatePipe, DatePipe, MoneyPipe, RouterLink, FaIconComponent, Button, Message, Tag, PageHeader],
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
  /** Subscription invoices (newest first), each printable. */
  protected readonly invoices = computed(() => this.store.saasInvoices(this.gym()?.id ?? '').slice(0, 24));
  protected readonly vat = computed(() => this.store.vatRate(this.gym()?.country));
  protected readonly trialDays = computed(() => (this.gym() ? this.store.trialDaysLeft(this.gym()!) : 0));

  /** Plan price for this gym's country (local price if set by the super-admin, otherwise USD). */
  price(p: SaasPlan | undefined, cycle: BillingCycle) { return this.store.saasPrice(p, this.gym()?.country, cycle); }
  priceLabel(p: SaasPlan | undefined, cycle: BillingCycle, decimals?: 0 | 2) {
    const x = this.price(p, cycle);
    return formatMoney(x.amount, x.currency, decimals);
  }
  /** Monthly price in USD, to tell an upgrade from a downgrade. */
  usd(p: SaasPlan | undefined) { const x = this.price(p, 'MONTHLY'); return this.store.toUsd(x.amount, x.currency); }
  countryLabel(code: string) { return countryName(code); }

  change(p: SaasPlan) {
    const g = this.gym()!;
    const coaches = this.store.coachesOfGym(g.id).length;
    const clients = this.store.clientsOfGym(g.id).length;
    if ((p.maxCoaches !== -1 && coaches > p.maxCoaches) || (p.maxClients !== -1 && clients > p.maxClients)) {
      this.toast.add({ severity: 'error', summary: t('Plan too small'), detail: t('You have {0} coaches and {1} clients.', { 0: coaches, 1: clients }) });
      return;
    }
    this.confirm.confirm({
      header: t('Change plan'), message: t('Move to {0} for {1} per {2}?', { 0: p.name, 1: this.priceLabel(p, g.billingCycle), 2: g.billingCycle === 'MONTHLY' ? t('month') : t('year') }),
      accept: () => {
        this.store.updateGym({ ...g, saasPlanId: p.id });
        this.toast.add({ severity: 'success', summary: t('Plan changed'), detail: t('You\'re now on {0}.', { 0: p.name }) });
      },
    });
  }

  switchCycle() {
    const g = this.gym()!;
    this.store.updateGym({ ...g, billingCycle: g.billingCycle === 'MONTHLY' ? 'YEARLY' : 'MONTHLY' });
    this.toast.add({ severity: 'success', summary: t('Billing cycle updated') });
  }

  activate() {
    const g = this.gym()!;
    const now = new Date();
    const days = g.billingCycle === 'MONTHLY' ? 30 : 365;
    this.store.updateGym({ ...g, status: 'ACTIVE', renewsAt: new Date(now.getTime() + days * 86400000).toISOString() });
    this.toast.add({ severity: 'success', summary: t('Subscription active'), detail: t('Thanks for choosing Liftly!') });
  }
}
