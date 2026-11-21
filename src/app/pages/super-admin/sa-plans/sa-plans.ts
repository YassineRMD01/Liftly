import { Checkbox } from 'primeng/checkbox';
import { MODULE_INFO } from '../../admin/admin-upgrade/admin-upgrade';
import { GymModule } from '../../../core/models';
import { TranslatePipe, t } from '../../../core/i18n/i18n';
import { Component, computed, inject, signal } from '@angular/core';
import { AuthService } from '../../../core/auth.service';
import { FormsModule } from '@angular/forms';
import { ConfirmationService, MessageService } from 'primeng/api';
import { FaIconComponent } from '@fortawesome/angular-fontawesome';
import { ButtonDirective } from 'primeng/button';
import { Modal } from '../../../shared/modal/modal';
import { InputNumber } from 'primeng/inputnumber';
import { InputText } from 'primeng/inputtext';
import { Tag } from 'primeng/tag';
import { Textarea } from 'primeng/textarea';
import { ToggleSwitch } from 'primeng/toggleswitch';
import { SaasPlan } from '../../../core/models';
import { StoreService } from '../../../core/store.service';
import { PageHeader } from '../../../shared/page-header/page-header';
import { Select } from 'primeng/select';
import { Tooltip } from 'primeng/tooltip';
import { countryName, formatMoney } from '../../../core/currency';

const EMPTY: SaasPlan = { id: '', name: '', description: '', monthlyPrice: 0, yearlyPrice: 0, maxCoaches: 5, maxClients: 200, features: [], customTheme: false, highlighted: false, active: true, countryPrices: [] };

@Component({
  selector: 'app-sa-plans',
  imports: [Tooltip, Checkbox, Select, TranslatePipe, FormsModule, FaIconComponent, ButtonDirective, Modal, InputNumber, InputText, Tag, Textarea, ToggleSwitch, PageHeader],
  templateUrl: './sa-plans.html',
  styleUrl: './sa-plans.css',
})
export class SaPlans {
  protected readonly info = MODULE_INFO;
  protected readonly modules = Object.keys(MODULE_INFO) as GymModule[];
  hasModule(m: GymModule) { const mods = this.draft().modules; return !mods || mods.includes(m); }
  toggleModule(m: GymModule) {
    const current = this.draft().modules ?? [...this.modules];
    const next = current.includes(m) ? current.filter((x) => x !== m) : [...current, m];
    this.draft.update((d) => ({ ...d, modules: next.length === this.modules.length ? undefined : next }));
  }
  protected readonly store = inject(StoreService);
  private readonly toast = inject(MessageService);
  private readonly confirm = inject(ConfirmationService);
  protected readonly visible = signal(false);
  protected readonly draft = signal<SaasPlan>({ ...EMPTY });
  protected featuresText = '';

  protected readonly countryName = countryName;
  private readonly auth = inject(AuthService);

  // ---------- display currency: the super-admin's country decides it (same rule as Accounting) ----------
  protected readonly currency = computed(() => this.store.accountingCurrency(this.auth.user()?.id));
  protected readonly country = computed(() => this.auth.user()?.country ?? null);
  protected readonly countries = computed(() => this.store.countryOptions().map((c) => ({ ...c, label: `${c.label} · ${c.currency}` })));
  setCountry(code: string | null) {
    const u = this.auth.user();
    if (!u || !code) return;
    this.store.setUserCountry(u.id, code);
    this.toast.add({ severity: 'info', summary: t('Accounting currency: {0}', { 0: this.currency() }), life: 2000 });
  }
  /** A USD amount (base plan price) shown in the display currency. */
  shown(usd: number, decimals?: 0 | 2) { return formatMoney(this.store.convert(usd, 'USD', this.currency()), this.currency(), decimals); }
  fmtLocal(v: number, country: string) { return formatMoney(v, this.countryCurrency(country), 0); }
  usd(amount: number) { return formatMoney(amount, 'USD'); }
  /** USD price converted to a country's currency, rounded to whole units (what a local price defaults to). */
  convertedFor(usd: number, country: string) { return Math.round(this.store.convert(usd, 'USD', this.countryCurrency(country))); }

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
    const d = this.draft();
    // starts at the USD price converted with the platform exchange rate; adjust it to a local price point
    this.draft.set({ ...d, countryPrices: [...d.countryPrices, { country: free.code, monthly: this.convertedFor(d.monthlyPrice, free.code), yearly: this.convertedFor(d.yearlyPrice, free.code) }] });
  }

  /** Country changed on a row: a row still at its converted (or empty) price follows the new currency. */
  setRowCountry(i: number, code: string) {
    const d = this.draft();
    const cp = d.countryPrices[i];
    const untouched = (!cp.monthly && !cp.yearly) || (cp.monthly === this.convertedFor(d.monthlyPrice, cp.country) && cp.yearly === this.convertedFor(d.yearlyPrice, cp.country));
    const next = untouched ? { country: code, monthly: this.convertedFor(d.monthlyPrice, code), yearly: this.convertedFor(d.yearlyPrice, code) } : { ...cp, country: code };
    this.draft.set({ ...d, countryPrices: d.countryPrices.map((x, k) => (k === i ? next : x)) });
  }

  /** Replaces a row's prices with the converted USD prices. */
  convertRow(i: number) {
    const d = this.draft();
    this.draft.set({ ...d, countryPrices: d.countryPrices.map((x, k) => (k === i ? { ...x, monthly: this.convertedFor(d.monthlyPrice, x.country), yearly: this.convertedFor(d.yearlyPrice, x.country) } : x)) });
  }

  /** Local price vs the converted USD price, in %. */
  gap(usd: number, local: number, country: string) {
    const ref = this.store.convert(usd, 'USD', this.countryCurrency(country));
    return ref ? Math.round(((local - ref) / ref) * 100) : 0;
  }

  removeCountryPrice(i: number) {
    this.draft.update((d) => ({ ...d, countryPrices: d.countryPrices.filter((_, k) => k !== i) }));
  }

  localLabel(p: SaasPlan, i: number) {
    const cp = p.countryPrices[i];
    const cur = this.countryCurrency(cp.country);
    const local = `${countryName(cp.country)} · ${formatMoney(cp.monthly, cur, 0)}`;
    return cur === this.currency() ? local : `${local} ≈ ${formatMoney(this.store.convert(cp.monthly, cur, this.currency()), this.currency(), 0)}`;
  }

  gymCount(id: string) { return this.store.gyms().filter((g) => g.saasPlanId === id).length; }

  edit(p: SaasPlan = EMPTY) {
    this.draft.set(structuredClone({ ...p, countryPrices: p.countryPrices ?? [] }));
    this.featuresText = p.features.join('\n');
    this.visible.set(true);
  }

  save() {
    this.store.saveSaasPlan({ ...this.draft(), features: this.featuresText.split('\n').map((f) => f.trim()).filter(Boolean) });
    this.visible.set(false);
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
