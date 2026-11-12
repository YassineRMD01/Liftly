import { TranslatePipe, t } from '../../../core/i18n/i18n';
import { Component, computed, inject, signal } from '@angular/core';
import { MoneyPipe } from '../../../core/currency';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ConfirmationService, MessageService } from 'primeng/api';
import { FaIconComponent } from '@fortawesome/angular-fontawesome';
import { ButtonDirective, ButtonIcon, ButtonLabel } from 'primeng/button';
import { DatePicker } from 'primeng/datepicker';
import { Dialog } from 'primeng/dialog';
import { InputGroup } from 'primeng/inputgroup';
import { InputGroupAddon } from 'primeng/inputgroupaddon';
import { InputNumber } from 'primeng/inputnumber';
import { InputText } from 'primeng/inputtext';
import { MultiSelect } from 'primeng/multiselect';
import { ProgressBar } from 'primeng/progressbar';
import { SelectButton } from 'primeng/selectbutton';
import { TableModule } from 'primeng/table';
import { Tag } from 'primeng/tag';
import { ToggleSwitch } from 'primeng/toggleswitch';
import { Tooltip } from 'primeng/tooltip';
import { AuthService } from '../../../core/auth.service';
import { PromoCode } from '../../../core/models';
import { StoreService } from '../../../core/store.service';
import { PageHeader } from '../../../shared/page-header/page-header';

type PromoState = { label: string; sev: 'success' | 'warn' | 'danger' | 'secondary' | 'info' };

@Component({
  selector: 'app-admin-promos',
  imports: [TranslatePipe, MoneyPipe, FormsModule, DatePipe, FaIconComponent, ButtonDirective, ButtonIcon, ButtonLabel, DatePicker, Dialog, InputGroup, InputGroupAddon, InputNumber, InputText, MultiSelect, ProgressBar, SelectButton, TableModule, Tag, ToggleSwitch, Tooltip, PageHeader],
  templateUrl: './admin-promos.html',
  styleUrl: './admin-promos.css',
})
export class AdminPromos {
  private readonly auth = inject(AuthService);
  private readonly store = inject(StoreService);
  private readonly toast = inject(MessageService);
  private readonly confirm = inject(ConfirmationService);
  protected visible = false;
  protected readonly cur = computed(() => this.auth.activeGym()?.currency ?? 'USD');
  protected range: Date[] | null = null;
  protected readonly draft = signal<PromoCode>(this.empty());
  protected readonly types = [{ label: t('Percent'), value: 'PERCENT' }, { label: t('Fixed amount'), value: 'FIXED' }];
  private readonly gymId = computed(() => this.auth.activeGym()?.id ?? '');
  protected readonly promos = computed(() => this.store.promosOfGym(this.gymId()));
  protected readonly plans = computed(() => this.store.plansOfGym(this.gymId()));

  private empty(): PromoCode {
    const now = new Date();
    return { id: '', gymId: this.auth.activeGym()?.id ?? '', code: '', discountType: 'PERCENT', value: 10, validFrom: now.toISOString(), validUntil: new Date(now.getTime() + 30 * 86400000).toISOString(), maxUses: 100, uses: 0, planIds: [], active: true };
  }

  state(p: PromoCode): PromoState {
    const now = new Date().toISOString();
    if (!p.active) return { label: t('Disabled'), sev: 'secondary' };
    if (now < p.validFrom) return { label: t('Scheduled'), sev: 'info' };
    if (now > p.validUntil) return { label: t('Expired'), sev: 'danger' };
    if (p.maxUses !== -1 && p.uses >= p.maxUses) return { label: t('Exhausted'), sev: 'warn' };
    return { label: t('Live'), sev: 'success' };
  }

  planNames(p: PromoCode) {
    return p.planIds.length ? p.planIds.map((id) => this.store.plan(id)?.name).filter(Boolean).join(', ') : t('All plans');
  }

  edit(p?: PromoCode) {
    const d = p ? structuredClone(p) : this.empty();
    this.draft.set(d);
    this.range = [new Date(d.validFrom), new Date(d.validUntil)];
    this.visible = true;
  }

  generate() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    const code = Array.from({ length: 8 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
    this.draft.update((d) => ({ ...d, code }));
  }

  save() {
    const d = this.draft();
    const code = d.code.trim().toUpperCase();
    if (this.promos().some((p) => p.code === code && p.id !== d.id)) {
      this.toast.add({ severity: 'error', summary: t('Duplicate code'), detail: t('{0} already exists.', { 0: code }) });
      return;
    }
    const [from, to] = this.range ?? [];
    const end = to ?? from;
    if (end) end.setHours(23, 59, 59);
    this.store.savePromo({ ...d, validFrom: (from ?? new Date()).toISOString(), validUntil: (end ?? new Date()).toISOString() });
    this.visible = false;
    this.toast.add({ severity: 'success', summary: t('Promo code saved'), detail: code });
  }

  remove(p: PromoCode) {
    this.confirm.confirm({
      header: t('Delete promo code'), message: t('Delete {0}?', { 0: p.code }), acceptButtonStyleClass: 'p-button-danger',
      accept: () => { this.store.deletePromo(p.id); this.toast.add({ severity: 'success', summary: t('Deleted') }); },
    });
  }

  copy(code: string) {
    navigator.clipboard?.writeText(code);
    this.toast.add({ severity: 'info', summary: t('Copied'), detail: code, life: 1500 });
  }
}
