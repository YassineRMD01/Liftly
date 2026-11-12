import { Component, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MessageService } from 'primeng/api';
import { FaIconComponent } from '@fortawesome/angular-fontawesome';
import { Button } from 'primeng/button';
import { InputText } from 'primeng/inputtext';
import { Select } from 'primeng/select';
import { SelectButton } from 'primeng/selectbutton';
import { Tag } from 'primeng/tag';
import { Tooltip } from 'primeng/tooltip';
import { AuthService } from '../../../core/auth.service';
import { MoneyPipe } from '../../../core/currency';
import { TranslatePipe, t } from '../../../core/i18n/i18n';
import { PrivateSession, SessionStatus } from '../../../core/models';
import { DAY_LABEL, WEEK, isoDate, toMin } from '../../../core/schedule';
import { StoreService } from '../../../core/store.service';
import { PageHeader } from '../../../shared/page-header/page-header';

export const SESSION_SEV: Record<SessionStatus, 'warn' | 'success' | 'danger' | 'secondary' | 'info'> = { REQUESTED: 'warn', CONFIRMED: 'success', DECLINED: 'danger', CANCELLED: 'secondary', DONE: 'info' };

/** Coach: weekly availability for private sessions per gym, and the session requests to handle. */
@Component({
  selector: 'app-coach-sessions',
  imports: [TranslatePipe, DatePipe, MoneyPipe, FormsModule, FaIconComponent, Button, InputText, Select, SelectButton, Tag, Tooltip, PageHeader],
  templateUrl: './coach-sessions.html',
  styleUrl: './coach-sessions.css',
})
export class CoachSessions {
  private readonly auth = inject(AuthService);
  protected readonly store = inject(StoreService);
  private readonly toast = inject(MessageService);
  protected readonly sev = SESSION_SEV;
  protected readonly dayLabel = DAY_LABEL;
  protected readonly days = WEEK.map((d) => ({ value: d, label: DAY_LABEL[d] }));
  protected readonly lengths = [30, 45, 60, 90].map((m) => ({ value: m, label: `${m} min` }));
  protected readonly me = computed(() => this.auth.user()?.id ?? '');
  protected readonly gyms = computed(() => this.store.gymsOfCoach(this.me()));
  protected readonly gymId = signal<string>('');
  protected readonly gym = computed(() => this.gymId() || this.gyms()[0]?.id || '');
  protected readonly windows = computed(() => this.store.availabilityOf(this.me(), this.gym()));
  protected form = { day: 1, start: '10:00', end: '12:00', slotMin: 60 };

  protected readonly tab = signal<'requests' | 'upcoming' | 'past'>('requests');
  protected readonly all = computed(() => this.store.sessionsOfCoach(this.me()));
  protected readonly requests = computed(() => this.all().filter((s) => s.status === 'REQUESTED' && s.date >= isoDate()));
  protected readonly upcoming = computed(() => this.all().filter((s) => s.status === 'CONFIRMED' && s.date >= isoDate()));
  protected readonly past = computed(() => this.all().filter((s) => s.date < isoDate() || s.status === 'DONE' || s.status === 'DECLINED' || s.status === 'CANCELLED').reverse());
  protected readonly tabs = computed(() => [
    { value: 'requests', label: `${t('Requests')} (${this.requests().length})` },
    { value: 'upcoming', label: `${t('Upcoming')} (${this.upcoming().length})` },
    { value: 'past', label: t('History') },
  ]);
  protected readonly shown = computed(() => ({ requests: this.requests(), upcoming: this.upcoming(), past: this.past() })[this.tab()]);

  addWindow() {
    if (toMin(this.form.end) - toMin(this.form.start) < this.form.slotMin) {
      this.toast.add({ severity: 'error', summary: t('The window is shorter than one session.') });
      return;
    }
    this.store.saveAvailability({ id: '', coachId: this.me(), gymId: this.gym(), ...this.form });
    this.toast.add({ severity: 'success', summary: t('Availability added'), life: 1500 });
  }

  set(s: PrivateSession, status: SessionStatus) {
    this.store.setSessionStatus(s.id, status, this.me());
    this.toast.add({ severity: 'success', summary: t(status), detail: this.store.fullName(s.clientId), life: 1800 });
  }
  slotCount(w: { start: string; end: string; slotMin: number }) { return Math.floor((toMin(w.end) - toMin(w.start)) / w.slotMin); }
}
