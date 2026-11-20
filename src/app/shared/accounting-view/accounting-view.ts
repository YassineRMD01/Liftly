import { Component, computed, inject, input, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ConfirmationService, MessageService } from 'primeng/api';
import { FaIconComponent } from '@fortawesome/angular-fontawesome';
import { ButtonDirective } from 'primeng/button';
import { Dialog } from 'primeng/dialog';
import { IconField } from 'primeng/iconfield';
import { InputIcon } from 'primeng/inputicon';
import { InputNumber } from 'primeng/inputnumber';
import { InputText } from 'primeng/inputtext';
import { Select } from 'primeng/select';
import { SelectButton } from 'primeng/selectbutton';
import { Tag } from 'primeng/tag';
import { Tooltip } from 'primeng/tooltip';
import { downloadCsv } from '../../core/csv';
import { MoneyPipe, formatMoney } from '../../core/currency';
import { CURRENT_LANGUAGE, TranslatePipe, t } from '../../core/i18n/i18n';
import { Expense, ExpenseCategory, ExpenseOwner, PaymentMethod } from '../../core/models';
import { isoDate } from '../../core/schedule';
import { LedgerLine, StoreService } from '../../core/store.service';
import { ChartCard, ChartSeries } from '../chart-card/chart-card';
import { StatCard } from '../stat-card/stat-card';

/** English labels (translated with t()) of journal categories and payment methods. */
export const LEDGER_CATEGORY: Record<string, string> = {
  MEMBERSHIPS: 'Memberships', SUBSCRIPTIONS: 'Subscriptions', COACHES: 'Coach pay', GYM_PAY: 'Gym pay', PRIVATE: 'Private sessions',
  RENT: 'Rent', SALARIES: 'Salaries', EQUIPMENT: 'Equipment', UTILITIES: 'Utilities', MARKETING: 'Marketing', MAINTENANCE: 'Maintenance',
  SOFTWARE: 'Software', HOSTING: 'Hosting', TAXES: 'Taxes', TRAVEL: 'Travel', FEES: 'Fees', OTHER: 'Other',
};
export const METHOD_LABEL: Record<string, string> = { CASH: 'Cash', CARD: 'Card', TRANSFER: 'Bank transfer' };

/**
 * Accounting for one ledger (platform, gym or coach): totals, monthly chart, expenses by category,
 * the journal with search / filters / CSV, and recording expenses. Lines come already converted to `currency`.
 */
@Component({
  selector: 'app-accounting-view',
  imports: [TranslatePipe, DatePipe, MoneyPipe, FormsModule, FaIconComponent, ButtonDirective, Dialog, IconField, InputIcon, InputNumber, InputText, Select, SelectButton, Tag, Tooltip, ChartCard, StatCard],
  templateUrl: './accounting-view.html',
  styleUrl: './accounting-view.css',
})
export class AccountingView {
  private readonly store = inject(StoreService);
  private readonly toast = inject(MessageService);
  private readonly confirm = inject(ConfirmationService);

  readonly lines = input.required<LedgerLine[]>();
  readonly currency = input.required<string>();
  readonly owner = input.required<ExpenseOwner>();
  readonly ownerId = input<string>();
  /** Expense categories offered in the dialog. */
  readonly categories = input<ExpenseCategory[]>(['RENT', 'SALARIES', 'EQUIPMENT', 'UTILITIES', 'MARKETING', 'MAINTENANCE', 'SOFTWARE', 'TAXES', 'FEES', 'OTHER']);
  readonly showVat = input(true);
  readonly fileName = input('accounting');

  protected readonly cat = LEDGER_CATEGORY;
  protected readonly methodLabel = METHOD_LABEL;
  protected readonly year = signal(new Date().getFullYear());
  /** 0 = whole year, 1..12 = one month */
  protected readonly month = signal(0);
  protected readonly type = signal<'ALL' | 'INCOME' | 'EXPENSE'>('ALL');
  protected readonly q = signal('');
  protected readonly types = [{ label: t('All'), value: 'ALL' }, { label: t('Income'), value: 'INCOME' }, { label: t('Expenses'), value: 'EXPENSE' }];
  protected readonly limit = signal(25);

  protected readonly years = computed(() => {
    const ys = new Set([new Date().getFullYear(), ...this.lines().map((l) => +l.date.slice(0, 4))]);
    return [...ys].sort((a, b) => b - a).map((y) => ({ label: String(y), value: y }));
  });
  private readonly monthNames = Array.from({ length: 12 }, (_, m) => new Intl.DateTimeFormat(CURRENT_LANGUAGE.locale, { month: 'short' }).format(new Date(2024, m, 1)));
  protected readonly months = computed(() => [{ label: t('Whole year'), value: 0 }, ...this.monthNames.map((label, i) => ({ label, value: i + 1 }))]);

  /** Lines of the selected year / month. */
  protected readonly period = computed(() => {
    const y = String(this.year()), m = this.month();
    return this.lines().filter((l) => l.date.startsWith(y) && (!m || +l.date.slice(5, 7) === m));
  });
  protected readonly income = computed(() => this.sum(this.period().filter((l) => l.type === 'INCOME')));
  protected readonly spent = computed(() => this.sum(this.period().filter((l) => l.type === 'EXPENSE')));
  protected readonly net = computed(() => this.income() - this.spent());
  /** VAT collected on income minus VAT paid on expenses (positive = to pay). */
  protected readonly vatDue = computed(() => this.period().reduce((s, l) => s + (l.type === 'INCOME' ? l.vat : -l.vat), 0));
  protected readonly vatCollected = computed(() => this.period().filter((l) => l.type === 'INCOME').reduce((s, l) => s + l.vat, 0));

  protected readonly money = (v: number) => formatMoney(v, this.currency(), 0);
  fmt(v: number) { return formatMoney(v, this.currency()); }

  protected readonly monthly = computed<ChartSeries[]>(() => {
    const y = String(this.year());
    const inc = Array(12).fill(0), exp = Array(12).fill(0);
    for (const l of this.lines()) {
      if (!l.date.startsWith(y)) continue;
      (l.type === 'INCOME' ? inc : exp)[+l.date.slice(5, 7) - 1] += l.amount;
    }
    return [{ label: t('Income'), data: inc.map((v) => Math.round(v)) }, { label: t('Expenses'), data: exp.map((v) => Math.round(v)) }];
  });
  protected readonly monthLabels = this.monthNames;
  private breakdown(type: LedgerLine['type'], key: (l: LedgerLine) => string, labels: Record<string, string>) {
    const map = new Map<string, number>();
    for (const l of this.period()) if (l.type === type) map.set(key(l), (map.get(key(l)) ?? 0) + l.amount);
    const rows = [...map.entries()].sort((a, b) => b[1] - a[1]);
    return { labels: rows.map(([k]) => t(labels[k] ?? k)), series: [{ label: t('Amount'), data: rows.map(([, v]) => Math.round(v)) }] as ChartSeries[] };
  }
  protected readonly byCategory = computed(() => this.breakdown('EXPENSE', (l) => l.category, LEDGER_CATEGORY));
  protected readonly byMethod = computed(() => this.breakdown('INCOME', (l) => l.method ?? 'OTHER', { ...METHOD_LABEL, OTHER: 'Other' }));

  protected readonly journal = computed(() => {
    const q = this.q().trim().toLowerCase();
    return this.period().filter((l) => (this.type() === 'ALL' || l.type === this.type()) &&
      (!q || `${l.label} ${l.counterparty ?? ''} ${l.reference ?? ''} ${t(LEDGER_CATEGORY[l.category] ?? l.category)}`.toLowerCase().includes(q)));
  });
  protected readonly shown = computed(() => this.journal().slice(0, this.limit()));

  private sum(list: LedgerLine[]) { return list.reduce((s, l) => s + l.amount, 0); }

  exportCsv() {
    downloadCsv(`${this.fileName()}-${this.year()}${this.month() ? '-' + String(this.month()).padStart(2, '0') : ''}`,
      ['Date', 'Type', 'Category', 'Description', 'Counterparty', 'Method', 'Reference', `Amount (${this.currency()})`, `VAT (${this.currency()})`, 'Original amount', 'Original currency'],
      this.journal().map((l) => [l.date, l.type, LEDGER_CATEGORY[l.category] ?? l.category, l.label, l.counterparty, l.method ? METHOD_LABEL[l.method] ?? l.method : '', l.reference,
        (l.type === 'EXPENSE' ? -1 : 1) * Math.round(l.amount * 100) / 100, Math.round(l.vat * 100) / 100, l.original?.amount, l.original?.currency]));
  }

  // ---------- expense dialog ----------
  protected readonly editing = signal<Expense | null>(null);
  protected readonly methods: { label: string; value: PaymentMethod }[] = [{ label: t('Cash'), value: 'CASH' }, { label: t('Card'), value: 'CARD' }, { label: t('Bank transfer'), value: 'TRANSFER' }];
  protected readonly categoryOptions = computed(() => this.categories().map((c) => ({ value: c, label: t(LEDGER_CATEGORY[c]) })));
  protected readonly currencies = computed(() => this.store.currencyOptions());

  newExpense() {
    this.editing.set({ id: '', owner: this.owner(), ...(this.ownerId() ? { ownerId: this.ownerId() } : {}), date: isoDate(), category: this.categories()[0], label: '', amount: 0, currency: this.currency(), method: 'TRANSFER', vatRate: 0 });
  }
  edit(l: LedgerLine) {
    const e = this.store.expenses().find((x) => x.id === l.expenseId);
    if (e) this.editing.set({ ...e });
  }
  close(v: boolean) { if (!v) this.editing.set(null); }
  save() {
    const e = this.editing();
    if (!e) return;
    if (!e.label.trim() || !(e.amount > 0) || !e.date) { this.toast.add({ severity: 'error', summary: t('Enter a description, a date and an amount.') }); return; }
    this.store.saveExpense({ ...e, label: e.label.trim() });
    this.toast.add({ severity: 'success', summary: t('Expense saved'), detail: `${e.label} · ${formatMoney(e.amount, e.currency)}`, life: 2000 });
    this.editing.set(null);
  }
  remove(l: LedgerLine) {
    this.confirm.confirm({
      header: t('Delete expense'), message: t('Delete "{0}"?', { 0: l.label }), acceptButtonStyleClass: 'p-button-danger',
      accept: () => this.store.deleteExpense(l.expenseId!),
    });
  }
  sourceIcon(l: LedgerLine) {
    return ({ PAYMENT: 'money-bill', EXPENSE: 'receipt', PAYOUT: 'hand-holding-dollar', INVOICE: 'file-invoice', SESSION: 'handshake' } as const)[l.source];
  }
}
