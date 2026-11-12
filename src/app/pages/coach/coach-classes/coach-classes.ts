import { Component, computed, inject, viewChild } from '@angular/core';
import { DatePipe } from '@angular/common';
import { AuthService } from '../../../core/auth.service';
import { TranslatePipe } from '../../../core/i18n/i18n';
import { GymClass } from '../../../core/models';
import { StoreService } from '../../../core/store.service';
import { AudienceTag } from '../../../shared/audience-tag/audience-tag';
import { ClassRoster } from '../../../shared/class-roster/class-roster';
import { PageHeader } from '../../../shared/page-header/page-header';

/** Coach: the classes they teach in the next 7 days, at all their gyms, with rosters. */
@Component({
  selector: 'app-coach-classes',
  imports: [TranslatePipe, DatePipe, AudienceTag, ClassRoster, PageHeader],
  templateUrl: './coach-classes.html',
  styleUrl: './coach-classes.css',
})
export class CoachClasses {
  private readonly auth = inject(AuthService);
  protected readonly store = inject(StoreService);
  protected readonly roster = viewChild.required(ClassRoster);
  protected readonly items = computed(() => {
    const me = this.auth.user()?.id ?? '';
    return this.store.gymsOfCoach(me).flatMap((g) => this.store.upcomingClasses(g.id, 7)).filter((o) => o.cls.coachId === me)
      .sort((a, b) => (a.date + a.cls.start).localeCompare(b.date + b.cls.start));
  });
  occ(c: GymClass, date: string) { return this.store.occupancy(c.id, date); }
}
