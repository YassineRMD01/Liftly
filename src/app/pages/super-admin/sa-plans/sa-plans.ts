import { TranslatePipe, t } from '../../../core/i18n/i18n';
import { Component, inject, signal } from '@angular/core';
import { CurrencyPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ConfirmationService, MessageService } from 'primeng/api';
import { FaIconComponent } from '@fortawesome/angular-fontawesome';
import { ButtonDirective } from 'primeng/button';
import { Dialog } from 'primeng/dialog';
import { InputNumber } from 'primeng/inputnumber';
import { InputText } from 'primeng/inputtext';
import { Tag } from 'primeng/tag';
import { Textarea } from 'primeng/textarea';
import { ToggleSwitch } from 'primeng/toggleswitch';
import { SaasPlan } from '../../../core/models';
import { StoreService } from '../../../core/store.service';
import { PageHeader } from '../../../shared/page-header/page-header';
import { Select } from 'primeng/select';
import { countryName, formatMoney } from '../../../core/currency';

const EMPTY: SaasPlan = { id: '', name: '', description: '', monthlyPrice: 0, yearlyPrice: 0, maxCoaches: 5, maxClients: 200, features: [], customTheme: false, highlighted: false, active: true, countryPrices: [] };

@Component({
  selector: 'app-sa-plans',
  imports: [Select, TranslatePipe, FormsModule, CurrencyPipe, FaIconComponent, ButtonDirective, Dialog, InputNumber, InputText, Tag, Textarea, ToggleSwitch, PageHeader],
  templateUrl: './sa-plans.html',
  styleUrl: './sa-plans.css',
})
export class SaPlans {
  protected readonly store = inject(StoreService);
  private readonly toast = inject(MessageService);
  private readonly confirm = inject(ConfirmationService);
  protected visible = false;
  protected readonly draft = signal<SaasPlan>({ ...EMPTY });
  protected featuresText = '';

  protected readonly countryName = countryName;

  /** Currency used for a country's local price. */
  countryCurrency(code: string) { return this.store.country(code)?.currency ?? 'USD'; }

  /** Countries not priced yet in this plan (plus the row's own one). */
  countriesFor(current: string) {
    const used = new Set(this.draft().countryPrices.map((c) => c.country));
    return this.store.countryOptions().filter((c) => c.code === current || !used.has(c.code));
  }

  addCountryPrice() {
    const free = this.countriesFor('')[0];
    if (!free) return;
    this.draft.update((d) => ({ ...d, countryPrices: [...d.countryPrices, { country: free.code, monthly: 0, yearly: 0 }] }));
  }

  removeCountryPrice(i: number) {
    this.draft.update((d) => ({ ...d, countryPrices: d.countryPrices.filter((_, k) => k !== i) }));
  }

  localLabel(p: SaasPlan, i: number) {
    const cp = p.countryPrices[i];
    return `${countryName(cp.country)} · ${formatMoney(cp.monthly, this.countryCurrency(cp.country), 0)}`;
  }

  gymCount(id: string) { return this.store.gyms().filter((g) => g.saasPlanId === id).length; }

  edit(p: SaasPlan = EMPTY) {
    this.draft.set(structuredClone({ ...p, countryPrices: p.countryPrices ?? [] }));
    this.featuresText = p.features.join('\n');
    this.visible = true;
  }

  save() {
    this.store.saveSaasPlan({ ...this.draft(), features: this.featuresText.split('\n').map((f) => f.trim()).filter(Boolean) });
    this.visible = false;
    this.toast.add({ severity: 'success', summary: t('Plan saved') });
  }

  remove(p: SaasPlan) {
    if (this.gymCount(p.id)) {
      this.toast.add({ severity: 'warn', summary: t('Plan in use'), detail: t('Move gyms to another plan or hide it instead.') });
      return;
    }
    this.confirm.confirm({
      header: t('Delete plan'), message: t('Delete the "{0}" plan?', { 0: p.name }), acceptButtonStyleClass: 'p-button-danger',
      accept: () => { this.store.deleteSaasPlan(p.id); this.toast.add({ severity: 'success', summary: t('Plan deleted') }); },
    });
  }
}
