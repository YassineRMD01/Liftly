import { TranslatePipe, t, CURRENT_LANGUAGE } from '../../core/i18n/i18n';
import { Component, ElementRef, afterNextRender, computed, inject, input, output, viewChild } from '@angular/core';
import { Tooltip } from 'primeng/tooltip';
import { Gender, ScheduleSlot } from '../../core/models';
import { AUDIENCE, DAY_LABEL, DAY_SHORT, WEEK, canAttend, isoDate, toMin } from '../../core/schedule';
import { StoreService } from '../../core/store.service';
import { AudienceTag } from '../audience-tag/audience-tag';

interface PlacedSlot extends ScheduleSlot { ok: boolean; top: number; height: number; lane: number; lanes: number; }

/**
 * Weekly time-grid calendar: days on the x-axis (Mon → Sun columns), hours on the y-axis (rows).
 * The grid scrolls vertically with the day header pinned, and opens at the current hour.
 * Parallel sessions (e.g. men & women, or two sports) are drawn side by side.
 * Emits slotClick when `editable` is set (admin).
 */
@Component({
  selector: 'app-week-calendar',
  imports: [TranslatePipe, Tooltip, AudienceTag],
  templateUrl: './week-calendar.html',
  styleUrl: './week-calendar.css',
})
export class WeekCalendar {
  protected readonly store = inject(StoreService);
  readonly gymId = input.required<string>();
  readonly gender = input<Gender>();
  readonly editable = input(false);
  readonly slotClick = output<ScheduleSlot>();
  /** Height of one hour on the y-axis. */
  protected readonly hourPx = 96;
  private readonly scroller = viewChild<ElementRef<HTMLElement>>('scroller');

  private readonly slots = computed(() => this.store.scheduleOfGym(this.gymId()));
  /** Visible hour range: earliest opening → latest closing (00–23 when the gym has no sessions). */
  private readonly range = computed(() => {
    const all = this.slots();
    if (!all.length) return { from: 0, to: 23 };
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
        dateLabel: date.toLocaleDateString(CURRENT_LANGUAGE.locale, { day: 'numeric', month: 'short' }),
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

  constructor() {
    afterNextRender(() => this.scrollToNow());
  }

  /** Scroll the y-axis to one hour before now (or to the first session when the gym is closed now). */
  scrollToNow() {
    const el = this.scroller()?.nativeElement;
    if (!el) return;
    const first = Math.min(...this.days().flatMap((d) => d.slots.map((s) => s.top)), Infinity);
    const target = this.nowTop() ?? (Number.isFinite(first) ? first : 0);
    el.scrollTop = Math.max(0, target - this.hourPx);
  }

  pad(h: number) { return String(h).padStart(2, '0'); }
  color(s: ScheduleSlot) { return AUDIENCE[s.audience].color; }
  short(s: ScheduleSlot) { return AUDIENCE[s.audience].short; }
  tip(s: ScheduleSlot) {
    return `${DAY_LABEL[s.day]} ${s.open}–${s.close} · ${AUDIENCE[s.audience].label}${' · ' + (s.sportId ? this.store.sportName(s.sportId) : t('Whole gym'))}${s.note ? ' · ' + s.note : ''}`;
  }
}
