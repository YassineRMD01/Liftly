import { Component, computed, inject, signal, viewChild } from '@angular/core';
import { DatePipe } from '@angular/common';
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
import { AuthService } from '../../../core/auth.service';
import { ClientMembership, Gender } from '../../../core/models';
import { PromoCheck, StoreService } from '../../../core/store.service';
import { PageHeader } from '../../../shared/page-header/page-header';
import { formatMoney, MoneyPipe } from '../../../core/currency';
import { PaymentCalendar } from '../../../shared/payment-calendar/payment-calendar';
import { statusSeverity } from '../../super-admin/sa-gyms/sa-gyms';

@Component({
  selector: 'app-admin-clients',
  imports: [MoneyPipe, FormsModule, DatePipe, FaIconComponent, Button, Dialog, IconField, InputIcon, InputText, Message, Select, SelectButton, TableModule, Tag, Tooltip, PageHeader, PaymentCalendar],
  templateUrl: './admin-clients.html',
  styleUrl: './admin-clients.css',
})
export class AdminClients {
  private readonly auth = inject(AuthService);
  private readonly store = inject(StoreService);
  private readonly toast = inject(MessageService);
  private readonly confirm = inject(ConfirmationService);
  protected readonly sev = statusSeverity;
  protected readonly cur = computed(() => this.auth.activeGym()?.currency ?? 'USD');
  protected readonly payments = viewChild(PaymentCalendar);
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
      header: 'Renew membership', message: `Renew ${plan.name} for ${this.store.fullName(m.clientId)} (${formatMoney(plan.price, this.cur())})?`,
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
