import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ConfirmationService, MessageService } from 'primeng/api';
import { FaIconComponent } from '@fortawesome/angular-fontawesome';
import { Button } from 'primeng/button';
import { InputNumber } from 'primeng/inputnumber';
import { Select } from 'primeng/select';
import { TableModule } from 'primeng/table';
import { ToggleSwitch } from 'primeng/toggleswitch';
import { Tooltip } from 'primeng/tooltip';
import { ALL_COUNTRY_CODES, ALL_CURRENCY_CODES, countryName, currencyName } from '../../../core/currency';
import { TranslatePipe, t } from '../../../core/i18n/i18n';
import { Country, CurrencySetting } from '../../../core/models';
import { StoreService } from '../../../core/store.service';
import { PageHeader } from '../../../shared/page-header/page-header';

/** Super-admin: currencies (with exchange rates for statistics) and countries (with their currency). */
@Component({
  selector: 'app-sa-currencies',
  imports: [TranslatePipe, FormsModule, FaIconComponent, Button, InputNumber, Select, TableModule, ToggleSwitch, Tooltip, PageHeader],
  templateUrl: './sa-currencies.html',
  styleUrl: './sa-currencies.css',
})
export class SaCurrencies {
  protected readonly store = inject(StoreService);
  private readonly toast = inject(MessageService);
  private readonly confirm = inject(ConfirmationService);

  protected readonly currencyName = currencyName;
  protected readonly countryName = countryName;

  protected readonly currencies = computed(() => [...this.store.currencies()].sort((a, b) => a.code.localeCompare(b.code)));
  protected readonly countries = computed(() => [...this.store.countries()].sort((a, b) => countryName(a.code).localeCompare(countryName(b.code))));
  /** Active currencies for the country's currency picker. */
  protected readonly currencyOptions = this.store.currencyOptions;

  // add currency
  protected readonly newCurrency = signal<string | null>(null);
  protected newRate = 1;
  protected readonly addableCurrencies = computed(() => {
    const have = new Set(this.store.currencies().map((c) => c.code));
    return ALL_CURRENCY_CODES.filter((c) => !have.has(c)).map((code) => ({ code, label: `${code} · ${currencyName(code)}` }));
  });

  // add country
  protected readonly newCountry = signal<string | null>(null);
  protected newCountryCurrency: string | null = null;
  protected readonly addableCountries = computed(() => {
    const have = new Set(this.store.countries().map((c) => c.code));
    return ALL_COUNTRY_CODES.filter((c) => !have.has(c)).map((code) => ({ code, label: countryName(code) })).sort((a, b) => a.label.localeCompare(b.label));
  });

  usage(code: string) { return this.store.currencyUsage(code); }
  /** "1 gym · 3 countries" — only the non-zero parts. */
  usageLabel(code: string) {
    const u = this.usage(code);
    const parts = [u.gyms && `${u.gyms} ${t('gyms')}`, u.plans && `${u.plans} ${t('plans')}`, u.countries && `${u.countries} ${t('countries')}`].filter(Boolean);
    return parts.length ? parts.join(' · ') : '—';
  }
  /** Every configured currency (also inactive ones), so a country's current currency always shows. */
  protected readonly allCurrencyOptions = computed(() => this.store.currencies().map((c) => ({ code: c.code, label: currencyName(c.code) })));
  inUse(code: string) { const u = this.usage(code); return u.gyms + u.plans + u.countries > 0; }
  gymsIn(country: string) { return this.store.gyms().filter((g) => g.country === country).length; }

  // ---------- currencies ----------
  setRate(c: CurrencySetting, rate: number | null) {
    if (!rate || rate <= 0 || c.code === 'USD') return;
    this.store.saveCurrency({ ...c, rateToUsd: rate });
  }

  toggleCurrency(c: CurrencySetting, active: boolean) {
    if (!active && c.code === 'USD') return;
    if (!active && this.usage(c.code).gyms) {
      this.toast.add({ severity: 'warn', summary: t('Currency in use'), detail: t('Gyms use {0}. It stays available to them but is hidden for new choices.', { 0: c.code }) });
    }
    this.store.saveCurrency({ ...c, active });
  }

  addCurrency() {
    const code = this.newCurrency();
    if (!code || !(this.newRate > 0)) return;
    this.store.saveCurrency({ code, rateToUsd: this.newRate, active: true });
    this.toast.add({ severity: 'success', summary: t('Currency added'), detail: `${code} · ${currencyName(code)}` });
    this.newCurrency.set(null);
    this.newRate = 1;
  }

  deleteCurrency(c: CurrencySetting) {
    if (this.inUse(c.code) || c.code === 'USD') {
      this.toast.add({ severity: 'warn', summary: t('Currency in use'), detail: t('Deactivate it instead, or move gyms, plans and countries to another currency first.') });
      return;
    }
    this.confirm.confirm({
      header: t('Delete currency'), message: t('Delete {0}?', { 0: `${c.code} · ${currencyName(c.code)}` }), acceptButtonStyleClass: 'p-button-danger',
      accept: () => this.store.deleteCurrency(c.code),
    });
  }

  // ---------- countries ----------
  setCountryCurrency(c: Country, currency: string) { this.store.saveCountry({ ...c, currency }); }
  setVat(c: Country, vatRate: number | null) { this.store.saveCountry({ ...c, vatRate: vatRate ?? 0 }); }
  toggleCountry(c: Country, active: boolean) { this.store.saveCountry({ ...c, active }); }

  addCountry() {
    const code = this.newCountry();
    if (!code || !this.newCountryCurrency) return;
    this.store.saveCountry({ code, currency: this.newCountryCurrency, active: true });
    this.toast.add({ severity: 'success', summary: t('Country added'), detail: countryName(code) });
    this.newCountry.set(null);
    this.newCountryCurrency = null;
  }

  deleteCountry(c: Country) {
    if (this.gymsIn(c.code)) {
      this.toast.add({ severity: 'warn', summary: t('Country in use'), detail: t('Gyms are registered in {0}. Deactivate it instead.', { 0: countryName(c.code) }) });
      return;
    }
    this.confirm.confirm({
      header: t('Delete country'), message: t('Delete {0}?', { 0: countryName(c.code) }), acceptButtonStyleClass: 'p-button-danger',
      accept: () => this.store.deleteCountry(c.code),
    });
  }
}
