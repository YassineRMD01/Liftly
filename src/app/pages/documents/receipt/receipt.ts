import { Component, computed, inject, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AuthService, HOME_BY_ROLE } from '../../../core/auth.service';
import { countryName } from '../../../core/currency';
import { TranslatePipe, t } from '../../../core/i18n/i18n';
import { StoreService } from '../../../core/store.service';
import { PrintDocument, PrintableDoc } from '../../../shared/print-document/print-document';

const METHOD: Record<string, string> = { CASH: 'Cash', CARD: 'Card', TRANSFER: 'Bank transfer' };

/** Printable receipt of a member payment (gym admin, staff of the gym, or the member). */
@Component({
  selector: 'app-receipt',
  imports: [TranslatePipe, RouterLink, PrintDocument],
  template: `@if (doc(); as d) { <app-print-document [doc]="d" [back]="back()" /> }
    @else { <div class="min-h-screen grid place-items-center text-center p-6"><div><h1 class="text-xl font-bold">{{ 'Receipt not found' | t }}</h1><a [routerLink]="back()" class="text-primary hover:underline">{{ 'Back' | t }}</a></div></div> }`,
})
export class Receipt {
  private readonly store = inject(StoreService);
  private readonly auth = inject(AuthService);
  readonly id = input.required<string>();
  protected readonly back = computed(() => HOME_BY_ROLE[this.auth.role() ?? 'CLIENT'] + (this.auth.role() === 'ADMIN' ? '/clients' : ''));
  protected readonly doc = computed<PrintableDoc | null>(() => {
    const p = this.store.payments().find((x) => x.id === this.id());
    const me = this.auth.user();
    if (!p || !me) return null;
    const allowed = me.id === p.clientId || this.auth.adminGyms().some((g) => g.id === p.gymId) || me.role === 'SUPER_ADMIN';
    const gym = this.store.gym(p.gymId);
    const client = this.store.user(p.clientId);
    if (!allowed || !gym || !client) return null;
    return {
      kind: 'RECEIPT', number: this.store.receiptNumber(p), date: p.date,
      seller: { name: gym.name, theme: gym.theme, lines: [gym.address, `${gym.city}, ${countryName(gym.country)}`] },
      buyer: { name: `${client.firstName} ${client.lastName}`, lines: [client.email, client.phone ?? ''].filter(Boolean) },
      items: [{ label: p.note || t('Membership payment'), amount: p.amount }],
      currency: this.store.paymentCurrency(p), vatRate: this.store.vatRate(gym.country),
      paidWith: t(METHOD[p.method] ?? p.method),
    };
  });
}
