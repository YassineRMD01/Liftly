import { Component, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ConfirmationService, MenuItem, MessageService } from 'primeng/api';
import { FaIconComponent } from '@fortawesome/angular-fontawesome';
import { Button } from 'primeng/button';
import { DatePicker } from 'primeng/datepicker';
import { Dialog } from 'primeng/dialog';
import { InputText } from 'primeng/inputtext';
import { Menu } from 'primeng/menu';
import { Message } from 'primeng/message';
import { Select } from 'primeng/select';
import { SelectButton } from 'primeng/selectbutton';
import { Tooltip } from 'primeng/tooltip';
import { AuthService } from '../../core/auth.service';
import { Audience, ScheduleSlot } from '../../core/models';
import { AUDIENCE, DAY_LABEL, DAY_SHORT, WEEK, conflicts, isoDate, toMin } from '../../core/schedule';
import { StoreService } from '../../core/store.service';
import { AudienceTag, OpenStatusBadge, WeekSchedule } from '../../shared/schedule-ui';
import { PageHeader } from '../../shared/ui';

type Draft = { id: string; days: number[]; open: string; close: string; audience: Audience; sport: string | null; note: string };
type Template = Omit<ScheduleSlot, 'id' | 'gymId'>[];

const every = (days: number[], open: string, close: string, audience: Audience) => days.map((day) => ({ day, open, close, audience }));
const WEEKDAYS = [1, 2, 3, 4, 5];
const WEEKEND = [6, 0];

@Component({
  selector: 'app-admin-schedule',
  imports: [DatePipe, FormsModule, FaIconComponent, Button, DatePicker, Dialog, InputText, Menu, Message, Select, SelectButton, Tooltip, AudienceTag, OpenStatusBadge, WeekSchedule, PageHeader],
  template: `
    @if (gym(); as g) {
      <app-page-header title="Schedule" subtitle="Opening hours per day — mixed, men-only or women-only sessions, per sport or for the whole gym.">
        <p-menu #tpl [model]="templates" [popup]="true" appendTo="body" />
        <p-button label="Templates" severity="secondary" [outlined]="true" (onClick)="tpl.toggle($event)">
          <ng-template #icon><fa-icon icon="wand-magic-sparkles" /></ng-template>
        </p-button>
        <p-button label="Add time slot" (onClick)="openSlot()"><ng-template #icon><fa-icon icon="plus" /></ng-template></p-button>
      </app-page-header>

      <div class="card mb-6 flex flex-col sm:flex-row sm:items-center gap-3">
        <div class="flex-1"><div class="text-sm muted mb-1">Right now</div><app-open-status [gymId]="g.id" /></div>
        <div class="flex flex-wrap gap-4 text-sm">
          <span><b>{{ weeklyHours().MIXED }}</b>h <span class="muted">mixed</span></span>
          <span><b>{{ weeklyHours().MEN }}</b>h <span class="muted">men</span></span>
          <span><b>{{ weeklyHours().WOMEN }}</b>h <span class="muted">women</span></span>
          <span class="muted">per week</span>
        </div>
      </div>

      <div class="grid xl:grid-cols-5 gap-6">
        <!-- editor -->
        <div class="xl:col-span-3 space-y-3">
          @for (d of week(); track d.day) {
            <div class="card !p-4">
              <div class="flex items-center gap-2 mb-2">
                <h3 class="font-semibold flex-1" [class.text-primary]="d.today">{{ d.label }} @if (d.today) { <span class="text-xs font-normal muted">· today</span> }</h3>
                @if (d.slots.length) {
                  <p-button [text]="true" size="small" severity="secondary" pTooltip="Copy this day to…" (onClick)="openCopy(d.day)"><fa-icon icon="copy" /></p-button>
                  <p-button [text]="true" size="small" severity="danger" pTooltip="Clear day" (onClick)="clearDay(d.day)"><fa-icon icon="trash" /></p-button>
                }
                <p-button [text]="true" size="small" label="Add" (onClick)="openSlot(d.day)"><ng-template #icon><fa-icon icon="plus" /></ng-template></p-button>
              </div>
              @for (s of d.slots; track s.id) {
                <div class="flex flex-wrap items-center gap-2 py-2 border-t border-surface-100 dark:border-surface-800">
                  <span class="font-mono text-sm tabular-nums w-28">{{ s.open }} – {{ s.close }}</span>
                  <app-audience-tag [audience]="s.audience" />
                  <span class="text-sm">{{ s.sport ?? 'Whole gym' }}</span>
                  @if (s.note) { <span class="text-xs muted italic">{{ s.note }}</span> }
                  <span class="flex-1"></span>
                  <p-button [text]="true" [rounded]="true" size="small" (onClick)="openSlot(d.day, s)" pTooltip="Edit"><fa-icon icon="pen" /></p-button>
                  <p-button [text]="true" [rounded]="true" size="small" severity="danger" (onClick)="removeSlot(s)" pTooltip="Delete"><fa-icon icon="trash" /></p-button>
                </div>
              } @empty {
                <div class="text-sm muted border-t border-surface-100 dark:border-surface-800 pt-2">Closed all day</div>
              }
            </div>
          }
        </div>

        <!-- side: preview + closures -->
        <div class="xl:col-span-2 space-y-6">
          <div class="card">
            <h2 class="font-semibold mb-1">Closures & holidays</h2>
            <p class="text-xs muted mb-3">The gym is closed all day on these dates, whatever the weekly schedule says.</p>
            <div class="flex flex-col sm:flex-row gap-2">
              <p-datepicker [(ngModel)]="closureDate" [minDate]="today" [showIcon]="true" placeholder="Date" appendTo="body" styleClass="w-full sm:w-44" />
              <input pInputText class="flex-1" placeholder="Reason (e.g. National holiday)" [(ngModel)]="closureReason" />
              <p-button label="Add" (onClick)="addClosure()" [disabled]="!closureDate || !closureReason" />
            </div>
            <div class="mt-3 space-y-1">
              @for (c of closures(); track c.id) {
                <div class="flex items-center gap-2 text-sm py-1">
                  <fa-icon icon="calendar-xmark" class="text-red-500" />
                  <span class="font-medium">{{ c.date | date: 'EEE, MMM d, y' }}</span>
                  <span class="muted flex-1">{{ c.reason }}</span>
                  <p-button [text]="true" [rounded]="true" size="small" severity="danger" (onClick)="store.deleteClosure(c.id)"><fa-icon icon="xmark" /></p-button>
                </div>
              } @empty { <p class="text-sm muted">No closures planned.</p> }
            </div>
          </div>

          <div class="card">
            <h2 class="font-semibold mb-3">What members see</h2>
            <app-week-schedule [gymId]="g.id" />
          </div>
        </div>
      </div>

      <!-- slot dialog -->
      <p-dialog [header]="draft.id ? 'Edit time slot' : 'New time slot'" [(visible)]="slotVisible" [modal]="true" [style]="{ width: '34rem' }" [breakpoints]="{ '640px': '95vw' }">
        <div class="space-y-4">
          <div class="field">
            <label>{{ draft.id ? 'Day' : 'Days' }}</label>
            <div class="flex flex-wrap gap-1.5">
              @for (d of weekOrder; track d) {
                <button type="button" (click)="toggleDay(d)"
                  class="w-12 py-1.5 rounded-lg text-sm font-medium border cursor-pointer transition-colors border-surface-300 dark:border-surface-600"
                  [class.!bg-primary]="draft.days.includes(d)" [class.!text-primary-contrast]="draft.days.includes(d)" [class.!border-primary]="draft.days.includes(d)">
                  {{ dayShort[d] }}
                </button>
              }
            </div>
            @if (!draft.id) {
              <div class="flex gap-3 text-xs mt-1">
                <a class="text-primary cursor-pointer" (click)="draft.days = [1, 2, 3, 4, 5]">Weekdays</a>
                <a class="text-primary cursor-pointer" (click)="draft.days = [6, 0]">Weekend</a>
                <a class="text-primary cursor-pointer" (click)="draft.days = [1, 2, 3, 4, 5, 6, 0]">Every day</a>
              </div>
            }
          </div>
          <div class="grid grid-cols-2 gap-4">
            <div class="field"><label>Opens</label><input pInputText type="time" [(ngModel)]="draft.open" /></div>
            <div class="field"><label>Closes</label><input pInputText type="time" [(ngModel)]="draft.close" /></div>
          </div>
          <div class="field">
            <label>Who can attend</label>
            <p-selectbutton [options]="audiences" optionLabel="label" optionValue="value" [(ngModel)]="draft.audience" [allowEmpty]="false">
              <ng-template #item let-o><fa-icon [icon]="o.icon" class="mr-1.5" [style.color]="o.color" />{{ o.label }}</ng-template>
            </p-selectbutton>
          </div>
          <div class="field">
            <label>Area / sport</label>
            <p-select [options]="sportOptions()" optionLabel="label" optionValue="value" [(ngModel)]="draft.sport" styleClass="w-full" appendTo="body" />
          </div>
          <div class="field"><label>Note (optional)</label><input pInputText [(ngModel)]="draft.note" placeholder="e.g. Ladies hours, Kids class" /></div>
          @if (error()) { <p-message severity="error">{{ error() }}</p-message> }
          <p class="text-xs muted">Men-only and women-only sessions may run at the same time (separate areas). Any other overlap on the same area is refused.</p>
        </div>
        <ng-template #footer>
          <p-button label="Cancel" [text]="true" severity="secondary" (onClick)="slotVisible = false" />
          <p-button label="Save" (onClick)="saveSlot()" />
        </ng-template>
      </p-dialog>

      <!-- copy dialog -->
      <p-dialog [header]="'Copy ' + (copyFrom() !== null ? dayLabel[copyFrom()!] : '') + ' to…'" [(visible)]="copyVisible" [modal]="true" [style]="{ width: '28rem' }" [breakpoints]="{ '640px': '95vw' }">
        <div class="flex flex-wrap gap-1.5">
          @for (d of weekOrder; track d) {
            @if (d !== copyFrom()) {
              <button type="button" (click)="toggleCopy(d)" class="w-12 py-1.5 rounded-lg text-sm font-medium border cursor-pointer border-surface-300 dark:border-surface-600"
                [class.!bg-primary]="copyTo.includes(d)" [class.!text-primary-contrast]="copyTo.includes(d)" [class.!border-primary]="copyTo.includes(d)">{{ dayShort[d] }}</button>
            }
          }
        </div>
        <p class="text-xs muted mt-3">The selected days' current slots are replaced.</p>
        <ng-template #footer>
          <p-button label="Cancel" [text]="true" severity="secondary" (onClick)="copyVisible = false" />
          <p-button label="Copy" (onClick)="copy()" [disabled]="!copyTo.length" />
        </ng-template>
      </p-dialog>
    }
  `,
})
export class AdminSchedule {
  private readonly auth = inject(AuthService);
  protected readonly store = inject(StoreService);
  private readonly toast = inject(MessageService);
  private readonly confirm = inject(ConfirmationService);

  protected readonly gym = this.auth.activeGym;
  protected readonly weekOrder = WEEK;
  protected readonly dayShort = DAY_SHORT;
  protected readonly dayLabel = DAY_LABEL;
  protected readonly today = new Date();
  protected readonly audiences = (Object.keys(AUDIENCE) as Audience[]).map((value) => ({ value, ...AUDIENCE[value] }));

  protected slotVisible = false;
  protected copyVisible = false;
  protected draft: Draft = this.emptyDraft();
  protected readonly error = signal<string | null>(null);
  protected readonly copyFrom = signal<number | null>(null);
  protected copyTo: number[] = [];
  protected closureDate: Date | null = null;
  protected closureReason = '';

  private readonly gymId = computed(() => this.gym()?.id ?? '');
  private readonly slots = computed(() => this.store.scheduleOfGym(this.gymId()));
  protected readonly closures = computed(() => this.store.closuresOfGym(this.gymId()).filter((c) => c.date >= isoDate()));
  protected readonly sportOptions = computed(() => [
    { label: 'Whole gym (all sports)', value: null },
    ...(this.gym()?.sports ?? []).map((s) => ({ label: s, value: s })),
  ]);
  protected readonly week = computed(() => {
    const today = new Date().getDay();
    return WEEK.map((day) => ({ day, label: DAY_LABEL[day], today: day === today, slots: this.slots().filter((s) => s.day === day) }));
  });
  protected readonly weeklyHours = computed(() => {
    const h = { MIXED: 0, MEN: 0, WOMEN: 0 };
    for (const s of this.slots()) h[s.audience] += (toMin(s.close) - toMin(s.open)) / 60;
    return { MIXED: Math.round(h.MIXED), MEN: Math.round(h.MEN), WOMEN: Math.round(h.WOMEN) };
  });

  protected readonly templates: MenuItem[] = [
    { label: 'Mixed 06:00–22:00 every day', command: () => this.applyTemplate(every(WEEK, '06:00', '22:00', 'MIXED')) },
    {
      label: 'Mixed + women-only mornings',
      command: () => this.applyTemplate([
        ...every(WEEKDAYS, '06:00', '09:00', 'MIXED'), ...every(WEEKDAYS, '09:00', '12:00', 'WOMEN'),
        ...every(WEEKDAYS, '12:00', '22:00', 'MIXED'), ...every(WEEKEND, '08:00', '20:00', 'MIXED'),
      ]),
    },
    {
      label: 'Fully separated (women AM / men PM)',
      command: () => this.applyTemplate([...every(WEEK, '07:00', '14:00', 'WOMEN'), ...every(WEEK, '14:00', '22:00', 'MEN')]),
    },
    {
      label: 'Alternating days (men / women)',
      command: () => this.applyTemplate([...every([1, 3, 5], '07:00', '22:00', 'MEN'), ...every([2, 4, 6], '07:00', '22:00', 'WOMEN'), ...every([0], '09:00', '18:00', 'MIXED')]),
    },
    { separator: true },
    { label: 'Clear the whole week', command: () => this.applyTemplate([]) },
  ];

  private emptyDraft(day?: number): Draft {
    return { id: '', days: day !== undefined ? [day] : [1, 2, 3, 4, 5], open: '08:00', close: '20:00', audience: 'MIXED', sport: null, note: '' };
  }

  openSlot(day?: number, s?: ScheduleSlot) {
    this.error.set(null);
    this.draft = s
      ? { id: s.id, days: [s.day], open: s.open, close: s.close, audience: s.audience, sport: s.sport ?? null, note: s.note ?? '' }
      : this.emptyDraft(day);
    this.slotVisible = true;
  }

  toggleDay(d: number) {
    if (this.draft.id) { this.draft.days = [d]; return; }
    this.draft.days = this.draft.days.includes(d) ? this.draft.days.filter((x) => x !== d) : [...this.draft.days, d];
  }

  saveSlot() {
    const d = this.draft;
    if (!d.days.length) return this.error.set('Pick at least one day.');
    if (!d.open || !d.close || toMin(d.close) <= toMin(d.open)) return this.error.set('Closing time must be after opening time (use 23:59 for midnight).');
    const slots: ScheduleSlot[] = d.days.map((day) => ({
      id: d.id, gymId: this.gymId(), day, open: d.open, close: d.close, audience: d.audience,
      ...(d.sport ? { sport: d.sport } : {}), ...(d.note.trim() ? { note: d.note.trim() } : {}),
    }));
    for (const s of slots) {
      const clash = this.slots().find((o) => o.id !== s.id && conflicts(s, o));
      if (clash) {
        return this.error.set(`${DAY_LABEL[s.day]}: overlaps ${clash.open}–${clash.close} (${AUDIENCE[clash.audience].label}${clash.sport ? ', ' + clash.sport : ''}).`);
      }
    }
    // when editing, the slot keeps its own day; the sport key may be removed
    this.store.saveSlots(slots.map((s) => (s.sport ? s : { ...s, sport: undefined })));
    this.slotVisible = false;
    this.toast.add({ severity: 'success', summary: 'Schedule updated', detail: `${slots.length} slot${slots.length > 1 ? 's' : ''} saved` });
  }

  removeSlot(s: ScheduleSlot) {
    this.store.deleteSlot(s.id);
    this.toast.add({ severity: 'info', summary: 'Slot removed', detail: `${DAY_LABEL[s.day]} ${s.open}–${s.close}`, life: 1500 });
  }

  clearDay(day: number) {
    this.confirm.confirm({
      header: 'Clear day', message: `Remove all slots on ${DAY_LABEL[day]}? The gym will show as closed that day.`, acceptButtonStyleClass: 'p-button-danger',
      accept: () => this.slots().filter((s) => s.day === day).forEach((s) => this.store.deleteSlot(s.id)),
    });
  }

  openCopy(day: number) { this.copyFrom.set(day); this.copyTo = []; this.copyVisible = true; }
  toggleCopy(d: number) { this.copyTo = this.copyTo.includes(d) ? this.copyTo.filter((x) => x !== d) : [...this.copyTo, d]; }

  copy() {
    const from = this.slots().filter((s) => s.day === this.copyFrom());
    const keep = this.slots().filter((s) => !this.copyTo.includes(s.day)).map(({ id, gymId, ...rest }) => rest);
    const copies = this.copyTo.flatMap((day) => from.map(({ id, gymId, ...rest }) => ({ ...rest, day })));
    this.store.replaceSchedule(this.gymId(), [...keep, ...copies]);
    this.copyVisible = false;
    this.toast.add({ severity: 'success', summary: 'Day copied', detail: this.copyTo.map((d) => DAY_SHORT[d]).join(', ') });
  }

  applyTemplate(t: Template) {
    this.confirm.confirm({
      header: 'Replace weekly schedule', message: t.length ? 'Replace the current week with this template?' : 'Remove every slot of the week?',
      accept: () => {
        this.store.replaceSchedule(this.gymId(), t);
        this.toast.add({ severity: 'success', summary: 'Schedule replaced' });
      },
    });
  }

  addClosure() {
    if (!this.closureDate) return;
    const date = isoDate(this.closureDate);
    if (this.closures().some((c) => c.date === date)) {
      this.toast.add({ severity: 'warn', summary: 'Already closed that day' });
      return;
    }
    this.store.addClosure({ gymId: this.gymId(), date, reason: this.closureReason.trim() });
    this.closureDate = null;
    this.closureReason = '';
    this.toast.add({ severity: 'success', summary: 'Closure added' });
  }
}
