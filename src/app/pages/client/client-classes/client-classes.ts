import { Rating } from 'primeng/rating';
import { Textarea } from 'primeng/textarea';
import { Tooltip } from 'primeng/tooltip';
import { Modal } from '../../../shared/modal/modal';
import { IcsEvent, downloadIcs } from '../../../core/ics';
import { isoDate } from '../../../core/schedule';
import { Component, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MessageService } from 'primeng/api';
import { FaIconComponent } from '@fortawesome/angular-fontawesome';
import { ButtonDirective } from 'primeng/button';
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
  imports: [TranslatePipe, DatePipe, FormsModule, FaIconComponent, ButtonDirective, Rating, SelectButton, Tag, Textarea, Tooltip, AudienceTag, Modal, PageHeader],
  templateUrl: './client-classes.html',
  styleUrl: './client-classes.css',
})
export class ClientClasses {
  private readonly auth = inject(AuthService);
  protected readonly store = inject(StoreService);
  private readonly toast = inject(MessageService);
  protected readonly level = LEVEL_LABEL;
  protected readonly me = computed(() => this.auth.user()?.id ?? '');
  protected readonly view = signal<'browse' | 'mine' | 'past'>('browse');
  protected readonly views = [{ label: t('Browse classes'), value: 'browse' }, { label: t('My bookings'), value: 'mine' }, { label: t('Attended'), value: 'past' }];
  /** Show only starred classes. */
  protected readonly onlyFavorites = signal(false);

  /** Next 7 days of classes at the member's gyms, grouped by date. */
  protected readonly days = computed(() => {
    const gyms = this.store.gymsOfClient(this.me()).filter((g) => this.store.clientStatus(g.id, this.me()) !== 'BANNED');
    const fav = (id: string) => this.store.isFavoriteClass(this.me(), id);
    const all = gyms.flatMap((g) => this.store.upcomingClasses(g.id, 7)).filter((o) => !this.store.started(o.cls, o.date) && (!this.onlyFavorites() || fav(o.cls.id)))
      // favourites first within each day
      .sort((a, b) => a.date.localeCompare(b.date) || Number(fav(b.cls.id)) - Number(fav(a.cls.id)) || a.cls.start.localeCompare(b.cls.start));
    const byDate = new Map<string, typeof all>();
    for (const o of all) byDate.set(o.date, [...(byDate.get(o.date) ?? []), o]);
    return [...byDate.entries()].map(([date, items]) => ({ date, items }));
  });
  protected readonly mine = computed(() => {
    const today = new Date().toISOString().slice(0, 10);
    return this.store.bookingsOfClient(this.me()).filter((b) => b.status !== 'CANCELLED' && b.date >= today);
  });

  /** Classes attended in the last 60 days (to rate them). */
  protected readonly past = computed(() => {
    const from = isoDate(new Date(Date.now() - 60 * 86400000));
    return this.store.bookingsOfClient(this.me()).filter((b) => b.status === 'ATTENDED' && b.date >= from).reverse();
  });
  fav(c: GymClass) { return this.store.isFavoriteClass(this.me(), c.id); }
  toggleFav(c: GymClass) { this.store.toggleFavoriteClass(this.me(), c.id); }
  rating(c: GymClass) { return this.store.classSeriesRating(c.gymId, c.name); }
  myReview(b: ClassBooking) { return this.store.myClassReview(b.classId, b.date, this.me()); }

  // ---------- rate a class ----------
  protected readonly rating$ = signal<{ booking: ClassBooking; stars: number; comment: string } | null>(null);
  rate(b: ClassBooking) { const r = this.myReview(b); this.rating$.set({ booking: b, stars: r?.rating ?? 5, comment: r?.comment ?? '' }); }
  closeRate(v: boolean) { if (!v) this.rating$.set(null); }
  saveRating() {
    const r = this.rating$();
    if (!r) return;
    this.store.reviewClass(r.booking.classId, r.booking.date, this.me(), r.stars, r.comment.trim() || undefined);
    this.toast.add({ severity: 'success', summary: t('Thanks for your rating!'), life: 1500 });
    this.rating$.set(null);
  }

  // ---------- calendar ----------
  exportCalendar(list: ClassBooking[] = this.mine().filter((b) => b.status === 'BOOKED')) {
    const events: IcsEvent[] = list.flatMap((b) => {
      const c = this.store.gymClass(b.classId);
      if (!c) return [];
      const g = this.store.gym(c.gymId);
      const loc = this.store.location(c.gymId, c.locationId);
      return [{ uid: b.id, title: `${c.name} · ${g?.name ?? ''}`, date: b.date, start: c.start, end: c.end, location: loc ? `${loc.name}, ${loc.address}, ${loc.city}` : `${g?.address ?? ''}, ${g?.city ?? ''}`, description: [c.room, c.coachId ? this.store.fullName(c.coachId) : ''].filter(Boolean).join(' · ') }];
    });
    if (!events.length) { this.toast.add({ severity: 'info', summary: t('No booked class to export.') }); return; }
    downloadIcs(list.length === 1 ? `class-${list[0].date}` : 'liftly-classes', events, 'Liftly classes');
  }

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
