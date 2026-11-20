import { Component, computed, inject } from '@angular/core';
import { countryName, MoneyPipe } from '../../../core/currency';
import { TranslatePipe } from '../../../core/i18n/i18n';
import { StoreService } from '../../../core/store.service';
import { AccountingView } from '../../../shared/accounting-view/accounting-view';
import { PageHeader } from '../../../shared/page-header/page-header';

/** Platform accounting (USD): gym subscription revenue, platform costs, VAT per country. */
@Component({
  selector: 'app-sa-accounting',
  imports: [TranslatePipe, MoneyPipe, AccountingView, PageHeader],
  templateUrl: './sa-accounting.html',
  styleUrl: './sa-accounting.css',
})
export class SaAccounting {
  private readonly store = inject(StoreService);
  protected readonly lines = computed(() => this.store.platformLedger());
  protected readonly year = new Date().getFullYear();
  /** VAT collected per country this year (to declare in each country). */
  protected readonly vatByCountry = computed(() => {
    const map = new Map<string, { revenue: number; vat: number; invoices: number }>();
    for (const l of this.lines()) {
      if (l.type !== 'INCOME' || !l.country || !l.date.startsWith(String(this.year))) continue;
      const r = map.get(l.country) ?? { revenue: 0, vat: 0, invoices: 0 };
      r.revenue += l.amount; r.vat += l.vat; r.invoices++;
      map.set(l.country, r);
    }
    return [...map.entries()].map(([code, r]) => ({ code, name: countryName(code), rate: this.store.vatRate(code), ...r })).sort((a, b) => b.revenue - a.revenue);
  });
}
