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
import { AuthService } from '../../../core/auth.service';
import { Audience, ScheduleSlot } from '../../../core/models';
import { AUDIENCE, DAY_LABEL, DAY_SHORT, WEEK, conflicts, isoDate, toMin } from '../../../core/schedule';
import { StoreService } from '../../../core/store.service';
import { AudienceTag } from '../../../shared/audience-tag/audience-tag';
import { OpenStatusBadge } from '../../../shared/open-status/open-status';
import { WeekCalendar } from '../../../shared/week-calendar/week-calendar';
import { WeekSchedule } from '../../../shared/week-schedule/week-schedule';
import { PageHeader } from '../../../shared/page-header/page-header';

type Draft = { id: string; days: number[]; open: string; close: string; audience: Audience; sport: string | null; note: string };
type Template = Omit<ScheduleSlot, 'id' | 'gymId'>[];

const every = (days: number[], open: string, close: string, audience: Audience) => days.map((day) => ({ day, open, close, audience }));
const WEEKDAYS = [1, 2, 3, 4, 5];
const WEEKEND = [6, 0];

@Component({
  selector: 'app-admin-schedule',
  imports: [DatePipe, FormsModule, FaIconComponent, Button, DatePicker, Dialog, InputText, Menu, Message, Select, SelectButton, Tooltip, AudienceTag, OpenStatusBadge, WeekCalendar, WeekSchedule, PageHeader],
  templateUrl: './admin-schedule.html',
  styleUrl: './admin-schedule.css',
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

  protected readonly view = signal<'calendar' | 'list'>('calendar');
  protected readonly views = [{ label: 'Week calendar', value: 'calendar', icon: 'calendar-week' }, { label: 'Day list', value: 'list', icon: 'list' }];
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
