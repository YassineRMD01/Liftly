import { Component, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { MessageService } from 'primeng/api';
import { FaIconComponent } from '@fortawesome/angular-fontawesome';
import { ButtonDirective } from 'primeng/button';
import { Modal } from '../../../shared/modal/modal';
import { InputNumber } from 'primeng/inputnumber';
import { InputText } from 'primeng/inputtext';
import { Select } from 'primeng/select';
import { SelectButton } from 'primeng/selectbutton';
import { Tag } from 'primeng/tag';
import { AuthService } from '../../../core/auth.service';
import { MoneyPipe } from '../../../core/currency';
import { CURRENT_LANGUAGE, TranslatePipe, t } from '../../../core/i18n/i18n';
import { PayoutMethod, PrivateSession, SessionStatus } from '../../../core/models';
import { isoDate, toMin } from '../../../core/schedule';
import { StoreService } from '../../../core/store.service';
import { PageHeader } from '../../../shared/page-header/page-header';
import { downloadIcs } from '../../../core/ics';
import { SESSION_SEV } from '../coach-sessions/coach-sessions';

type AgendaItem = ReturnType<StoreService['coachAgenda']>[number];
const hhmm = (m: number) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;

/** Coach week planner: classes taught at every gym, private sessions and availability, with booking. */
@Component({
  selector: 'app-coach-schedule',
  imports: [TranslatePipe, DatePipe, MoneyPipe, FormsModule, RouterLink, FaIconComponent, ButtonDirective, Modal, InputNumber, InputText, Select, SelectButton, Tag, PageHeader],
  templateUrl: './coach-schedule.html',
  styleUrl: './coach-schedule.css',
})
export class CoachSchedule {
  private readonly auth = inject(AuthService);
  protected readonly store = inject(StoreService);
  private readonly toast = inject(MessageService);
  protected readonly sev = SESSION_SEV;
  protected readonly me = computed(() => this.auth.user()?.id ?? '');
  protected readonly hourPx = 44;

  /** Monday of the displayed week. */
  protected readonly weekStart = signal(this.monday(new Date()));
  protected readonly gymFilter = signal<string | null>(null);
  protected readonly gyms = computed(() => this.store.gymsOfCoach(this.me()));

  protected readonly days = computed(() => Array.from({ length: 7 }, (_, i) => {
    const d = new Date(this.weekStart()); d.setDate(d.getDate() + i);
    return { date: isoDate(d), d, today: isoDate(d) === isoDate() };
  }));
  protected readonly items = computed(() => {
    const ds = this.days();
    return this.store.coachAgenda(this.me(), ds[0].date, ds[6].date).filter((i) => !this.gymFilter() || i.gymId === this.gymFilter());
  });
  protected readonly availability = computed(() => this.store.availabilityOf(this.me()).filter((a) => !this.gymFilter() || a.gymId === this.gymFilter()));
  /** Visible hours: from the earliest to the latest thing in the week (at least 07:00–21:00). */
  protected readonly range = computed(() => {
    const mins = [...this.items().flatMap((i) => [toMin(i.start), toMin(i.end)]), ...this.availability().flatMap((a) => [toMin(a.start), toMin(a.end)])];
    const from = Math.min(7 * 60, ...mins), to = Math.max(21 * 60, ...mins);
    return { from: Math.floor(from / 60) * 60, to: Math.ceil(to / 60) * 60 };
  });
  protected readonly hours = computed(() => { const r = this.range(); return Array.from({ length: (r.to - r.from) / 60 }, (_, i) => hhmm(r.from + i * 60)); });
  protected readonly stats = computed(() => {
    const it = this.items();
    const mins = it.reduce((s, i) => s + toMin(i.end) - toMin(i.start), 0);
    return { classes: it.filter((i) => i.kind === 'CLASS').length, sessions: it.filter((i) => i.kind === 'SESSION').length, hours: Math.round(mins / 6) / 10, requests: it.filter((i) => i.status === 'REQUESTED').length };
  });

  private monday(d: Date) { const x = new Date(d.getFullYear(), d.getMonth(), d.getDate()); x.setDate(x.getDate() - ((x.getDay() + 6) % 7)); return x; }
  /** Download the displayed week (classes + lessons) as a calendar file. */
  exportWeek() {
    downloadIcs(`liftly-week-${this.days()[0].date}`, this.items().map((i) => {
      const g = this.store.gym(i.gymId);
      return { uid: `${i.kind}-${i.id}-${i.date}`, title: `${i.kind === 'CLASS' ? i.title : t('Private session') + ' · ' + i.title} (${g?.name ?? ''})`, date: i.date, start: i.start, end: i.end, location: `${g?.address ?? ''}, ${g?.city ?? ''}` };
    }), 'Liftly coaching');
  }
  shift(weeks: number) { const d = new Date(this.weekStart()); d.setDate(d.getDate() + weeks * 7); this.weekStart.set(d); }
  today() { this.weekStart.set(this.monday(new Date())); }
  itemsOn(date: string) { return this.items().filter((i) => i.date === date); }
  /** Items of each day placed in side-by-side lanes when they overlap (and flagged as clashes). */
  protected readonly laid = computed(() => {
    const out = new Map<string, { item: AgendaItem; lane: number; lanes: number; clash: boolean }[]>();
    for (const d of this.days()) {
      const list = this.itemsOn(d.date);
      const placed: { item: AgendaItem; lane: number; lanes: number; clash: boolean }[] = [];
      let group: typeof placed = [], groupEnd = -1, laneEnds: number[] = [];
      const flush = () => { for (const p of group) { p.lanes = laneEnds.length; p.clash = laneEnds.length > 1; } group = []; laneEnds = []; };
      for (const item of list) {
        const s = toMin(item.start), e = toMin(item.end);
        if (s >= groupEnd) { flush(); groupEnd = -1; }
        let lane = laneEnds.findIndex((end) => end <= s);
        if (lane < 0) { lane = laneEnds.length; laneEnds.push(e); } else laneEnds[lane] = e;
        const p = { item, lane, lanes: 1, clash: false };
        group.push(p); placed.push(p); groupEnd = Math.max(groupEnd, e);
      }
      flush();
      out.set(d.date, placed);
    }
    return out;
  });
  protected readonly clashes = computed(() => [...this.laid().values()].flat().filter((p) => p.clash).length);
  availOn(d: Date) { return this.availability().filter((a) => a.day === d.getDay()); }
  top(time: string) { return ((toMin(time) - this.range().from) / 60) * this.hourPx; }
  height(start: string, end: string) { return Math.max(18, ((toMin(end) - toMin(start)) / 60) * this.hourPx - 2); }
  sevOf(s: string) { return SESSION_SEV[s as SessionStatus]; }
  color(gymId: string) { return this.store.gym(gymId)?.theme.primary ?? '#6366f1'; }
  weekLabel() {
    const f = new Intl.DateTimeFormat(CURRENT_LANGUAGE.locale, { day: 'numeric', month: 'short' });
    return `${f.format(this.days()[0].d)} – ${f.format(this.days()[6].d)} ${this.days()[6].d.getFullYear()}`;
  }

  // ---------- details ----------
  protected readonly selected = signal<AgendaItem | null>(null);
  protected readonly session = computed(() => { const s = this.selected(); return s?.kind === 'SESSION' ? this.store.sessions().find((x) => x.id === s.id) : undefined; });
  protected readonly cls = computed(() => { const s = this.selected(); return s?.kind === 'CLASS' ? this.store.gymClass(s.id) : undefined; });
  open(i: AgendaItem, ev?: Event) { ev?.stopPropagation(); this.selected.set(i); this.moving.set(null); }
  closeDetails(v: boolean) { if (!v) this.selected.set(null); }
  setStatus(s: PrivateSession, status: SessionStatus) { this.store.setSessionStatus(s.id, status, this.me()); this.toast.add({ severity: 'success', summary: t(status), life: 1500 }); if (status === 'CANCELLED' || status === 'DECLINED') this.selected.set(null); }
  markPaid(s: PrivateSession, method: PayoutMethod) { this.store.markSessionPaid(s.id, method); this.toast.add({ severity: 'success', summary: t('Marked as paid'), detail: t(method === 'CASH' ? 'Cash' : 'Bank transfer'), life: 1500 }); }
  /** Reschedule form */
  protected readonly moving = signal<{ date: string; start: string; end: string } | null>(null);
  startMove(s: PrivateSession) { this.moving.set({ date: s.date, start: s.start, end: s.end }); }
  confirmMove(s: PrivateSession) {
    const m = this.moving()!;
    const r = this.store.rescheduleSession(s.id, m.date, m.start, m.end);
    if (!r.ok) { this.toast.add({ severity: 'error', summary: t(r.reason) }); return; }
    this.toast.add({ severity: 'success', summary: t('Session moved') });
    this.moving.set(null); this.selected.set(null);
  }

  // ---------- new private lesson ----------
  protected readonly creating = signal<{ clientId: string | null; gymId: string | null; date: string; start: string; minutes: number; price: number | null; note: string } | null>(null);
  protected readonly lengths = [30, 45, 60, 90].map((m) => ({ value: m, label: `${m} min` }));
  /** Members the coach can book: members of the gyms they work at (their athletes first). */
  protected readonly clients = computed(() => {
    const athletes = new Set(this.store.athletesOf(this.me()).map((a) => a.id));
    const ids = new Set(this.gyms().flatMap((g) => this.store.clientsOfGym(g.id).filter((c) => this.store.clientStatus(g.id, c.id) === 'ACTIVE').map((c) => c.id)));
    return this.store.users().filter((u) => ids.has(u.id)).map((u) => ({ value: u.id, label: `${u.firstName} ${u.lastName}${athletes.has(u.id) ? ' ★' : ''}`, athlete: athletes.has(u.id) }))
      .sort((a, b) => Number(b.athlete) - Number(a.athlete) || a.label.localeCompare(b.label));
  });
  gymsFor(clientId: string | null) {
    if (!clientId) return [];
    return this.gyms().filter((g) => this.store.clientStatus(g.id, clientId) === 'ACTIVE').map((g) => ({ value: g.id, label: g.name }));
  }
  defaultPrice(minutes: number) { const p = this.store.coachProfile(this.me()); return p ? Math.round(p.hourlyRate * minutes / 60 * 100) / 100 : 0; }
  newLesson(date?: string, start?: string) {
    const d = date ?? (this.days().find((x) => x.date >= isoDate())?.date ?? this.days()[0].date);
    this.creating.set({ clientId: null, gymId: this.gymFilter(), date: d, start: start ?? '10:00', minutes: 60, price: this.defaultPrice(60), note: '' });
  }
  /** Click in an empty part of a day column: pre-fill the clicked half hour. */
  onColumnClick(date: string, ev: MouseEvent) {
    const rect = (ev.currentTarget as HTMLElement).getBoundingClientRect();
    const mins = this.range().from + Math.floor(((ev.clientY - rect.top) / this.hourPx) * 2) * 30;
    this.newLesson(date, hhmm(Math.max(0, Math.min(mins, 23 * 60))));
  }
  closeCreate(v: boolean) { if (!v) this.creating.set(null); }
  patch(p: Partial<NonNullable<ReturnType<typeof this.creating>>>) {
    const c = this.creating()!;
    const next = { ...c, ...p };
    if (p.minutes && c.price === this.defaultPrice(c.minutes)) next.price = this.defaultPrice(p.minutes);
    if (p.clientId !== undefined) { const gs = this.gymsFor(p.clientId); if (!gs.some((g) => g.value === next.gymId)) next.gymId = gs[0]?.value ?? null; }
    this.creating.set(next);
  }
  createLesson() {
    const c = this.creating()!;
    if (!c.clientId || !c.gymId) { this.toast.add({ severity: 'error', summary: t('Choose a member and a gym.') }); return; }
    const end = hhmm(toMin(c.start) + c.minutes);
    const r = this.store.scheduleSession({ coachId: this.me(), clientId: c.clientId, gymId: c.gymId, date: c.date, start: c.start, end, note: c.note.trim() || undefined, price: c.price ?? undefined });
    if (!r.ok) { this.toast.add({ severity: 'error', summary: t(r.reason) }); return; }
    this.toast.add({ severity: 'success', summary: t('Lesson scheduled'), detail: t('{0} was notified.', { 0: this.store.fullName(c.clientId) }) });
    this.creating.set(null);
    this.weekStart.set(this.monday(new Date(c.date + 'T00:00:00')));
  }
}
