import { Component, computed, inject, input, output } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FaIconComponent } from '@fortawesome/angular-fontawesome';
import { Tooltip } from 'primeng/tooltip';
import { Gender, ScheduleSlot } from '../core/models';
import { AUDIENCE, DAY_LABEL, DAY_SHORT, WEEK, canAttend, isoDate, toMin } from '../core/schedule';
import { StoreService } from '../core/store.service';

/** Small colored pill showing who a slot is for. */
@Component({
  selector: 'app-audience-tag',
  imports: [FaIconComponent],
  template: `
    <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold text-white whitespace-nowrap"
      [style.background]="meta().color">
      <fa-icon [icon]="meta().icon" />{{ short() ? meta().short : meta().label }}
    </span>
  `,
})
export class AudienceTag {
  readonly audience = input.required<ScheduleSlot['audience']>();
  readonly short = input(false);
  protected readonly meta = computed(() => AUDIENCE[this.audience()]);
}

/** "Open now · Women only until 14:00" badge. */
@Component({
  selector: 'app-open-status',
  template: `
    @let s = status();
    <span class="inline-flex items-center gap-1.5 text-xs font-semibold">
      <span class="w-2 h-2 rounded-full" [class.bg-green-500]="s.open" [class.bg-red-500]="!s.open"></span>
      @if (s.open) {
        <span class="text-green-600 dark:text-green-400">Open now</span>
        <span class="muted font-normal">· {{ audienceLabel(s.current[0].audience) }} until {{ s.current[0].close }}</span>
      } @else if (s.closure) {
        <span class="text-red-600 dark:text-red-400">Closed today</span><span class="muted font-normal">· {{ s.closure.reason }}</span>
      } @else {
        <span class="text-red-600 dark:text-red-400">Closed</span>
        @if (s.next; as n) {
          <span class="muted font-normal">· opens {{ n.today ? 'today' : dayShort[n.day] }} {{ n.slot.open }} ({{ audienceLabel(n.slot.audience) }})</span>
        }
      }
    </span>
  `,
})
export class OpenStatusBadge {
  private readonly store = inject(StoreService);
  readonly gymId = input.required<string>();
  readonly gender = input<Gender>();
  protected readonly dayShort = DAY_SHORT;
  protected readonly status = computed(() => this.store.gymOpenStatus(this.gymId(), this.gender()));
  audienceLabel(a: ScheduleSlot['audience']) { return AUDIENCE[a].label; }
}

/** Read-only weekly timetable with a 24h timeline per day. */
@Component({
  selector: 'app-week-schedule',
  imports: [DatePipe, FaIconComponent, Tooltip, AudienceTag],
  template: `
    <div class="flex flex-wrap gap-2 mb-3 text-xs">
      <app-audience-tag audience="MIXED" /><app-audience-tag audience="MEN" /><app-audience-tag audience="WOMEN" />
      @if (gender()) { <span class="muted self-center">Faded slots are not open to you.</span> }
    </div>
    <div class="divide-y divide-surface-200 dark:divide-surface-800">
      @for (d of days(); track d.day) {
        <div class="py-2.5 grid grid-cols-[5.5rem_1fr] gap-3 items-start" [class.font-semibold]="d.today">
          <div class="text-sm pt-0.5" [class.text-primary]="d.today">{{ d.label }}</div>
          <div class="min-w-0">
            @if (d.slots.length) {
              <!-- timeline -->
              <div class="relative h-2.5 rounded-full bg-surface-100 dark:bg-surface-800 overflow-hidden mb-2">
                @for (s of d.slots; track s.id) {
                  <div class="absolute top-0 h-full" [style.left.%]="pos(s.open)" [style.width.%]="pos(s.close) - pos(s.open)"
                    [style.background]="color(s)" [class.opacity-25]="!s.ok"
                    [pTooltip]="s.open + '–' + s.close + ' · ' + label(s)"></div>
                }
              </div>
              <div class="flex flex-wrap gap-x-4 gap-y-1.5">
                @for (s of d.slots; track s.id) {
                  <span class="inline-flex items-center gap-1.5 text-sm font-normal" [class.opacity-40]="!s.ok">
                    <span class="tabular-nums">{{ s.open }}–{{ s.close }}</span>
                    <app-audience-tag [audience]="s.audience" [short]="true" />
                    @if (s.sport) { <span class="text-xs muted">{{ s.sport }}</span> }
                    @if (s.note) { <span class="text-xs muted italic">{{ s.note }}</span> }
                  </span>
                }
              </div>
            } @else {
              <span class="text-sm muted font-normal">Closed</span>
            }
          </div>
        </div>
      }
    </div>
    @if (closures().length) {
      <div class="mt-4 text-sm">
        <div class="font-semibold mb-1"><fa-icon icon="calendar-xmark" class="text-red-500" /> Upcoming closures</div>
        @for (c of closures(); track c.id) {
          <div class="muted">{{ c.date | date: 'EEE, MMM d' }} — {{ c.reason }}</div>
        }
      </div>
    }
  `,
})
export class WeekSchedule {
  private readonly store = inject(StoreService);
  readonly gymId = input.required<string>();
  readonly gender = input<Gender>();

  protected readonly days = computed(() => {
    const all = this.store.scheduleOfGym(this.gymId());
    const today = new Date().getDay();
    return WEEK.map((day) => ({
      day,
      label: DAY_LABEL[day],
      today: day === today,
      slots: all.filter((s) => s.day === day).map((s) => ({ ...s, ok: canAttend(s, this.gender()) })),
    }));
  });
  protected readonly closures = computed(() => {
    const today = new Date().toISOString().slice(0, 10);
    return this.store.closuresOfGym(this.gymId()).filter((c) => c.date >= today).slice(0, 5);
  });

  pos(t: string) { return (toMin(t) / 1440) * 100; }
  color(s: ScheduleSlot) { return AUDIENCE[s.audience].color; }
  label(s: ScheduleSlot) { return AUDIENCE[s.audience].label + (s.sport ? ' · ' + s.sport : ''); }
}

interface PlacedSlot extends ScheduleSlot { ok: boolean; top: number; height: number; lane: number; lanes: number; }

/**
 * Weekly time-grid calendar (Mon → Sun columns, hour rows).
 * Parallel sessions (e.g. men & women, or two sports) are drawn side by side.
 * Emits slotClick when `editable` is set (admin).
 */
@Component({
  selector: 'app-week-calendar',
  imports: [Tooltip, AudienceTag],
  template: `
    <div class="flex flex-wrap items-center gap-2 mb-3 text-xs">
      <app-audience-tag audience="MIXED" /><app-audience-tag audience="MEN" /><app-audience-tag audience="WOMEN" />
      @if (gender()) { <span class="muted">Faded sessions are not open to you.</span> }
    </div>
    <div class="overflow-x-auto rounded-xl border border-surface-200 dark:border-surface-700">
      <div class="min-w-[44rem]">
        <!-- day headers -->
        <div class="grid grid-cols-[3.25rem_repeat(7,1fr)] border-b border-surface-200 dark:border-surface-700 bg-surface-50 dark:bg-surface-800">
          <div></div>
          @for (d of days(); track d.day) {
            <div class="py-2 text-center text-xs font-semibold border-l border-surface-200 dark:border-surface-700"
              [class.text-primary]="d.today" [class.bg-primary-50]="d.today" [class.dark:bg-primary-950]="d.today">
              {{ d.short }}
              <div class="font-normal muted">{{ d.dateLabel }}</div>
              @if (d.closure) { <div class="text-[10px] text-red-500 font-semibold truncate px-1" [title]="d.closure">Closed</div> }
            </div>
          }
        </div>
        <!-- grid -->
        <div class="grid grid-cols-[3.25rem_repeat(7,1fr)] relative" [style.height.px]="hours().length * hourPx">
          <!-- hour labels -->
          <div class="relative">
            @for (h of hours(); track h; let i = $index) {
              <div class="absolute right-1.5 -translate-y-1/2 text-[10px] muted tabular-nums" [style.top.px]="i * hourPx">{{ pad(h) }}:00</div>
            }
          </div>
          @for (d of days(); track d.day) {
            <div class="relative border-l border-surface-200 dark:border-surface-700" [class.bg-primary-50/40]="d.today"
              [class.bg-red-50/60]="!!d.closure" [class.dark:bg-red-950/30]="!!d.closure">
              @for (h of hours(); track h; let i = $index) {
                <div class="absolute inset-x-0 border-t border-surface-100 dark:border-surface-800" [style.top.px]="i * hourPx"></div>
              }
              @for (s of d.slots; track s.id) {
                <div class="absolute rounded-md px-1.5 py-1 text-white text-[11px] leading-tight overflow-hidden shadow-sm border border-white/40 dark:border-black/30"
                  [class.opacity-30]="!s.ok" [class.cursor-pointer]="editable()" [class.hover:brightness-110]="editable()"
                  [style.top.px]="s.top" [style.height.px]="s.height"
                  [style.left]="'calc(' + (s.lane / s.lanes) * 100 + '% + 2px)'" [style.width]="'calc(' + 100 / s.lanes + '% - 4px)'"
                  [style.background]="color(s)"
                  [pTooltip]="tip(s)" tooltipPosition="top"
                  (click)="editable() && slotClick.emit(s)">
                  <div class="font-semibold tabular-nums">{{ s.open }}–{{ s.close }}</div>
                  @if (s.height > 34) { <div class="truncate">{{ short(s) }}</div> }
                  @if (s.height > 50 && s.sport) { <div class="truncate opacity-90">{{ s.sport }}</div> }
                  @if (s.height > 66 && s.note) { <div class="truncate italic opacity-80">{{ s.note }}</div> }
                </div>
              }
              @if (d.today && nowTop() !== null) {
                <div class="absolute inset-x-0 z-10 pointer-events-none" [style.top.px]="nowTop()">
                  <div class="h-0.5 bg-red-500"></div><div class="absolute -left-1 -top-1 w-2.5 h-2.5 rounded-full bg-red-500"></div>
                </div>
              }
            </div>
          }
        </div>
      </div>
    </div>
  `,
})
export class WeekCalendar {
  private readonly store = inject(StoreService);
  readonly gymId = input.required<string>();
  readonly gender = input<Gender>();
  readonly editable = input(false);
  readonly slotClick = output<ScheduleSlot>();
  protected readonly hourPx = 44;

  private readonly slots = computed(() => this.store.scheduleOfGym(this.gymId()));
  /** Visible hour range: earliest opening → latest closing (default 06–22). */
  private readonly range = computed(() => {
    const all = this.slots();
    if (!all.length) return { from: 6, to: 22 };
    const from = Math.floor(Math.min(...all.map((s) => toMin(s.open))) / 60);
    const to = Math.ceil(Math.max(...all.map((s) => toMin(s.close))) / 60);
    return { from: Math.max(0, from), to: Math.min(24, Math.max(to, from + 1)) };
  });
  protected readonly hours = computed(() => {
    const { from, to } = this.range();
    return Array.from({ length: to - from }, (_, i) => from + i);
  });

  protected readonly days = computed(() => {
    const { from } = this.range();
    const now = new Date();
    const monday = new Date(now);
    monday.setDate(now.getDate() - ((now.getDay() + 6) % 7));
    const closures = this.store.closuresOfGym(this.gymId());
    return WEEK.map((day, i) => {
      const date = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + i);
      const list = this.slots().filter((s) => s.day === day).sort((a, b) => a.open.localeCompare(b.open));
      // lane assignment for overlapping slots
      const laneEnds: number[] = [];
      const placed = list.map((s) => {
        const start = toMin(s.open);
        let lane = laneEnds.findIndex((end) => end <= start);
        if (lane === -1) { lane = laneEnds.length; laneEnds.push(0); }
        laneEnds[lane] = toMin(s.close);
        return { ...s, lane, ok: canAttend(s, this.gender()), top: ((start - from * 60) / 60) * this.hourPx, height: ((toMin(s.close) - start) / 60) * this.hourPx, lanes: 1 } as PlacedSlot;
      });
      // each slot takes the lane count of the slots it overlaps with
      for (const s of placed) {
        const overlapping = placed.filter((o) => toMin(o.open) < toMin(s.close) && toMin(s.open) < toMin(o.close));
        s.lanes = Math.max(...overlapping.map((o) => o.lane)) + 1;
      }
      return {
        day, short: DAY_SHORT[day], today: day === now.getDay(),
        dateLabel: date.toLocaleDateString(undefined, { day: 'numeric', month: 'short' }),
        closure: closures.find((c) => c.date === isoDate(date))?.reason,
        slots: placed,
      };
    });
  });

  protected readonly nowTop = computed(() => {
    const { from, to } = this.range();
    const n = new Date();
    const min = n.getHours() * 60 + n.getMinutes();
    return min < from * 60 || min > to * 60 ? null : ((min - from * 60) / 60) * this.hourPx;
  });

  pad(h: number) { return String(h).padStart(2, '0'); }
  color(s: ScheduleSlot) { return AUDIENCE[s.audience].color; }
  short(s: ScheduleSlot) { return AUDIENCE[s.audience].short; }
  tip(s: ScheduleSlot) {
    return `${DAY_LABEL[s.day]} ${s.open}–${s.close} · ${AUDIENCE[s.audience].label}${s.sport ? ' · ' + s.sport : ' · Whole gym'}${s.note ? ' · ' + s.note : ''}`;
  }
}
