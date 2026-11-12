import { Component, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ConfirmationService, MessageService } from 'primeng/api';
import { FaIconComponent } from '@fortawesome/angular-fontawesome';
import { ButtonDirective, ButtonIcon, ButtonLabel } from 'primeng/button';
import { InputText } from 'primeng/inputtext';
import { Select } from 'primeng/select';
import { Tag } from 'primeng/tag';
import { AuthService } from '../../../core/auth.service';
import { MoneyPipe } from '../../../core/currency';
import { CURRENT_LANGUAGE, TranslatePipe, t } from '../../../core/i18n/i18n';
import { PrivateSession } from '../../../core/models';
import { isoDate, toMin } from '../../../core/schedule';
import { StoreService } from '../../../core/store.service';
import { PageHeader } from '../../../shared/page-header/page-header';
import { Stars } from '../../../shared/stars/stars';
import { SESSION_SEV } from '../../coach/coach-sessions/coach-sessions';

/** Member: book a one-to-one session with a coach of their gyms, from the coach's free slots. */
@Component({
  selector: 'app-client-sessions',
  imports: [TranslatePipe, DatePipe, MoneyPipe, FormsModule, FaIconComponent, ButtonDirective, ButtonIcon, ButtonLabel, InputText, Select, Tag, PageHeader, Stars],
  templateUrl: './client-sessions.html',
  styleUrl: './client-sessions.css',
})
export class ClientSessions {
  private readonly auth = inject(AuthService);
  protected readonly store = inject(StoreService);
  private readonly toast = inject(MessageService);
  private readonly confirm = inject(ConfirmationService);
  protected readonly sev = SESSION_SEV;
  protected readonly me = computed(() => this.auth.user()?.id ?? '');

  protected readonly options = computed(() => this.store.coachesForClient(this.me()).map(({ coach, gym }) => ({
    value: `${coach.id}|${gym.id}`, label: `${coach.firstName} ${coach.lastName} · ${gym.name}`,
  })));
  protected readonly pick = signal<string | null>(null);
  protected readonly coachId = computed(() => this.pick()?.split('|')[0] ?? '');
  protected readonly gymId = computed(() => this.pick()?.split('|')[1] ?? '');
  protected readonly profile = computed(() => this.store.coachProfile(this.coachId()));
  protected readonly rating = computed(() => this.store.coachRating(this.coachId()));

  /** Next 14 days with the coach's free slots. */
  protected readonly days = computed(() => {
    if (!this.pick()) return [];
    const f = new Intl.DateTimeFormat(CURRENT_LANGUAGE.locale, { weekday: 'short' });
    return Array.from({ length: 14 }, (_, i) => {
      const d = new Date(); d.setDate(d.getDate() + i);
      const date = isoDate(d);
      return { date, wd: f.format(d), day: d.getDate(), slots: this.store.freeSlots(this.coachId(), this.gymId(), date) };
    });
  });
  protected readonly date = signal<string | null>(null);
  protected readonly selectedDay = computed(() => this.days().find((d) => d.date === this.date()) ?? this.days().find((d) => d.slots.length));
  protected readonly slot = signal<{ start: string; end: string } | null>(null);
  protected note = '';
  protected readonly price = computed(() => {
    const s = this.slot(); const p = this.profile();
    return s && p ? Math.round(p.hourlyRate * (toMin(s.end) - toMin(s.start)) / 60 * 100) / 100 : 0;
  });

  protected readonly mine = computed(() => this.store.sessionsOfClient(this.me()).filter((s) => s.date >= isoDate() && (s.status === 'REQUESTED' || s.status === 'CONFIRMED')));
  protected readonly history = computed(() => this.store.sessionsOfClient(this.me()).filter((s) => !this.mine().includes(s)).reverse().slice(0, 10));

  choose(v: string | null) { this.pick.set(v); this.date.set(null); this.slot.set(null); }
  chooseDay(d: string) { this.date.set(d); this.slot.set(null); }

  request() {
    const s = this.slot(); const day = this.selectedDay();
    if (!s || !day) return;
    const res = this.store.requestSession({ coachId: this.coachId(), clientId: this.me(), gymId: this.gymId(), date: day.date, start: s.start, end: s.end, note: this.note.trim() || undefined });
    if (!res) { this.toast.add({ severity: 'error', summary: t('This slot was just taken. Pick another one.') }); return; }
    this.slot.set(null); this.note = '';
    this.toast.add({ severity: 'success', summary: t('Request sent'), detail: t('You will be notified when the coach confirms.') });
  }

  cancel(s: PrivateSession) {
    this.confirm.confirm({
      header: t('Cancel session'), message: t('Cancel your session with {0}?', { 0: this.store.fullName(s.coachId) }),
      accept: () => this.store.setSessionStatus(s.id, 'CANCELLED', this.me()),
    });
  }
}
