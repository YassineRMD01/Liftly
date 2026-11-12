import { Component, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { MessageService } from 'primeng/api';
import { FaIconComponent } from '@fortawesome/angular-fontawesome';
import { Button } from 'primeng/button';
import { Dialog } from 'primeng/dialog';
import { Tag } from 'primeng/tag';
import { Tooltip } from 'primeng/tooltip';
import { TranslatePipe, t } from '../../core/i18n/i18n';
import { BookingStatus, ClassBooking, GymClass } from '../../core/models';
import { StoreService } from '../../core/store.service';

/** Roster of one class occurrence: booked members and the waitlist, with attendance actions. */
@Component({
  selector: 'app-class-roster',
  imports: [TranslatePipe, DatePipe, FaIconComponent, Button, Dialog, Tag, Tooltip],
  templateUrl: './class-roster.html',
  styleUrl: './class-roster.css',
})
export class ClassRoster {
  protected readonly store = inject(StoreService);
  private readonly toast = inject(MessageService);
  /** Signals: opened from list rows (zoneless). */
  protected readonly current = signal<{ cls: GymClass; date: string } | null>(null);
  protected readonly list = computed(() => {
    const c = this.current();
    return c ? this.store.bookingsOf(c.cls.id, c.date).filter((b) => b.status !== 'CANCELLED') : [];
  });
  protected readonly booked = computed(() => this.list().filter((b) => b.status !== 'WAITLIST'));
  protected readonly waitlist = computed(() => this.list().filter((b) => b.status === 'WAITLIST'));

  open(cls: GymClass, date: string) { this.current.set({ cls, date }); }
  close(visible: boolean) { if (!visible) this.current.set(null); }

  set(b: ClassBooking, status: BookingStatus) { this.store.setBookingStatus(b.id, status); }
  remove(b: ClassBooking) {
    this.store.cancelBooking(b.id);
    this.toast.add({ severity: 'info', summary: t('Removed from the class'), detail: this.store.fullName(b.clientId) });
  }
  sev(s: BookingStatus) { return ({ BOOKED: 'info', ATTENDED: 'success', NO_SHOW: 'danger', WAITLIST: 'warn', CANCELLED: 'secondary' } as const)[s]; }
}
