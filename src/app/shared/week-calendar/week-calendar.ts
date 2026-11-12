import { TranslatePipe, t, CURRENT_LANGUAGE } from '../../core/i18n/i18n';
import { Component, computed, inject, input, output } from '@angular/core';
import { Tooltip } from 'primeng/tooltip';
import { Gender, ScheduleSlot } from '../../core/models';
import { AUDIENCE, DAY_LABEL, DAY_SHORT, WEEK, canAttend, isoDate, toMin } from '../../core/schedule';
import { StoreService } from '../../core/store.service';
import { AudienceTag } from '../audience-tag/audience-tag';

interface PlacedSlot extends ScheduleSlot { ok: boolean; start: number; width: number; lane: number; lanes: number; }

/**
 * Weekly calendar laid out sideways: one row per day (Mon → Sun), hours across the full width.
 * Every hour is visible at once — no vertical scrolling. Parallel sessions (e.g. men & women,
 * or two sports) are stacked inside the day's row. Emits slotClick when `editable` is set (admin).
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
  /** Height of a day row; parallel sessions share it. */
  protected readonly rowPx = 64;

  private readonly slots = computed(() => this.store.scheduleOfGym(this.gymId()));
  /** Visible hours: earliest opening → latest closing (00–24 when the gym has no sessions). */
  private readonly range = computed(() => {
    const all = this.slots();
    if (!all.length) return { from: 0, to: 24 };
    const from = Math.floor(Math.min(...all.map((s) => toMin(s.open))) / 60);
    const to = Math.ceil(Math.max(...all.map((s) => toMin(s.close))) / 60);
    return { from: Math.max(0, from), to: Math.min(24, Math.max(to, from + 1)) };
  });
  private readonly span = computed(() => (this.range().to - this.range().from) * 60);
  /** Position (0–100 %) of a time on the hour axis. */
  private pct(minutes: number) { return ((minutes - this.range().from * 60) / this.span()) * 100; }

  /** Hour ticks across the top; labels every hour, or every 2 hours when the day is long. */
  protected readonly hours = computed(() => {
    const { from, to } = this.range();
    const step = to - from > 14 ? 2 : 1;
    return Array.from({ length: to - from + 1 }, (_, i) => from + i).map((h) => ({ h, pct: this.pct(h * 60), label: (h - from) % step === 0 }));
  });

  protected readonly days = computed(() => {
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
        return { ...s, lane, lanes: 1, ok: canAttend(s, this.gender()), start: this.pct(start), width: this.pct(toMin(s.close)) - this.pct(start) } as PlacedSlot;
      });
      // each slot takes the lane count of the slots it overlaps with
      for (const s of placed) {
        const overlapping = placed.filter((o) => toMin(o.open) < toMin(s.close) && toMin(s.open) < toMin(o.close));
        s.lanes = Math.max(...overlapping.map((o) => o.lane)) + 1;
      }
      const lanes = Math.max(1, ...placed.map((s) => s.lanes));
      return {
        // a row grows when sessions run in parallel, so each stacked session keeps a readable height
        height: Math.max(this.rowPx, lanes * 40),
        day, short: DAY_SHORT[day], today: day === now.getDay(),
        dateLabel: date.toLocaleDateString(CURRENT_LANGUAGE.locale, { day: 'numeric', month: 'short' }),
        closure: closures.find((c) => c.date === isoDate(date))?.reason,
        slots: placed,
      };
    });
  });

  /** Current time on the hour axis (today's row), or null outside the visible hours. */
  protected readonly nowPct = computed(() => {
    const { from, to } = this.range();
    const n = new Date();
    const min = n.getHours() * 60 + n.getMinutes();
    return min < from * 60 || min > to * 60 ? null : this.pct(min);
  });

  pad(h: number) { return String(h % 24).padStart(2, '0'); }
  color(s: ScheduleSlot) { return AUDIENCE[s.audience].color; }
  short(s: ScheduleSlot) { return AUDIENCE[s.audience].short; }
  tip(s: ScheduleSlot) {
    return `${DAY_LABEL[s.day]} ${s.open}–${s.close} · ${AUDIENCE[s.audience].label}${' · ' + (s.sportId ? this.store.sportName(s.sportId) : t('Whole gym'))}${s.note ? ' · ' + s.note : ''}`;
  }
}
