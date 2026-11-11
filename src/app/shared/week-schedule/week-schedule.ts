import { TranslatePipe } from '../../core/i18n/i18n';
import { Component, computed, inject, input } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FaIconComponent } from '@fortawesome/angular-fontawesome';
import { Tooltip } from 'primeng/tooltip';
import { Gender, ScheduleSlot } from '../../core/models';
import { AUDIENCE, DAY_LABEL, DAY_SHORT, WEEK, canAttend, toMin } from '../../core/schedule';
import { StoreService } from '../../core/store.service';
import { AudienceTag } from '../audience-tag/audience-tag';

/**
 * Read-only weekly timetable: a compact grid (days on the x-axis, hours on the y-axis)
 * followed by the sessions of each day as a list.
 */
@Component({
  selector: 'app-week-schedule',
  imports: [TranslatePipe, DatePipe, FaIconComponent, Tooltip, AudienceTag],
  templateUrl: './week-schedule.html',
  styleUrl: './week-schedule.css',
})
export class WeekSchedule {
  protected readonly store = inject(StoreService);
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

  /** Visible hours: earliest opening → latest closing (06–22 when the gym has no sessions). */
  protected readonly range = computed(() => {
    const all = this.store.scheduleOfGym(this.gymId());
    if (!all.length) return { from: 6, to: 22 };
    const from = Math.floor(Math.min(...all.map((s) => toMin(s.open))) / 60);
    const to = Math.ceil(Math.max(...all.map((s) => toMin(s.close))) / 60);
    return { from, to: Math.max(to, from + 1) };
  });
  /** Hour labels on the y-axis (every 2 hours). */
  protected readonly ticks = computed(() => {
    const { from, to } = this.range();
    const out: { label: string; pct: number }[] = [];
    for (let h = from; h <= to; h += 2) out.push({ label: `${String(h).padStart(2, '0')}:00`, pct: ((h - from) / (to - from)) * 100 });
    return out;
  });
  /** Days on the x-axis with their sessions placed by time; parallel sessions share the column side by side. */
  protected readonly grid = computed(() => {
    const { from, to } = this.range();
    const span = (to - from) * 60;
    return this.days().map((d) => {
      const sorted = [...d.slots].sort((a, b) => a.open.localeCompare(b.open));
      const laneEnds: number[] = [];
      const placed = sorted.map((s) => {
        const start = toMin(s.open);
        let lane = laneEnds.findIndex((end) => end <= start);
        if (lane === -1) { lane = laneEnds.length; laneEnds.push(0); }
        laneEnds[lane] = toMin(s.close);
        return { ...s, lane, lanes: 1, top: ((start - from * 60) / span) * 100, height: ((toMin(s.close) - start) / span) * 100 };
      });
      for (const s of placed) {
        const overlapping = placed.filter((o) => toMin(o.open) < toMin(s.close) && toMin(s.open) < toMin(o.close));
        s.lanes = Math.max(...overlapping.map((o) => o.lane)) + 1;
      }
      return { day: d.day, short: DAY_SHORT[d.day], today: d.today, slots: placed };
    });
  });

  color(s: ScheduleSlot) { return AUDIENCE[s.audience].color; }
  label(s: ScheduleSlot) { return AUDIENCE[s.audience].label + (s.sportId ? ' · ' + this.store.sportName(s.sportId) : ''); }
}
