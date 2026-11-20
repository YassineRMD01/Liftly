import { Component, computed, inject, signal } from '@angular/core';
import { DatePipe, DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MessageService } from 'primeng/api';
import { FaIconComponent } from '@fortawesome/angular-fontawesome';
import { ButtonDirective } from 'primeng/button';
import { InputText } from 'primeng/inputtext';
import { Select } from 'primeng/select';
import { AuthService } from '../../../core/auth.service';
import { CURRENT_LANGUAGE, TranslatePipe, t } from '../../../core/i18n/i18n';
import { StaffShift, User } from '../../../core/models';
import { isoDate } from '../../../core/schedule';
import { StoreService } from '../../../core/store.service';
import { Modal } from '../../../shared/modal/modal';
import { PageHeader } from '../../../shared/page-header/page-header';

/** Weekly shift planner for front-desk staff (admins edit; staff see their own shifts). */
@Component({
  selector: 'app-admin-shifts',
  imports: [TranslatePipe, DatePipe, DecimalPipe, FormsModule, FaIconComponent, ButtonDirective, InputText, Select, Modal, PageHeader],
  templateUrl: './admin-shifts.html',
  styleUrl: './admin-shifts.css',
})
export class AdminShifts {
  private readonly auth = inject(AuthService);
  protected readonly store = inject(StoreService);
  private readonly toast = inject(MessageService);
  protected readonly gym = this.auth.activeGym;
  protected readonly canEdit = computed(() => this.auth.role() === 'ADMIN');
  protected readonly weekStart = signal(this.monday(new Date()));
  protected readonly days = computed(() => Array.from({ length: 7 }, (_, i) => { const d = new Date(this.weekStart()); d.setDate(d.getDate() + i); return { date: isoDate(d), d, today: isoDate(d) === isoDate() }; }));
  /** Staff of the gym (staff users only see themselves). */
  protected readonly people = computed<User[]>(() => {
    const g = this.gym();
    if (!g) return [];
    const all = this.store.staffOfGym(g.id);
    return this.canEdit() ? all : all.filter((u) => u.id === this.auth.user()?.id);
  });
  protected readonly week = computed(() => this.store.shiftsOf(this.gym()?.id ?? '', this.days()[0].date, this.days()[6].date));
  protected readonly hours = computed(() => this.store.shiftHours(this.week()));
  protected readonly locations = computed(() => this.store.locationsOf(this.gym()?.id ?? ''));

  private monday(d: Date) { const x = new Date(d.getFullYear(), d.getMonth(), d.getDate()); x.setDate(x.getDate() - ((x.getDay() + 6) % 7)); return x; }
  shift(n: number) { const d = new Date(this.weekStart()); d.setDate(d.getDate() + n * 7); this.weekStart.set(d); }
  cell(userId: string, date: string) { return this.week().filter((s) => s.userId === userId && s.date === date); }
  weekLabel() { const f = new Intl.DateTimeFormat(CURRENT_LANGUAGE.locale, { day: 'numeric', month: 'short' }); return `${f.format(this.days()[0].d)} – ${f.format(this.days()[6].d)}`; }
  locName(id?: string) { return id ? this.store.location(this.gym()!.id, id)?.name : ''; }

  protected readonly editing = signal<StaffShift | null>(null);
  open(userId: string, date: string, s?: StaffShift) {
    if (!this.canEdit()) return;
    this.editing.set(s ? { ...s } : { id: '', gymId: this.gym()!.id, userId, date, start: '08:00', end: '16:00', locationId: this.locations()[0]?.id });
  }
  save() {
    const s = this.editing();
    if (!s) return;
    const r = this.store.saveShift(s);
    if (!r.ok) { this.toast.add({ severity: 'error', summary: t(r.reason) }); return; }
    this.editing.set(null);
  }
  remove() { const s = this.editing(); if (s?.id) { this.store.deleteShift(s.id); this.editing.set(null); } }
  copyWeek() {
    const n = this.store.copyShiftsWeek(this.gym()!.id, this.days()[0].date);
    this.toast.add({ severity: n ? 'success' : 'info', summary: n ? t('{n} shifts copied to next week', { n }) : t('Nothing to copy (or next week is already planned).') });
    if (n) this.shift(1);
  }
}
