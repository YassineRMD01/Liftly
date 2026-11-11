import { Component, computed, inject, signal } from '@angular/core';
import { MoneyPipe } from '../../core/currency';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ConfirmationService, MessageService } from 'primeng/api';
import { FaIconComponent } from '@fortawesome/angular-fontawesome';
import { Button } from 'primeng/button';
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
import { AuthService } from '../../core/auth.service';
import { PromoCode } from '../../core/models';
import { StoreService } from '../../core/store.service';
import { PageHeader } from '../../shared/ui';

type PromoState = { label: string; sev: 'success' | 'warn' | 'danger' | 'secondary' | 'info' };

@Component({
  selector: 'app-admin-promos',
  imports: [MoneyPipe, FormsModule, DatePipe, FaIconComponent, Button, DatePicker, Dialog, InputGroup, InputGroupAddon, InputNumber, InputText, MultiSelect, ProgressBar, SelectButton, TableModule, Tag, ToggleSwitch, Tooltip, PageHeader],
  template: `
    <app-page-header title="Promo codes" subtitle="Discounts clients can apply when subscribing.">
      <p-button label="New promo code" (onClick)="edit()"><ng-template #icon><fa-icon icon="plus" /></ng-template></p-button>
    </app-page-header>

    <div class="card">
      <p-table [value]="promos()" [tableStyle]="{ 'min-width': '56rem' }">
        <ng-template #header>
          <tr><th>Code</th><th>Discount</th><th>Valid</th><th>Applies to</th><th style="width: 12rem">Usage</th><th>Status</th><th></th></tr>
        </ng-template>
        <ng-template #body let-p>
          <tr>
            <td>
              <span class="font-mono font-bold tracking-wider px-2 py-1 rounded-md bg-primary-50 dark:bg-primary-950 text-primary">{{ p.code }}</span>
              <p-button [text]="true" [rounded]="true" size="small" pTooltip="Copy" (onClick)="copy(p.code)"><fa-icon icon="copy" /></p-button>
            </td>
            <td class="font-semibold">{{ p.discountType === 'PERCENT' ? p.value + '%' : (p.value | money: cur()) }}</td>
            <td class="text-sm">{{ p.validFrom | date: 'mediumDate' }} → {{ p.validUntil | date: 'mediumDate' }}</td>
            <td class="text-sm muted">{{ planNames(p) }}</td>
            <td>
              <div class="text-xs muted mb-1">{{ p.uses }} / {{ p.maxUses === -1 ? '∞' : p.maxUses }}</div>
              <p-progressbar [value]="p.maxUses === -1 ? 0 : (p.uses / p.maxUses) * 100" [showValue]="false" styleClass="!h-1.5" />
            </td>
            <td><p-tag [value]="state(p).label" [severity]="state(p).sev" /></td>
            <td class="whitespace-nowrap">
              <p-button [text]="true" [rounded]="true" (onClick)="edit(p)" pTooltip="Edit"><fa-icon icon="pen" /></p-button>
              <p-button [text]="true" [rounded]="true" severity="danger" (onClick)="remove(p)" pTooltip="Delete"><fa-icon icon="trash" /></p-button>
            </td>
          </tr>
        </ng-template>
        <ng-template #emptymessage><tr><td colspan="7" class="text-center muted py-8">No promo codes yet.</td></tr></ng-template>
      </p-table>
    </div>

    <p-dialog [header]="draft().id ? 'Edit promo code' : 'New promo code'" [(visible)]="visible" [modal]="true" [style]="{ width: '38rem' }" [breakpoints]="{ '640px': '95vw' }">
      <div class="grid sm:grid-cols-2 gap-4">
        <div class="field sm:col-span-2">
          <label>Code</label>
          <p-inputgroup>
            <input pInputText class="font-mono uppercase" [(ngModel)]="draft().code" placeholder="SUMMER25" />
            <p-inputgroup-addon>
              <p-button [text]="true" (onClick)="generate()" pTooltip="Generate"><fa-icon icon="wand-magic-sparkles" /></p-button>
            </p-inputgroup-addon>
          </p-inputgroup>
        </div>
        <div class="field">
          <label>Discount type</label>
          <p-selectbutton [options]="types" optionLabel="label" optionValue="value" [(ngModel)]="draft().discountType" [allowEmpty]="false" />
        </div>
        <div class="field">
          <label>Value</label>
          @if (draft().discountType === 'PERCENT') {
            <p-inputnumber [(ngModel)]="draft().value" suffix=" %" [min]="1" [max]="100" />
          } @else {
            <p-inputnumber [(ngModel)]="draft().value" mode="currency" [currency]="cur()" [min]="0" />
          }
        </div>
        <div class="field sm:col-span-2">
          <label>Valid period</label>
          <p-datepicker [(ngModel)]="range" selectionMode="range" [readonlyInput]="true" [showIcon]="true" styleClass="w-full" appendTo="body" />
        </div>
        <div class="field"><label>Max uses (-1 = ∞)</label><p-inputnumber [(ngModel)]="draft().maxUses" [min]="-1" [showButtons]="true" /></div>
        <div class="field">
          <label>Restrict to plans</label>
          <p-multiselect [options]="plans()" optionLabel="name" optionValue="id" [(ngModel)]="draft().planIds" placeholder="All plans" display="chip" styleClass="w-full" appendTo="body" />
        </div>
        <label class="flex items-center gap-3"><p-toggleswitch [(ngModel)]="draft().active" /> Active</label>
      </div>
      <ng-template #footer>
        <p-button label="Cancel" [text]="true" severity="secondary" (onClick)="visible = false" />
        <p-button label="Save" (onClick)="save()" [disabled]="!draft().code || !draft().value" />
      </ng-template>
    </p-dialog>
  `,
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
  protected readonly types = [{ label: 'Percent', value: 'PERCENT' }, { label: 'Fixed amount', value: 'FIXED' }];
  private readonly gymId = computed(() => this.auth.activeGym()?.id ?? '');
  protected readonly promos = computed(() => this.store.promosOfGym(this.gymId()));
  protected readonly plans = computed(() => this.store.plansOfGym(this.gymId()));

  private empty(): PromoCode {
    const now = new Date();
    return { id: '', gymId: this.auth.activeGym()?.id ?? '', code: '', discountType: 'PERCENT', value: 10, validFrom: now.toISOString(), validUntil: new Date(now.getTime() + 30 * 86400000).toISOString(), maxUses: 100, uses: 0, planIds: [], active: true };
  }

  state(p: PromoCode): PromoState {
    const now = new Date().toISOString();
    if (!p.active) return { label: 'Disabled', sev: 'secondary' };
    if (now < p.validFrom) return { label: 'Scheduled', sev: 'info' };
    if (now > p.validUntil) return { label: 'Expired', sev: 'danger' };
    if (p.maxUses !== -1 && p.uses >= p.maxUses) return { label: 'Exhausted', sev: 'warn' };
    return { label: 'Live', sev: 'success' };
  }

  planNames(p: PromoCode) {
    return p.planIds.length ? p.planIds.map((id) => this.store.plan(id)?.name).filter(Boolean).join(', ') : 'All plans';
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
      this.toast.add({ severity: 'error', summary: 'Duplicate code', detail: `${code} already exists.` });
      return;
    }
    const [from, to] = this.range ?? [];
    const end = to ?? from;
    if (end) end.setHours(23, 59, 59);
    this.store.savePromo({ ...d, validFrom: (from ?? new Date()).toISOString(), validUntil: (end ?? new Date()).toISOString() });
    this.visible = false;
    this.toast.add({ severity: 'success', summary: 'Promo code saved', detail: code });
  }

  remove(p: PromoCode) {
    this.confirm.confirm({
      header: 'Delete promo code', message: `Delete ${p.code}?`, acceptButtonStyleClass: 'p-button-danger',
      accept: () => { this.store.deletePromo(p.id); this.toast.add({ severity: 'success', summary: 'Deleted' }); },
    });
  }

  copy(code: string) {
    navigator.clipboard?.writeText(code);
    this.toast.add({ severity: 'info', summary: 'Copied', detail: code, life: 1500 });
  }
}
