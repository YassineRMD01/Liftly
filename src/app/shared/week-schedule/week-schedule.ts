import { Component, computed, inject, input } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FaIconComponent } from '@fortawesome/angular-fontawesome';
import { Tooltip } from 'primeng/tooltip';
import { Gender, ScheduleSlot } from '../../core/models';
import { AUDIENCE, DAY_LABEL, WEEK, canAttend, toMin } from '../../core/schedule';
import { StoreService } from '../../core/store.service';
import { AudienceTag } from '../audience-tag/audience-tag';

/** Read-only weekly timetable with a 24h timeline per day. */
@Component({
  selector: 'app-week-schedule',
  imports: [DatePipe, FaIconComponent, Tooltip, AudienceTag],
  templateUrl: './week-schedule.html',
  styleUrl: './week-schedule.css',
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
