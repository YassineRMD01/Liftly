import { TranslatePipe, t } from '../../../core/i18n/i18n';
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
  imports: [TranslatePipe, MoneyPipe, FormsModule, DatePipe, FaIconComponent, Button, Dialog, IconField, InputIcon, InputText, Message, Select, SelectButton, TableModule, Tag, Tooltip, PageHeader, PaymentCalendar],
  templateUrl: './admin-clients.html',
  styleUrl: './admin-clients.css',
})
export class AdminClients {
  private readonly auth = inject(AuthService);
  protected readonly store = inject(StoreService);
  private readonly toast = inject(MessageService);
  private readonly confirm = inject(ConfirmationService);
  protected readonly sev = statusSeverity;
  protected readonly cur = computed(() => this.auth.activeGym()?.currency ?? 'USD');
  protected readonly payments = viewChild(PaymentCalendar);
  protected visible = false;
  protected mode: 'existing' | 'new' = 'existing';
  protected readonly genders = [{ label: t('Male'), value: 'MALE' }, { label: t('Female'), value: 'FEMALE' }];
  protected readonly modes = [{ label: t('Existing member'), value: 'existing' }, { label: t('New member'), value: 'new' }];
  protected readonly filters = [{ label: t('All'), value: 'ALL' }, { label: t('Active'), value: 'ACTIVE' }, { label: t('Expired'), value: 'EXPIRED' }, { label: t('Cancelled'), value: 'CANCELLED' }];
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
        planName: this.store.plan(m.planId)?.name ?? t('Deleted plan'),
        promo: this.store.promo(m.promoCodeId)?.code,
        endDate: m.endDate,
      })));
  protected readonly limitReached = computed(() => {
    const max = this.store.saasPlan(this.auth.activeGym()?.saasPlanId)?.maxClients ?? -1;
    return max !== -1 && this.store.clientsOfGym(this.gymId()).length >= max;
  });

  planPrice() { return this.store.plan(this.form.planId)?.price ?? 0; }
  planCur() { return this.store.planCurrency(this.store.plan(this.form.planId)); }

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
      if (!firstName || !lastName || !email) return this.err(t('Fill in the new member details.'));
      if (this.store.users().some((u) => u.email.toLowerCase() === email.toLowerCase())) return this.err(t('Email already registered — use "Existing member".'));
      clientId = this.store.addUser({ role: 'CLIENT', firstName, lastName, email, password: 'welcome', ...(this.form.gender ? { gender: this.form.gender } : {}) }).id;
      created = true;
    }
    if (!clientId) return this.err(t('Choose a client.'));
    if (this.form.promo && !this.store.checkPromo(this.gymId(), this.form.planId, this.form.promo).ok) return this.err(t('Promo code is not valid.'));
    this.store.subscribeClient({ gymId: this.gymId(), clientId, planId: this.form.planId, coachId: this.form.coachId, promoCode: this.form.promo || undefined });
    this.visible = false;
    this.toast.add({ severity: 'success', summary: t('Subscription created'), detail: this.store.fullName(clientId) });
    if (created) {
      this.toast.add({
        severity: 'info', sticky: true, summary: t('Member account created'),
        detail: t('Give the member their login: {0} / temporary password "welcome".', { 0: this.form.email }),
      });
    }
  }

  private err(detail: string) { this.toast.add({ severity: 'error', summary: t('Cannot subscribe'), detail }); }

  setCoach(m: ClientMembership, coachId: string | null) {
    this.store.updateMembership({ ...m, coachId: coachId ?? undefined });
    this.toast.add({ severity: 'success', summary: t('Coach updated'), life: 1500 });
  }

  renew(m: ClientMembership) {
    const plan = this.store.plan(m.planId);
    if (!plan) return this.err(t('The plan no longer exists.'));
    this.confirm.confirm({
      header: t('Renew membership'), message: t('Renew {0} for {1} ({2})?', { 0: plan.name, 1: this.store.fullName(m.clientId), 2: formatMoney(plan.price, this.store.planCurrency(plan)) }),
      accept: () => {
        if (m.status === 'ACTIVE') this.store.updateMembership({ ...m, status: 'EXPIRED' });
        this.store.subscribeClient({ gymId: m.gymId, clientId: m.clientId, planId: m.planId, coachId: m.coachId });
        this.toast.add({ severity: 'success', summary: t('Membership renewed') });
      },
    });
  }

  cancel(m: ClientMembership) {
    this.confirm.confirm({
      header: t('Cancel membership'), message: t('Cancel {0}\'s membership?', { 0: this.store.fullName(m.clientId) }), acceptButtonStyleClass: 'p-button-danger',
      accept: () => { this.store.updateMembership({ ...m, status: 'CANCELLED' }); this.toast.add({ severity: 'warn', summary: t('Membership cancelled') }); },
    });
  }
}
