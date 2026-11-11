import { Component, computed, inject, signal } from '@angular/core';
import { CurrencyPipe, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ConfirmationService, MessageService } from 'primeng/api';
import { FaIconComponent } from '@fortawesome/angular-fontawesome';
import { Button } from 'primeng/button';
import { Dialog } from 'primeng/dialog';
import { IconField } from 'primeng/iconfield';
import { InputIcon } from 'primeng/inputicon';
import { InputText } from 'primeng/inputtext';
import { Message } from 'primeng/message';
import { Select } from 'primeng/select';
import { SelectButton } from 'primeng/selectbutton';
import { TableModule } from 'primeng/table';
import { Tag } from 'primeng/tag';
import { Tooltip } from 'primeng/tooltip';
import { AuthService } from '../../core/auth.service';
import { ClientMembership, Gender } from '../../core/models';
import { PromoCheck, StoreService } from '../../core/store.service';
import { PageHeader } from '../../shared/ui';
import { statusSeverity } from '../super-admin/sa-gyms';

@Component({
  selector: 'app-admin-clients',
  imports: [FormsModule, CurrencyPipe, DatePipe, FaIconComponent, Button, Dialog, IconField, InputIcon, InputText, Message, Select, SelectButton, TableModule, Tag, Tooltip, PageHeader],
  template: `
    <app-page-header title="Clients" subtitle="Only you can register members — create their account and membership here.">
      <p-button label="Add client" (onClick)="open()"><ng-template #icon><fa-icon icon="user-plus" /></ng-template></p-button>
    </app-page-header>

    <div class="card">
      <p-table #dt [value]="rows()" [paginator]="true" [rows]="10" [globalFilterFields]="['clientName', 'planName']" [tableStyle]="{ 'min-width': '64rem' }">
        <ng-template #caption>
          <div class="flex flex-wrap gap-3 items-center">
            <p-iconfield>
              <p-inputicon><fa-icon icon="magnifying-glass" /></p-inputicon>
              <input pInputText placeholder="Search client or plan" (input)="dt.filterGlobal($any($event.target).value, 'contains')" />
            </p-iconfield>
            <div class="flex-1"></div>
            <p-selectbutton [options]="filters" optionLabel="label" optionValue="value" [ngModel]="status()" (ngModelChange)="status.set($event)" [allowEmpty]="false" />
          </div>
        </ng-template>
        <ng-template #header>
          <tr>
            <th pSortableColumn="clientName">Client <p-sorticon field="clientName" /></th>
            <th>Plan</th><th>Coach</th><th>Paid</th><th pSortableColumn="endDate">Period <p-sorticon field="endDate" /></th><th>Status</th><th></th>
          </tr>
        </ng-template>
        <ng-template #body let-r>
          <tr>
            <td>
              <div class="font-medium">{{ r.clientName }}</div>
              <div class="text-xs muted">{{ r.email }}</div>
            </td>
            <td>{{ r.planName }}</td>
            <td>
              <p-select [options]="coaches()" [optionLabel]="'label'" optionValue="id" [ngModel]="r.m.coachId" (ngModelChange)="setCoach(r.m, $event)"
                placeholder="Assign" [showClear]="true" size="small" appendTo="body" styleClass="w-40" />
            </td>
            <td>
              {{ r.m.pricePaid | currency }}
              @if (r.promo) { <p-tag [value]="r.promo" severity="info" styleClass="ml-1 !text-[10px]" /> }
            </td>
            <td class="text-sm">{{ r.m.startDate | date: 'mediumDate' }} → {{ r.m.endDate | date: 'mediumDate' }}</td>
            <td><p-tag [value]="r.m.status" [severity]="sev(r.m.status)" /></td>
            <td class="whitespace-nowrap">
              <p-button [text]="true" [rounded]="true" pTooltip="Renew" (onClick)="renew(r.m)"><fa-icon icon="rotate" /></p-button>
              @if (r.m.status === 'ACTIVE') {
                <p-button [text]="true" [rounded]="true" severity="danger" pTooltip="Cancel" (onClick)="cancel(r.m)"><fa-icon icon="ban" /></p-button>
              }
            </td>
          </tr>
        </ng-template>
        <ng-template #emptymessage><tr><td colspan="7" class="text-center muted py-8">No clients found.</td></tr></ng-template>
      </p-table>
    </div>

    <p-dialog header="Add client subscription" [(visible)]="visible" [modal]="true" [style]="{ width: '34rem' }" [breakpoints]="{ '640px': '95vw' }">
      <div class="space-y-4">
        <p-selectbutton [options]="modes" optionLabel="label" optionValue="value" [(ngModel)]="mode" [allowEmpty]="false" />
        @if (mode === 'existing') {
          <div class="field">
            <label>Client</label>
            <p-select [options]="allClients()" optionLabel="label" optionValue="id" [(ngModel)]="form.clientId" [filter]="true" filterBy="label" placeholder="Search a member" styleClass="w-full" appendTo="body" />
          </div>
        } @else {
          <div class="grid grid-cols-2 gap-3">
            <div class="field"><label>First name</label><input pInputText [(ngModel)]="form.firstName" /></div>
            <div class="field"><label>Last name</label><input pInputText [(ngModel)]="form.lastName" /></div>
            <div class="field col-span-2"><label>Email</label><input pInputText type="email" [(ngModel)]="form.email" /></div>
            <div class="field col-span-2"><label>Gender</label><p-selectbutton [options]="genders" optionLabel="label" optionValue="value" [(ngModel)]="form.gender" /></div>
          </div>
          <p class="text-xs muted">A member account is created with the temporary password <b>welcome</b>.</p>
        }
        <div class="field">
          <label>Membership plan</label>
          <p-select [options]="plans()" optionLabel="name" optionValue="id" [(ngModel)]="form.planId" (ngModelChange)="promoResult.set(null)" placeholder="Choose a plan" styleClass="w-full" appendTo="body">
            <ng-template #item let-p><div class="flex justify-between w-full gap-4"><span>{{ p.name }}</span><span class="muted">{{ p.price | currency }}</span></div></ng-template>
          </p-select>
        </div>
        <div class="field">
          <label>Coach (optional)</label>
          <p-select [options]="coaches()" optionLabel="label" optionValue="id" [(ngModel)]="form.coachId" [showClear]="true" placeholder="No coach" styleClass="w-full" appendTo="body" />
        </div>
        <div class="field">
          <label>Promo code</label>
          <div class="flex gap-2">
            <input pInputText class="flex-1 uppercase font-mono" [(ngModel)]="form.promo" [disabled]="!form.planId" />
            <p-button label="Apply" [outlined]="true" (onClick)="applyPromo()" [disabled]="!form.planId || !form.promo" />
          </div>
          @if (promoResult(); as r) { <p-message [severity]="r.ok ? 'success' : 'error'" size="small">{{ r.message }}</p-message> }
        </div>
        @if (form.planId) {
          <div class="flex justify-between items-center p-3 rounded-xl bg-surface-100 dark:bg-surface-800">
            <span class="muted">Total</span>
            <span class="text-xl font-bold">
              @if (promoResult()?.ok) { <s class="text-sm muted mr-2">{{ planPrice() | currency }}</s> }
              {{ (promoResult()?.ok ? promoResult()!.finalPrice : planPrice()) | currency }}
            </span>
          </div>
        }
        @if (limitReached()) { <p-message severity="warn">Client limit of your plan reached — upgrade in Billing.</p-message> }
      </div>
      <ng-template #footer>
        <p-button label="Cancel" [text]="true" severity="secondary" (onClick)="visible = false" />
        <p-button label="Subscribe" (onClick)="submit()" [disabled]="!form.planId || limitReached()" />
      </ng-template>
    </p-dialog>
  `,
})
export class AdminClients {
  private readonly auth = inject(AuthService);
  private readonly store = inject(StoreService);
  private readonly toast = inject(MessageService);
  private readonly confirm = inject(ConfirmationService);
  protected readonly sev = statusSeverity;
  protected visible = false;
  protected mode: 'existing' | 'new' = 'existing';
  protected readonly genders = [{ label: 'Male', value: 'MALE' }, { label: 'Female', value: 'FEMALE' }];
  protected readonly modes = [{ label: 'Existing member', value: 'existing' }, { label: 'New member', value: 'new' }];
  protected readonly filters = [{ label: 'All', value: 'ALL' }, { label: 'Active', value: 'ACTIVE' }, { label: 'Expired', value: 'EXPIRED' }, { label: 'Cancelled', value: 'CANCELLED' }];
  protected readonly status = signal('ALL');
  protected readonly promoResult = signal<PromoCheck | null>(null);
  protected form = { clientId: '', firstName: '', lastName: '', email: '', planId: '', coachId: undefined as string | undefined, promo: '', gender: null as Gender | null };

  private readonly gymId = computed(() => this.auth.activeGym()?.id ?? '');
  protected readonly plans = computed(() => this.store.plansOfGym(this.gymId()).filter((p) => p.active));
  protected readonly coaches = computed(() => this.store.coachesOfGym(this.gymId()).map((c) => ({ id: c.id, label: `${c.firstName} ${c.lastName}` })));
  protected readonly allClients = computed(() => this.store.clients().map((c) => ({ id: c.id, label: `${c.firstName} ${c.lastName} · ${c.email}` })));
  protected readonly rows = computed(() =>
    this.store.membershipsOfGym(this.gymId())
      .filter((m) => this.status() === 'ALL' || m.status === this.status())
      .map((m) => ({
        m,
        clientName: this.store.fullName(m.clientId),
        email: this.store.user(m.clientId)?.email,
        planName: this.store.plan(m.planId)?.name ?? 'Deleted plan',
        promo: this.store.promo(m.promoCodeId)?.code,
        endDate: m.endDate,
      })));
  protected readonly limitReached = computed(() => {
    const max = this.store.saasPlan(this.auth.activeGym()?.saasPlanId)?.maxClients ?? -1;
    return max !== -1 && this.store.clientsOfGym(this.gymId()).length >= max;
  });

  planPrice() { return this.store.plan(this.form.planId)?.price ?? 0; }

  open() {
    this.form = { clientId: '', firstName: '', lastName: '', email: '', planId: '', coachId: undefined, promo: '', gender: null };
    this.promoResult.set(null);
    this.visible = true;
  }

  applyPromo() { this.promoResult.set(this.store.checkPromo(this.gymId(), this.form.planId, this.form.promo)); }

  submit() {
    let clientId = this.form.clientId;
    let created = false;
    if (this.mode === 'new') {
      const { firstName, lastName, email } = this.form;
      if (!firstName || !lastName || !email) return this.err('Fill in the new member details.');
      if (this.store.users().some((u) => u.email.toLowerCase() === email.toLowerCase())) return this.err('Email already registered — use "Existing member".');
      clientId = this.store.addUser({ role: 'CLIENT', firstName, lastName, email, password: 'welcome', ...(this.form.gender ? { gender: this.form.gender } : {}) }).id;
      created = true;
    }
    if (!clientId) return this.err('Choose a client.');
    if (this.form.promo && !this.store.checkPromo(this.gymId(), this.form.planId, this.form.promo).ok) return this.err('Promo code is not valid.');
    this.store.subscribeClient({ gymId: this.gymId(), clientId, planId: this.form.planId, coachId: this.form.coachId, promoCode: this.form.promo || undefined });
    this.visible = false;
    this.toast.add({ severity: 'success', summary: 'Subscription created', detail: this.store.fullName(clientId) });
    if (created) {
      this.toast.add({
        severity: 'info', sticky: true, summary: 'Member account created',
        detail: `Give the member their login: ${this.form.email} / temporary password "welcome".`,
      });
    }
  }

  private err(detail: string) { this.toast.add({ severity: 'error', summary: 'Cannot subscribe', detail }); }

  setCoach(m: ClientMembership, coachId: string | null) {
    this.store.updateMembership({ ...m, coachId: coachId ?? undefined });
    this.toast.add({ severity: 'success', summary: 'Coach updated', life: 1500 });
  }

  renew(m: ClientMembership) {
    const plan = this.store.plan(m.planId);
    if (!plan) return this.err('The plan no longer exists.');
    this.confirm.confirm({
      header: 'Renew membership', message: `Renew ${plan.name} for ${this.store.fullName(m.clientId)} (${plan.price} USD)?`,
      accept: () => {
        if (m.status === 'ACTIVE') this.store.updateMembership({ ...m, status: 'EXPIRED' });
        this.store.subscribeClient({ gymId: m.gymId, clientId: m.clientId, planId: m.planId, coachId: m.coachId });
        this.toast.add({ severity: 'success', summary: 'Membership renewed' });
      },
    });
  }

  cancel(m: ClientMembership) {
    this.confirm.confirm({
      header: 'Cancel membership', message: `Cancel ${this.store.fullName(m.clientId)}'s membership?`, acceptButtonStyleClass: 'p-button-danger',
      accept: () => { this.store.updateMembership({ ...m, status: 'CANCELLED' }); this.toast.add({ severity: 'warn', summary: 'Membership cancelled' }); },
    });
  }
}
