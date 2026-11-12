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
import { InputNumber } from 'primeng/inputnumber';
import { downloadCsv } from '../../../core/csv';
import { isoDate } from '../../../core/schedule';
import { AuthService } from '../../../core/auth.service';
import { ClientMembership, ClientStatus, Gender } from '../../../core/models';
import { Textarea } from 'primeng/textarea';
import { PromoCheck, StoreService } from '../../../core/store.service';
import { PageHeader } from '../../../shared/page-header/page-header';
import { MoneyPipe } from '../../../core/currency';
import { PaymentCalendar } from '../../../shared/payment-calendar/payment-calendar';
import { statusSeverity } from '../../super-admin/sa-gyms/sa-gyms';
import { InviteDialog } from '../../../shared/invite-dialog/invite-dialog';

@Component({
  selector: 'app-admin-clients',
  imports: [TranslatePipe, MoneyPipe, FormsModule, DatePipe, FaIconComponent, Button, Dialog, IconField, InputIcon, InputText, Message, Select, SelectButton, TableModule, Tag, Textarea, Tooltip, InputNumber, PageHeader, PaymentCalendar, InviteDialog],
  templateUrl: './admin-clients.html',
  styleUrl: './admin-clients.css',
})
export class AdminClients {
  private readonly auth = inject(AuthService);
  protected readonly store = inject(StoreService);
  private readonly toast = inject(MessageService);
  private readonly confirm = inject(ConfirmationService);
  protected readonly sev = statusSeverity;
  /** Front-desk staff see members read-only. */
  protected readonly isAdmin = computed(() => this.auth.role() === 'ADMIN');
  protected readonly cur = computed(() => this.auth.activeGym()?.currency ?? 'USD');
  protected readonly payments = viewChild(PaymentCalendar);
  protected readonly invite = viewChild.required(InviteDialog);
  protected visible = false;
  protected mode: 'existing' | 'new' = 'existing';
  protected readonly genders = [{ label: t('Male'), value: 'MALE' }, { label: t('Female'), value: 'FEMALE' }];
  protected readonly modes = [{ label: t('Existing member'), value: 'existing' }, { label: t('New member'), value: 'new' }];
  /** Filter by the client's status at this gym. */
  protected readonly filters = [{ label: t('All'), value: 'ALL' }, { label: t('Active'), value: 'ACTIVE' }, { label: t('Frozen'), value: 'FROZEN' }, { label: t('Expired'), value: 'EXPIRED' }, { label: t('Banned'), value: 'BANNED' }];
  protected readonly status = signal('ALL');
  protected readonly promoResult = signal<PromoCheck | null>(null);
  protected form = { clientId: '', firstName: '', lastName: '', email: '', planId: '', coachId: undefined as string | undefined, promo: '', gender: null as Gender | null };

  private readonly gymId = computed(() => this.auth.activeGym()?.id ?? '');
  protected readonly plans = computed(() => this.store.plansOfGym(this.gymId()).filter((p) => p.active));
  protected readonly coaches = computed(() => this.store.coachesOfGym(this.gymId()).map((c) => ({ id: c.id, label: `${c.firstName} ${c.lastName}` })));
  protected readonly allClients = computed(() => this.store.clients().map((c) => ({
    id: c.id,
    label: `${c.firstName} ${c.lastName} · ${c.email}${this.store.isBanned(this.gymId(), c.id) ? ' · ' + t('Banned') : ''}`,
  })));
  protected readonly rows = computed(() =>
    this.store.membershipsOfGym(this.gymId())
      .map((m) => ({ m, clientStatus: this.store.clientStatus(m.gymId, m.clientId) }))
      .filter((x) => this.status() === 'ALL' || x.clientStatus === this.status())
      .map(({ m, clientStatus }) => ({
        m,
        clientStatus,
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

  /** Existing client picked in the add dialog is banned from this gym. */
  pickedBanned() { return this.mode === 'existing' && !!this.form.clientId && this.store.isBanned(this.gymId(), this.form.clientId); }

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
      clientId = this.store.addUser({ role: 'CLIENT', firstName, lastName, email, ...(this.form.gender ? { gender: this.form.gender } : {}) }).id;
      created = true;
    }
    if (!clientId) return this.err(t('Choose a client.'));
    if (this.store.isBanned(this.gymId(), clientId)) return this.err(t('This client is banned from your gym. Unban them first.'));
    if (this.form.promo && !this.store.checkPromo(this.gymId(), this.form.planId, this.form.promo).ok) return this.err(t('Promo code is not valid.'));
    this.store.subscribeClient({ gymId: this.gymId(), clientId, planId: this.form.planId, coachId: this.form.coachId, promoCode: this.form.promo || undefined });
    this.visible = false;
    this.toast.add({ severity: 'success', summary: t('Subscription created'), detail: this.store.fullName(clientId) });
    if (created) this.invite().open(this.store.user(clientId)!);
  }

  private err(detail: string) { this.toast.add({ severity: 'error', summary: t('Cannot subscribe'), detail }); }

  setCoach(m: ClientMembership, coachId: string | null) {
    this.store.updateMembership({ ...m, coachId: coachId ?? undefined });
    this.toast.add({ severity: 'success', summary: t('Coach updated'), life: 1500 });
  }

  // ---------- renew (optionally on another plan) ----------
  /** Membership being renewed; a signal because the dialog opens from a table row (zoneless). */
  protected readonly renewing = signal<ClientMembership | null>(null);
  protected renewForm = { planId: '', coachId: undefined as string | undefined, promo: '', start: 'today' as 'today' | 'after' };
  protected readonly renewPromo = signal<PromoCheck | null>(null);
  protected readonly startOptions = [{ label: t('Start today'), value: 'today' }, { label: t('When the current period ends'), value: 'after' }];

  /** The current membership still runs (so the renewal can be queued after it). */
  stillRunning(m: ClientMembership | null) { return !!m && m.status === 'ACTIVE' && m.endDate > new Date().toISOString(); }
  renewPlan() { return this.store.plan(this.renewForm.planId); }
  renewPrice() { return this.renewPromo()?.ok ? this.renewPromo()!.finalPrice : this.renewPlan()?.price ?? 0; }
  renewStartDate() {
    const m = this.renewing();
    return this.renewForm.start === 'after' && this.stillRunning(m) ? new Date(m!.endDate) : new Date();
  }
  renewEndDate() { return new Date(this.renewStartDate().getTime() + (this.renewPlan()?.durationDays ?? 0) * 86400000); }

  renew(m: ClientMembership) {
    if (this.store.isBanned(m.gymId, m.clientId)) return this.err(t('This client is banned from your gym. Unban them first.'));
    const current = this.store.plan(m.planId);
    this.renewForm = {
      planId: current?.active ? current.id : this.plans()[0]?.id ?? '',
      coachId: m.coachId,
      promo: '',
      start: this.stillRunning(m) ? 'after' : 'today',
    };
    this.renewPromo.set(null);
    this.renewing.set(m);
  }

  closeRenew(visible: boolean) { if (!visible) this.renewing.set(null); }
  applyRenewPromo() { this.renewPromo.set(this.store.checkPromo(this.gymId(), this.renewForm.planId, this.renewForm.promo)); }

  confirmRenew() {
    const m = this.renewing();
    const plan = this.renewPlan();
    if (!m || !plan) return;
    if (this.renewForm.promo && !this.store.checkPromo(this.gymId(), plan.id, this.renewForm.promo).ok) return this.err(t('Promo code is not valid.'));
    if (this.renewForm.start === 'today' && m.status === 'ACTIVE') this.store.updateMembership({ ...m, status: 'EXPIRED' });
    this.store.subscribeClient({
      gymId: m.gymId, clientId: m.clientId, planId: plan.id, coachId: this.renewForm.coachId,
      promoCode: this.renewForm.promo || undefined, start: this.renewStartDate(),
    });
    const changed = plan.id !== m.planId;
    this.toast.add({
      severity: 'success', summary: t('Membership renewed'),
      detail: changed ? t('{0} now on {1}.', { 0: this.store.fullName(m.clientId), 1: plan.name }) : this.store.fullName(m.clientId),
    });
    this.renewing.set(null);
  }

  // ---------- ban ----------
  protected readonly banning = signal<string | null>(null);
  protected banReason = '';
  ban(clientId: string) {
    this.banReason = '';
    this.banning.set(clientId);
  }
  closeBan(visible: boolean) { if (!visible) this.banning.set(null); }
  confirmBan() {
    const id = this.banning();
    if (!id || !this.banReason.trim()) return;
    this.store.banClient(this.gymId(), id, this.banReason.trim());
    this.toast.add({ severity: 'warn', summary: t('Client banned'), detail: this.store.fullName(id) });
    this.banning.set(null);
  }
  unban(clientId: string) {
    this.confirm.confirm({
      header: t('Unban client'), message: t('Allow {0} back in your gym? You can then register a new membership.', { 0: this.store.fullName(clientId) }),
      accept: () => {
        this.store.unbanClient(this.gymId(), clientId);
        this.toast.add({ severity: 'success', summary: t('Client unbanned'), detail: this.store.fullName(clientId) });
      },
    });
  }
  banInfo(clientId: string) { return this.store.ban(this.gymId(), clientId); }
  clientSev(s: ClientStatus) { return ({ ACTIVE: 'success', FROZEN: 'info', EXPIRED: 'secondary', BANNED: 'danger' } as const)[s]; }

  // ---------- freeze ----------
  protected readonly freezing = signal<ClientMembership | null>(null);
  protected freezeForm = { start: isoDate(), days: 14, reason: '' };
  freeze(m: ClientMembership) { this.freezeForm = { start: isoDate(), days: 14, reason: '' }; this.freezing.set(m); }
  closeFreeze(visible: boolean) { if (!visible) this.freezing.set(null); }
  confirmFreeze() {
    const m = this.freezing();
    if (!m || !(this.freezeForm.days > 0) || !this.freezeForm.start) return;
    this.store.freezeMembership(m.id, this.freezeForm.start, this.freezeForm.days, this.freezeForm.reason.trim());
    this.toast.add({ severity: 'info', summary: t('Membership frozen'), detail: t('{0}: end date moved back {1} days.', { 0: this.store.fullName(m.clientId), 1: this.freezeForm.days }) });
    this.freezing.set(null);
  }
  /** A freeze is running now or planned. */
  hasFreeze(m: ClientMembership) { return (m.freezes ?? []).some((f) => f.end >= isoDate()); }
  unfreeze(m: ClientMembership) {
    this.store.unfreezeMembership(m.id);
    this.toast.add({ severity: 'success', summary: t('Membership unfrozen'), detail: this.store.fullName(m.clientId) });
  }

  cancel(m: ClientMembership) {
    this.confirm.confirm({
      header: t('Cancel membership'), message: t('Cancel {0}\'s membership?', { 0: this.store.fullName(m.clientId) }), acceptButtonStyleClass: 'p-button-danger',
      accept: () => { this.store.updateMembership({ ...m, status: 'CANCELLED' }); this.toast.add({ severity: 'warn', summary: t('Membership cancelled') }); },
    });
  }

  exportCsv() {
    downloadCsv(`clients-${this.auth.activeGym()?.name ?? ''}`, ['Client', 'Email', 'Phone', 'Plan', 'Coach', 'Paid', 'Currency', 'Start', 'End', 'Membership', 'Client status', 'Referral code'],
      this.rows().map((r) => [r.clientName, r.email, this.store.user(r.m.clientId)?.phone, r.planName, r.m.coachId ? this.store.fullName(r.m.coachId) : '', r.m.pricePaid, this.store.membershipCurrency(r.m),
        r.m.startDate.slice(0, 10), r.m.endDate.slice(0, 10), r.m.status, r.clientStatus, this.store.refCode(r.m.clientId)]));
  }
}
