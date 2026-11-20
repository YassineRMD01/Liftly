import { UndoService } from '../../../core/undo.service';
import { Component, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ConfirmationService, MessageService } from 'primeng/api';
import { FaIconComponent } from '@fortawesome/angular-fontawesome';
import { ButtonDirective } from 'primeng/button';
import { Modal } from '../../../shared/modal/modal';
import { InputNumber } from 'primeng/inputnumber';
import { InputText } from 'primeng/inputtext';
import { SelectButton } from 'primeng/selectbutton';
import { Tag } from 'primeng/tag';
import { Tooltip } from 'primeng/tooltip';
import { AuthService } from '../../../core/auth.service';
import { MoneyPipe, formatMoney } from '../../../core/currency';
import { TranslatePipe, t } from '../../../core/i18n/i18n';
import { CoachPayout, PayoutMethod, User } from '../../../core/models';
import { isoDate } from '../../../core/schedule';
import { StoreService } from '../../../core/store.service';
import { AccountingView } from '../../../shared/accounting-view/accounting-view';
import { PageHeader } from '../../../shared/page-header/page-header';

/** Gym accounting: the books (payments, expenses, coach pay, Liftly invoices, VAT) and paying coaches. */
@Component({
  selector: 'app-admin-accounting',
  imports: [TranslatePipe, DatePipe, MoneyPipe, FormsModule, FaIconComponent, ButtonDirective, Modal, InputNumber, InputText, SelectButton, Tag, Tooltip, AccountingView, PageHeader],
  templateUrl: './admin-accounting.html',
  styleUrl: './admin-accounting.css',
})
export class AdminAccounting {
  private readonly undo = inject(UndoService);
  private readonly auth = inject(AuthService);
  protected readonly store = inject(StoreService);
  private readonly toast = inject(MessageService);
  private readonly confirm = inject(ConfirmationService);
  protected readonly gym = this.auth.activeGym;
  protected readonly tab = signal<'books' | 'coaches'>('books');
  protected readonly tabs = [{ label: t('Books'), value: 'books' }, { label: t('Coach pay'), value: 'coaches' }];
  /** Accounting currency: from the admin's country. Coach pay stays in the gym currency (it is what is paid). */
  protected readonly accCur = computed(() => this.store.accountingCurrency(this.auth.user()?.id));
  protected readonly lines = computed(() => this.store.gymLedger(this.gym()?.id ?? '', this.accCur()));
  protected readonly cur = computed(() => this.gym()?.currency ?? 'USD');
  protected readonly month = signal(isoDate().slice(0, 7));

  protected readonly coaches = computed(() => {
    const g = this.gym();
    if (!g) return [];
    return this.store.coachesOfGym(g.id).map((c) => ({
      coach: c, profile: this.store.coachProfile(c.id), link: this.store.gymCoachLink(g.id, c.id),
      monthStatement: this.store.coachStatement(g.id, c.id, this.month()), total: this.store.coachStatement(g.id, c.id),
    }));
  });
  protected readonly totalDue = computed(() => this.coaches().reduce((s, c) => s + Math.max(0, c.total.due), 0));
  protected readonly payouts = computed(() => this.store.payoutsOf({ gymId: this.gym()?.id }).slice(0, 30));

  setRate(coach: User, rate: number | null) {
    if (rate == null || rate < 0) return;
    this.store.setClassRate(this.gym()!.id, coach.id, rate);
    this.toast.add({ severity: 'success', summary: t('Rate saved'), detail: `${coach.firstName} · ${formatMoney(rate, this.cur())}`, life: 1500 });
  }
  shiftMonth(delta: number) {
    const [y, m] = this.month().split('-').map(Number);
    const d = new Date(y, m - 1 + delta, 1);
    this.month.set(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  }
  monthLabel() { const [y, m] = this.month().split('-').map(Number); return new Date(y, m - 1, 1); }

  // ---------- pay dialog ----------
  protected readonly paying = signal<CoachPayout | null>(null);
  protected readonly methods: { label: string; value: PayoutMethod }[] = [{ label: t('Cash'), value: 'CASH' }, { label: t('Bank transfer'), value: 'TRANSFER' }];
  pay(coach: User) {
    const g = this.gym()!;
    const due = Math.max(0, this.store.coachStatement(g.id, coach.id).due);
    this.paying.set({ id: '', gymId: g.id, coachId: coach.id, date: isoDate(), amount: due, currency: g.currency, method: this.store.coachProfile(coach.id)?.payoutMethod ?? 'CASH', period: this.month(), reference: '', note: '' });
  }
  close(v: boolean) { if (!v) this.paying.set(null); }
  bankOf(coachId: string) { return this.store.coachProfile(coachId)?.bank; }
  confirmPay() {
    const p = this.paying();
    if (!p || !(p.amount > 0)) { this.toast.add({ severity: 'error', summary: t('Enter an amount.') }); return; }
    if (p.method === 'TRANSFER' && !p.reference?.trim()) { this.toast.add({ severity: 'warn', summary: t('Add the transfer reference so the coach can match it.') }); return; }
    this.store.saveCoachPayout({ ...p, reference: p.reference?.trim() || undefined, note: p.note?.trim() || undefined });
    this.toast.add({ severity: 'success', summary: t('Coach paid'), detail: `${this.store.fullName(p.coachId)} · ${formatMoney(p.amount, p.currency)}` });
    this.paying.set(null);
  }
  removePayout(p: CoachPayout) {
    this.undo.run(t('Payment deleted'), ['coachPayouts'], () => this.store.deleteCoachPayout(p.id), formatMoney(p.amount, p.currency));
  }
}
