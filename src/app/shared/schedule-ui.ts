import { Component, computed, inject, input } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FaIconComponent } from '@fortawesome/angular-fontawesome';
import { Tooltip } from 'primeng/tooltip';
import { Gender, ScheduleSlot } from '../core/models';
import { AUDIENCE, DAY_LABEL, DAY_SHORT, WEEK, canAttend, toMin } from '../core/schedule';
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
