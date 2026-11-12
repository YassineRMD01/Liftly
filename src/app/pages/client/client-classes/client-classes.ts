import { Component, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MessageService } from 'primeng/api';
import { FaIconComponent } from '@fortawesome/angular-fontawesome';
import { ButtonDirective, ButtonLabel } from 'primeng/button';
import { SelectButton } from 'primeng/selectbutton';
import { Tag } from 'primeng/tag';
import { AuthService } from '../../../core/auth.service';
import { TranslatePipe, t } from '../../../core/i18n/i18n';
import { ClassBooking, GymClass } from '../../../core/models';
import { StoreService } from '../../../core/store.service';
import { AudienceTag } from '../../../shared/audience-tag/audience-tag';
import { PageHeader } from '../../../shared/page-header/page-header';

export const LEVEL_LABEL: Record<GymClass['level'], string> = {
  ALL: t('All levels'), BEGINNER: t('Beginner'), INTERMEDIATE: t('Intermediate'), ADVANCED: t('Advanced'),
};

/** Member: book classes at their gyms (next 7 days), join waitlists, cancel. */
@Component({
  selector: 'app-client-classes',
  imports: [TranslatePipe, DatePipe, FormsModule, FaIconComponent, ButtonDirective, ButtonLabel, SelectButton, Tag, AudienceTag, PageHeader],
  templateUrl: './client-classes.html',
  styleUrl: './client-classes.css',
})
export class ClientClasses {
  private readonly auth = inject(AuthService);
  protected readonly store = inject(StoreService);
  private readonly toast = inject(MessageService);
  protected readonly level = LEVEL_LABEL;
  protected readonly me = computed(() => this.auth.user()?.id ?? '');
  protected readonly view = signal<'browse' | 'mine'>('browse');
  protected readonly views = [{ label: t('Browse classes'), value: 'browse' }, { label: t('My bookings'), value: 'mine' }];

  /** Next 7 days of classes at the member's gyms, grouped by date. */
  protected readonly days = computed(() => {
    const gyms = this.store.gymsOfClient(this.me()).filter((g) => this.store.clientStatus(g.id, this.me()) !== 'BANNED');
    const all = gyms.flatMap((g) => this.store.upcomingClasses(g.id, 7)).filter((o) => !this.store.started(o.cls, o.date))
      .sort((a, b) => (a.date + a.cls.start).localeCompare(b.date + b.cls.start));
    const byDate = new Map<string, typeof all>();
    for (const o of all) byDate.set(o.date, [...(byDate.get(o.date) ?? []), o]);
    return [...byDate.entries()].map(([date, items]) => ({ date, items }));
  });
  protected readonly mine = computed(() => {
    const today = new Date().toISOString().slice(0, 10);
    return this.store.bookingsOfClient(this.me()).filter((b) => b.status !== 'CANCELLED' && b.date >= today);
  });

  occ(c: GymClass, date: string) { return this.store.occupancy(c.id, date); }
  booking(c: GymClass, date: string) { return this.store.myBooking(c.id, date, this.me()); }
  check(c: GymClass, date: string) { return this.store.canBook(c, date, this.me()); }
  waitPosition(b: ClassBooking) { return this.store.bookingsOf(b.classId, b.date).filter((x) => x.status === 'WAITLIST').findIndex((x) => x.id === b.id) + 1; }

  book(c: GymClass, date: string) {
    const b = this.store.book(c.id, date, this.me());
    if (!b) return;
    this.toast.add(b.status === 'BOOKED'
      ? { severity: 'success', summary: t('Booked'), detail: `${c.name} · ${date} ${c.start}` }
      : { severity: 'info', summary: t('Added to the waitlist'), detail: t('You will be notified if a place opens up.') });
  }

  cancel(b: ClassBooking) {
    this.store.cancelBooking(b.id);
    this.toast.add({ severity: 'info', summary: b.status === 'WAITLIST' ? t('Left the waitlist') : t('Booking cancelled') });
  }
}
