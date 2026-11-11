import { Component, computed, inject, signal } from '@angular/core';
import { CurrencyPipe, DatePipe, NgClass } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ConfirmationService, MessageService } from 'primeng/api';
import { FaIconComponent } from '@fortawesome/angular-fontawesome';
import { Button } from 'primeng/button';
import { Dialog } from 'primeng/dialog';
import { InputNumber } from 'primeng/inputnumber';
import { InputText } from 'primeng/inputtext';
import { SelectButton } from 'primeng/selectbutton';
import { Tooltip } from 'primeng/tooltip';
import { Payment, PaymentMethod } from '../core/models';
import { isoDate } from '../core/schedule';
import { StoreService } from '../core/store.service';

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
  imports: [CurrencyPipe, DatePipe, NgClass, FormsModule, FaIconComponent, Button, Dialog, InputNumber, InputText, SelectButton, Tooltip],
  template: `
    <p-dialog [visible]="visible()" (visibleChange)="visible.set($event)" [modal]="true" [closable]="false" [dismissableMask]="true" [draggable]="false"
      [style]="{ width: '82rem' }" [breakpoints]="{ '1400px': '95vw' }"
      styleClass="!rounded-3xl !border-0 !max-h-[92vh] overflow-hidden">
      <ng-template #headless>
        <div class="flex flex-col max-h-[92vh] bg-surface-0 dark:bg-surface-900 rounded-3xl">
          <!-- header -->
          <div class="m-2 rounded-2xl px-4 py-3 text-primary-contrast bg-gradient-to-br from-primary-500 to-primary-800">
            <div class="flex flex-wrap items-center gap-3">
              <fa-icon icon="calendar" class="text-2xl" />
              <div class="min-w-0">
                <div class="font-semibold text-lg leading-tight">Payments calendar</div>
                <div class="text-sm opacity-80 truncate">{{ clientName() }} · {{ gymName() }}</div>
              </div>
              <div class="flex-1"></div>
              <div class="flex items-center gap-2">
                <button type="button" (click)="prevYear()" class="w-9 h-9 rounded-full bg-white/20 hover:bg-white/30 cursor-pointer" aria-label="Previous year"><fa-icon icon="caret-left" /></button>
                <span class="text-lg font-bold tabular-nums w-14 text-center">{{ year() }}</span>
                <button type="button" (click)="nextYear()" class="w-9 h-9 rounded-full bg-white/20 hover:bg-white/30 cursor-pointer" aria-label="Next year"><fa-icon icon="caret-right" /></button>
              </div>
              <div class="hidden sm:block text-right">
                <div class="text-xs opacity-80">Today</div>
                <div class="font-semibold text-sm">{{ today() | date: 'EEE d MMM y' }}</div>
              </div>
              <button type="button" (click)="goToToday()" class="px-3 h-9 rounded-full bg-white/20 hover:bg-white/30 cursor-pointer text-sm font-medium">
                <fa-icon icon="calendar-day" /> Today
              </button>
              <button type="button" (click)="visible.set(false)" class="w-9 h-9 rounded-full bg-white/10 hover:bg-white/25 cursor-pointer" aria-label="Close"><fa-icon icon="xmark" /></button>
            </div>
            <!-- summary -->
            <div class="flex flex-wrap gap-x-6 gap-y-1 mt-3 text-sm">
              <span><span class="opacity-80">Paid in {{ year() }}:&nbsp;</span><b>{{ yearTotal() | currency }}</b></span>
              <span><span class="opacity-80">Payments:&nbsp;</span><b>{{ yearCount() }}</b></span>
              <span><span class="opacity-80">Months subscribed:&nbsp;</span><b>{{ coveredMonths() }}/12</b></span>
              <span><span class="opacity-80">All time:&nbsp;</span><b>{{ allTimeTotal() | currency }}</b></span>
            </div>
          </div>

          <!-- legend -->
          <div class="flex flex-wrap items-center gap-4 px-4 pt-1 pb-2 text-xs muted">
            <span class="flex items-center gap-1.5"><span class="w-3 h-3 rounded-full bg-green-500"></span> Payment</span>
            <span class="flex items-center gap-1.5"><span class="w-3 h-3 rounded-full ring-2 ring-primary"></span> Today</span>
            <span class="flex items-center gap-1.5"><span class="w-3 h-3 rounded-full bg-primary-100 dark:bg-primary-900"></span> Subscribed day</span>
            <span class="flex items-center gap-1.5"><span class="w-3 h-3 rounded bg-green-600"></span> Month with subscription</span>
            <span class="flex items-center gap-1.5"><span class="w-3 h-3 rounded bg-surface-400"></span> No subscription</span>
            @if (readonly()) { <span class="ml-auto">Read-only — tap a green day to see the payment.</span> }
            @else { <span class="ml-auto">Click a day to add or edit a payment.</span> }
          </div>

          <!-- months -->
          <div class="overflow-y-auto px-3 pb-3">
            <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3">
              @for (month of calendar(); track month.value) {
                <div class="rounded-xl border border-surface-200 dark:border-surface-700 bg-surface-0 dark:bg-surface-800 overflow-hidden">
                  <div class="flex items-center justify-between px-3 py-1.5 text-sm font-semibold text-white"
                    [ngClass]="month.status === 'present' ? 'bg-green-600 dark:bg-green-700' : 'bg-surface-400 dark:bg-surface-600'">
                    <span>{{ month.label }}</span>
                    @if (month.paid) { <span class="text-xs font-medium opacity-90">{{ month.paid | currency }}</span> }
                  </div>
                  <div class="grid grid-cols-7 text-center text-[10px] font-semibold muted px-1 pt-1">
                    @for (w of weekdays; track w) { <div>{{ w }}</div> }
                  </div>
                  <div class="grid grid-cols-7 gap-0.5 text-center text-sm p-1">
                    @for (day of month.days; track $index) {
                      @if (day) {
                        <button type="button"
                          class="aspect-square rounded-full text-xs sm:text-sm select-none transition-colors"
                          [class.cursor-pointer]="!readonly() || !!day.payment"
                          [class.cursor-default]="readonly() && !day.payment"
                          [ngClass]="{
                            '!bg-green-500 !text-white font-semibold': day.payment,
                            'ring-2 ring-primary font-bold': day.isToday,
                            'bg-primary-50 dark:bg-primary-950 text-primary-700 dark:text-primary-200': !day.payment && day.covered,
                            'hover:bg-surface-100 dark:hover:bg-surface-700': !day.payment && !readonly(),
                            'text-surface-600 dark:text-surface-300': !day.payment && !day.covered
                          }"
                          [pTooltip]="day.tooltip" [tooltipDisabled]="!day.payment"
                          (click)="onDayClick(day)">
                          {{ day.date.getDate() }}
                        </button>
                      } @else {
                        <div></div>
                      }
                    }
                  </div>
                </div>
              }
            </div>
          </div>
        </div>
      </ng-template>
    </p-dialog>

    <!-- add / edit payment -->
    <p-dialog [visible]="editVisible()" (visibleChange)="editVisible.set($event)" [modal]="true" [closable]="false" [dismissableMask]="true" [draggable]="false"
      [style]="{ width: '26rem' }" [breakpoints]="{ '640px': '92vw' }" styleClass="!rounded-3xl !border-0">
      <ng-template #headless>
        <div class="bg-surface-0 dark:bg-surface-900 rounded-3xl">
          <div class="m-2 rounded-2xl px-4 py-3 text-white bg-gradient-to-br flex items-center gap-2"
            [ngClass]="action() === 'edit' ? 'from-amber-500 to-orange-700' : action() === 'view' ? 'from-green-500 to-green-700' : 'from-primary-500 to-primary-800'">
            <fa-icon [icon]="action() === 'edit' ? 'pen' : action() === 'view' ? 'receipt' : 'circle-plus'" />
            <span class="font-semibold flex-1">{{ action() === 'edit' ? 'Edit' : action() === 'view' ? 'Payment' : 'Add' }} payment</span>
            <button type="button" (click)="editVisible.set(false)" class="w-8 h-8 rounded-full bg-white/20 hover:bg-white/30 cursor-pointer" aria-label="Close"><fa-icon icon="xmark" /></button>
          </div>
          <div class="px-5 pt-2 pb-5 space-y-4">
            <div class="text-center">
              <div class="text-sm muted">Selected date</div>
              <div class="font-semibold">{{ selectedDate() | date: 'fullDate' }}</div>
            </div>
            @if (action() === 'view') {
              <div class="text-center space-y-1">
                <div class="text-3xl font-extrabold text-green-600">{{ amount | currency }}</div>
                <div class="text-sm muted">{{ methodLabel[method] }}@if (note) { · {{ note }} }</div>
              </div>
            } @else {
              <div class="field">
                <label>Amount</label>
                <p-inputnumber [(ngModel)]="amount" mode="currency" currency="USD" [min]="0" inputStyleClass="w-full" styleClass="w-full" [autofocus]="true" />
                @if (touched && !(amount > 0)) { <small class="text-red-500">Please enter a valid amount.</small> }
              </div>
              <div class="field">
                <label>Method</label>
                <p-selectbutton [options]="methods" optionLabel="label" optionValue="value" [(ngModel)]="method" [allowEmpty]="false" />
              </div>
              <div class="field"><label>Note (optional)</label><input pInputText [(ngModel)]="note" placeholder="e.g. March membership" /></div>
              @if (suggested(); as s) {
                <button type="button" class="text-xs text-primary cursor-pointer" (click)="amount = s.price; note = note || s.name">
                  Use plan price: {{ s.name }} ({{ s.price | currency }})
                </button>
              }
            }
          </div>
          @if (action() !== 'view') {
            <div class="flex justify-center gap-2 pb-5">
              <p-button label="Cancel" severity="secondary" [rounded]="true" (onClick)="editVisible.set(false)" />
              <p-button [label]="action() === 'edit' ? 'Save' : 'Add'" [rounded]="true" [severity]="action() === 'edit' ? 'warn' : undefined" (onClick)="save()" />
              @if (action() === 'edit') { <p-button label="Delete" severity="danger" [rounded]="true" [outlined]="true" (onClick)="remove()" /> }
            </div>
          }
        </div>
      </ng-template>
    </p-dialog>
  `,
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
          tooltip: payment ? `💰 $${payment.amount} · ${METHOD_LABEL[payment.method]}${payment.note ? ' · ' + payment.note : ''}` : '',
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
    this.toast.add({ severity: 'success', summary: this.editing ? 'Payment updated' : 'Payment added', detail: `$${this.amount} on ${isoDate(this.selectedDate())}` });
  }

  remove() {
    const p = this.editing;
    if (!p) return;
    this.confirm.confirm({
      header: 'Delete payment', message: `Delete the $${p.amount} payment of ${p.date}?`, acceptButtonStyleClass: 'p-button-danger',
      accept: () => {
        this.store.deletePayment(p.id);
        this.editVisible.set(false);
        this.toast.add({ severity: 'info', summary: 'Payment deleted' });
      },
    });
  }
}
