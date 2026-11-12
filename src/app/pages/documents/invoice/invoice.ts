import { Component, computed, inject, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../../core/auth.service';
import { countryName } from '../../../core/currency';
import { TranslatePipe, t } from '../../../core/i18n/i18n';
import { StoreService } from '../../../core/store.service';
import { PrintDocument, PrintableDoc } from '../../../shared/print-document/print-document';

/** Printable invoice of a gym's Liftly subscription period (gym admin or super-admin). */
@Component({
  selector: 'app-invoice',
  imports: [TranslatePipe, RouterLink, PrintDocument],
  template: `@if (doc(); as d) { <app-print-document [doc]="d" [back]="back()" /> }
    @else { <div class="min-h-screen grid place-items-center text-center p-6"><div><h1 class="text-xl font-bold">{{ 'Invoice not found' | t }}</h1><a [routerLink]="back()" class="text-primary hover:underline">{{ 'Back' | t }}</a></div></div> }`,
})
export class Invoice {
  private readonly store = inject(StoreService);
  private readonly auth = inject(AuthService);
  readonly gymId = input.required<string>();
  readonly number = input.required<string>();
  protected readonly back = computed(() => (this.auth.role() === 'SUPER_ADMIN' ? '/super-admin/gyms' : '/admin/billing'));
  protected readonly doc = computed<PrintableDoc | null>(() => {
    const gym = this.store.gym(this.gymId());
    const me = this.auth.user();
    if (!gym || !me || (me.role !== 'SUPER_ADMIN' && gym.ownerId !== me.id)) return null;
    const inv = this.store.saasInvoices(gym.id).find((i) => i.number === this.number());
    if (!inv) return null;
    const owner = this.store.user(gym.ownerId);
    const platform = this.store.platform();
    return {
      kind: 'INVOICE', number: inv.number, date: inv.date,
      seller: { name: 'Liftly', theme: platform.theme, lines: ['billing@liftly.io'] },
      buyer: { name: gym.name, lines: [gym.address, `${gym.city}, ${countryName(gym.country)}`, owner ? `${owner.firstName} ${owner.lastName} · ${owner.email}` : ''].filter(Boolean) },
      items: [{ label: t('Liftly {plan} plan', { plan: inv.plan }), detail: t('Period {from} → {to}', { from: inv.date, to: inv.periodEnd }), amount: inv.amount }],
      currency: inv.currency, vatRate: this.store.vatRate(gym.country), paidWith: t('Card on file'),
    };
  });
}
