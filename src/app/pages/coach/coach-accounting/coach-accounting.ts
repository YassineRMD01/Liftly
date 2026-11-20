import { Component, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MessageService } from 'primeng/api';
import { FaIconComponent } from '@fortawesome/angular-fontawesome';
import { ButtonDirective } from 'primeng/button';
import { InputText } from 'primeng/inputtext';
import { SelectButton } from 'primeng/selectbutton';
import { Tag } from 'primeng/tag';
import { Tooltip } from 'primeng/tooltip';
import { AuthService } from '../../../core/auth.service';
import { MoneyPipe, formatTotals } from '../../../core/currency';
import { TranslatePipe, t } from '../../../core/i18n/i18n';
import { BankDetails, PayoutMethod, PrivateSession } from '../../../core/models';
import { isoDate } from '../../../core/schedule';
import { StoreService } from '../../../core/store.service';
import { AccountingView } from '../../../shared/accounting-view/accounting-view';
import { PageHeader } from '../../../shared/page-header/page-header';

/** Coach money: pay owed by each gym, private lessons to collect (cash / transfer), bank details and own books. */
@Component({
  selector: 'app-coach-accounting',
  imports: [TranslatePipe, DatePipe, MoneyPipe, FormsModule, FaIconComponent, ButtonDirective, InputText, SelectButton, Tag, Tooltip, AccountingView, PageHeader],
  templateUrl: './coach-accounting.html',
  styleUrl: './coach-accounting.css',
})
export class CoachAccounting {
  private readonly auth = inject(AuthService);
  protected readonly store = inject(StoreService);
  private readonly toast = inject(MessageService);
  protected readonly me = computed(() => this.auth.user()?.id ?? '');
  protected readonly profile = computed(() => this.store.coachProfile(this.me()));
  protected readonly cur = computed(() => this.profile()?.currency ?? 'USD');
  protected readonly tab = signal<'overview' | 'books'>('overview');
  protected readonly tabs = [{ label: t('Overview'), value: 'overview' }, { label: t('My books'), value: 'books' }];
  protected readonly month = isoDate().slice(0, 7);

  protected readonly gyms = computed(() => this.store.gymsOfCoach(this.me()).map((g) => ({
    gym: g, month: this.store.coachStatement(g.id, this.me(), this.month), total: this.store.coachStatement(g.id, this.me()),
  })));
  protected readonly owedTotal = computed(() => formatTotals(this.gyms().filter((x) => x.total.due > 0).map((x) => ({ amount: x.total.due, currency: x.total.currency })), this.cur()));
  /** Lessons given (or confirmed and past) that the member has not paid yet. */
  protected readonly toCollect = computed(() => this.store.sessions()
    .filter((s) => s.coachId === this.me() && !s.paid && (s.status === 'DONE' || (s.status === 'CONFIRMED' && s.date < isoDate())))
    .sort((a, b) => a.date.localeCompare(b.date)));
  protected readonly toCollectTotal = computed(() => formatTotals(this.toCollect().map((s) => ({ amount: s.price, currency: s.currency })), this.cur()));
  protected readonly recentPaid = computed(() => this.store.sessions().filter((s) => s.coachId === this.me() && s.paid).sort((a, b) => b.paid!.at.localeCompare(a.paid!.at)).slice(0, 6));
  protected readonly payouts = computed(() => this.store.payoutsOf({ coachId: this.me() }).slice(0, 8));
  protected readonly lines = computed(() => this.store.coachLedger(this.me()));

  // ---------- collect a lesson ----------
  protected readonly refFor = signal<string | null>(null);
  protected ref = '';
  paid(s: PrivateSession, method: PayoutMethod) {
    if (method === 'TRANSFER' && this.refFor() !== s.id) { this.refFor.set(s.id); this.ref = ''; return; }
    this.store.markSessionPaid(s.id, method, method === 'TRANSFER' ? this.ref.trim() || undefined : undefined);
    this.refFor.set(null);
    this.toast.add({ severity: 'success', summary: t('Marked as paid'), detail: `${this.store.fullName(s.clientId)} · ${t(method === 'CASH' ? 'Cash' : 'Bank transfer')}`, life: 1800 });
  }
  undo(s: PrivateSession) { this.store.markSessionUnpaid(s.id); }

  // ---------- how I get paid ----------
  protected readonly methods: { label: string; value: PayoutMethod }[] = [{ label: t('Cash'), value: 'CASH' }, { label: t('Bank transfer'), value: 'TRANSFER' }];
  protected payoutMethod: PayoutMethod = this.profile()?.payoutMethod ?? 'CASH';
  protected bank: BankDetails = { holder: '', bankName: '', iban: '', swift: '', ...(this.profile()?.bank ?? {}) };
  ibanOk() { const v = this.bank.iban.replace(/\s+/g, '').toUpperCase(); return /^[A-Z]{2}\d{2}[A-Z0-9]{10,30}$/.test(v); }
  saveBank() {
    if (this.payoutMethod === 'TRANSFER') {
      if (!this.bank.holder.trim() || !this.bank.bankName.trim() || !this.ibanOk()) { this.toast.add({ severity: 'error', summary: t('Enter the account holder, the bank and a valid IBAN.') }); return; }
      const bank = { holder: this.bank.holder.trim(), bankName: this.bank.bankName.trim(), iban: this.bank.iban.replace(/\s+/g, '').toUpperCase(), ...(this.bank.swift?.trim() ? { swift: this.bank.swift.trim().toUpperCase() } : {}) };
      this.store.saveCoachBank(this.me(), 'TRANSFER', bank);
    } else {
      this.store.saveCoachBank(this.me(), 'CASH', this.profile()?.bank);
    }
    this.toast.add({ severity: 'success', summary: t('Payment details saved'), detail: t('Your gyms see them when they pay you.') });
  }
}
