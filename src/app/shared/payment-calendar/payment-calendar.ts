import { Component, computed, inject, signal } from '@angular/core';
import { DatePipe, NgClass } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ConfirmationService, MessageService } from 'primeng/api';
import { FaIconComponent } from '@fortawesome/angular-fontawesome';
import { Button } from 'primeng/button';
import { Dialog } from 'primeng/dialog';
import { InputNumber } from 'primeng/inputnumber';
import { InputText } from 'primeng/inputtext';
import { SelectButton } from 'primeng/selectbutton';
import { Tooltip } from 'primeng/tooltip';
import { Payment, PaymentMethod } from '../../core/models';
import { isoDate } from '../../core/schedule';
import { formatMoney, MoneyPipe } from '../../core/currency';
import { StoreService } from '../../core/store.service';

interface CalendarDay {
  date: Date;
  key: string; // YYYY-MM-DD
  isToday: boolean;
  covered: boolean; // inside a membership period
  payment: Payment | null;
  tooltip: string;
}
interface CalendarMonth {
  label: string;
  value: number;
  status: 'present' | 'missing';
  paid: number;
  days: (CalendarDay | null)[];
}

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const WEEKDAYS = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];
const METHOD_LABEL: Record<PaymentMethod, string> = { CASH: 'Cash', CARD: 'Card', TRANSFER: 'Transfer' };

/**
 * Yearly payments calendar of one client at one gym.
 * Admin: click a day to add / edit / delete a payment. Client: read-only.
 * Open it with `open(gymId, clientId, readonly?)`.
 */
@Component({
  selector: 'app-payment-calendar',
  imports: [MoneyPipe, DatePipe, NgClass, FormsModule, FaIconComponent, Button, Dialog, InputNumber, InputText, SelectButton, Tooltip],
  templateUrl: './payment-calendar.html',
  styleUrl: './payment-calendar.css',
})
export class PaymentCalendar {
  private readonly store = inject(StoreService);
  private readonly toast = inject(MessageService);
  private readonly confirm = inject(ConfirmationService);

  protected readonly weekdays = WEEKDAYS;
  protected readonly methodLabel = METHOD_LABEL;
  protected readonly methods = (Object.keys(METHOD_LABEL) as PaymentMethod[]).map((value) => ({ value, label: METHOD_LABEL[value] }));

  /** Signals (not plain fields): open() may be called from another component's view, e.g. a table row, in a zoneless app. */
  protected readonly visible = signal(false);
  protected readonly editVisible = signal(false);
  private readonly gymId = signal('');
  private readonly clientId = signal('');
  protected readonly readonly = signal(false);
  protected readonly year = signal(new Date().getFullYear());
  protected readonly today = signal(new Date());

  // editor state
  protected readonly action = signal<'add' | 'edit' | 'view'>('add');
  protected readonly selectedDate = signal(new Date());
  private editing: Payment | null = null;
  protected amount = 0;
  protected method: PaymentMethod = 'CASH';
  protected note = '';
  protected touched = false;

  /** Currency of the gym this calendar belongs to. */
  protected readonly cur = computed(() => this.store.currencyOf(this.gymId()));
  protected readonly clientName = computed(() => this.store.fullName(this.clientId()));
  protected readonly gymName = computed(() => this.store.gym(this.gymId())?.name ?? '');
  private readonly payments = computed(() => this.store.paymentsOf(this.gymId(), this.clientId()));
  private readonly memberships = computed(() =>
    this.store.membershipsOfClient(this.clientId()).filter((m) => m.gymId === this.gymId() && m.status !== 'CANCELLED'));
  /** Current plan, used to suggest an amount. */
  protected readonly suggested = computed(() => {
    const m = [...this.memberships()].sort((a, b) => b.startDate.localeCompare(a.startDate))[0];
    return this.store.plan(m?.planId) ?? null;
  });

  private readonly paymentsByDay = computed(() => new Map(this.payments().map((p) => [p.date, p])));
  private readonly yearPayments = computed(() => this.payments().filter((p) => p.date.startsWith(String(this.year()))));
  protected readonly yearTotal = computed(() => this.yearPayments().reduce((s, p) => s + p.amount, 0));
  protected readonly yearCount = computed(() => this.yearPayments().length);
  protected readonly allTimeTotal = computed(() => this.payments().reduce((s, p) => s + p.amount, 0));
  protected readonly coveredMonths = computed(() => this.calendar().filter((m) => m.status === 'present').length);

  protected readonly calendar = computed<CalendarMonth[]>(() => {
    const y = this.year();
    const byDay = this.paymentsByDay();
    const todayKey = isoDate(this.today());
    const cur = this.cur();
    const periods = this.memberships().map((m) => [m.startDate.slice(0, 10), m.endDate.slice(0, 10)] as const);
    const isCovered = (key: string) => periods.some(([s, e]) => s <= key && key <= e);

    return MONTHS.map((label, value) => {
      const first = new Date(y, value, 1);
      const total = new Date(y, value + 1, 0).getDate();
      const days: (CalendarDay | null)[] = Array((first.getDay() + 6) % 7).fill(null); // Monday first
      let paid = 0;
      for (let d = 1; d <= total; d++) {
        const date = new Date(y, value, d);
        const key = isoDate(date);
        const payment = byDay.get(key) ?? null;
        if (payment) paid += payment.amount;
        days.push({
          date, key, payment,
          isToday: key === todayKey,
          covered: isCovered(key),
          tooltip: payment ? `💰 ${formatMoney(payment.amount, cur)} · ${METHOD_LABEL[payment.method]}${payment.note ? ' · ' + payment.note : ''}` : '',
        });
      }
      const mStart = isoDate(first);
      const mEnd = isoDate(new Date(y, value, total));
      const status = periods.some(([s, e]) => s <= mEnd && e >= mStart) ? 'present' : 'missing';
      return { label, value, status, paid, days };
    });
  });

  open(gymId: string, clientId: string, readonly = false) {
    this.gymId.set(gymId);
    this.clientId.set(clientId);
    this.readonly.set(readonly);
    this.goToToday();
    this.visible.set(true);
  }

  prevYear() { this.year.update((y) => y - 1); }
  nextYear() { this.year.update((y) => y + 1); }
  goToToday() {
    const now = new Date();
    this.today.set(now);
    this.year.set(now.getFullYear());
  }

  onDayClick(day: CalendarDay) {
    if (this.readonly() && !day.payment) return;
    this.editing = day.payment;
    this.selectedDate.set(day.date);
    this.action.set(this.readonly() ? 'view' : day.payment ? 'edit' : 'add');
    this.amount = day.payment?.amount ?? this.suggested()?.price ?? 0;
    this.method = day.payment?.method ?? 'CASH';
    this.note = day.payment?.note ?? '';
    this.touched = false;
    this.editVisible.set(true);
  }

  save() {
    this.touched = true;
    if (!(this.amount > 0)) return;
    this.store.savePayment({
      id: this.editing?.id ?? '',
      gymId: this.gymId(), clientId: this.clientId(),
      date: isoDate(this.selectedDate()),
      amount: Number(this.amount), method: this.method,
      ...(this.note.trim() ? { note: this.note.trim() } : {}),
    });
    this.editVisible.set(false);
    this.toast.add({ severity: 'success', summary: this.editing ? 'Payment updated' : 'Payment added', detail: `${formatMoney(this.amount, this.cur())} on ${isoDate(this.selectedDate())}` });
  }

  remove() {
    const p = this.editing;
    if (!p) return;
    this.confirm.confirm({
      header: 'Delete payment', message: `Delete the ${formatMoney(p.amount, this.cur())} payment of ${p.date}?`, acceptButtonStyleClass: 'p-button-danger',
      accept: () => {
        this.store.deletePayment(p.id);
        this.editVisible.set(false);
        this.toast.add({ severity: 'info', summary: 'Payment deleted' });
      },
    });
  }
}
