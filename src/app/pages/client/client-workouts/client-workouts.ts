import { UndoService } from '../../../core/undo.service';
import { Component, computed, inject, signal } from '@angular/core';
import { DatePipe, DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ConfirmationService, MessageService } from 'primeng/api';
import { FaIconComponent } from '@fortawesome/angular-fontawesome';
import { ButtonDirective } from 'primeng/button';
import { InputNumber } from 'primeng/inputnumber';
import { InputText } from 'primeng/inputtext';
import { Select } from 'primeng/select';
import { Tooltip } from 'primeng/tooltip';
import { AuthService } from '../../../core/auth.service';
import { CURRENT_LANGUAGE, TranslatePipe, t } from '../../../core/i18n/i18n';
import { WorkoutLog } from '../../../core/models';
import { isoDate } from '../../../core/schedule';
import { StoreService } from '../../../core/store.service';
import { ChartCard, ChartSeries } from '../../../shared/chart-card/chart-card';
import { Modal } from '../../../shared/modal/modal';
import { PageHeader } from '../../../shared/page-header/page-header';

/** Member workout log: sessions with sets × reps × weight, personal records and progress per exercise. */
@Component({
  selector: 'app-client-workouts',
  imports: [TranslatePipe, DatePipe, DecimalPipe, FormsModule, FaIconComponent, ButtonDirective, InputNumber, InputText, Select, Tooltip, ChartCard, Modal, PageHeader],
  templateUrl: './client-workouts.html',
  styleUrl: './client-workouts.css',
})
export class ClientWorkouts {
  private readonly undo = inject(UndoService);
  private readonly auth = inject(AuthService);
  protected readonly store = inject(StoreService);
  private readonly toast = inject(MessageService);
  private readonly confirm = inject(ConfirmationService);
  protected readonly me = computed(() => this.auth.user()?.id ?? '');
  protected readonly logs = computed(() => this.store.workoutsOf(this.me()));
  protected readonly records = computed(() => this.store.personalRecords(this.me()));
  protected readonly exercises = computed(() => this.store.exercisesOf(this.me()));
  protected readonly plans = computed(() => this.store.plansOfClient(this.me()).filter((p) => p.kind === 'WORKOUT'));
  protected readonly thisMonth = computed(() => this.logs().filter((w) => w.date.slice(0, 7) === isoDate().slice(0, 7)).length);
  protected readonly totalVolume = computed(() => this.logs().filter((w) => w.date.slice(0, 7) === isoDate().slice(0, 7)).reduce((s, w) => s + this.volume(w), 0));

  // progress chart
  protected readonly exercise = signal<string | null>(null);
  protected readonly selectedExercise = computed(() => this.exercise() ?? this.records()[0]?.exercise ?? null);
  protected readonly history = computed(() => (this.selectedExercise() ? this.store.exerciseHistory(this.me(), this.selectedExercise()!) : []));
  protected readonly chart = computed(() => {
    const f = new Intl.DateTimeFormat(CURRENT_LANGUAGE.locale, { day: 'numeric', month: 'short' });
    const h = this.history();
    return { labels: h.map((x) => f.format(new Date(x.date + 'T00:00:00'))), series: [{ label: t('Estimated 1RM'), data: h.map((x) => x.e1rm) }, { label: t('Best set'), data: h.map((x) => x.weight) }] as ChartSeries[] };
  });
  protected readonly kg = (v: number) => `${new Intl.NumberFormat(CURRENT_LANGUAGE.locale, { maximumFractionDigits: 1 }).format(v)} kg`;

  volume(w: WorkoutLog) { return w.entries.reduce((s, e) => s + e.sets.reduce((v, x) => v + x.reps * x.weight, 0), 0); }
  summary(e: WorkoutLog['entries'][number]) {
    const top = e.sets.reduce((a, b) => (b.weight > a.weight ? b : a), e.sets[0]);
    return `${e.sets.length} × ${top?.reps ?? 0}${top?.weight ? ' @ ' + top.weight + ' kg' : ''}`;
  }

  // ---------- log dialog ----------
  protected readonly editing = signal<WorkoutLog | null>(null);
  protected readonly planId = signal<string | null>(null);
  protected readonly groups = computed(() => {
    const p = this.plans().find((x) => x.id === this.planId());
    return p ? [...new Set(p.items.map((i) => i.group))].map((g) => ({ value: g, label: g })) : [];
  });
  open(w?: WorkoutLog) {
    this.planId.set(w?.planId ?? this.plans()[0]?.id ?? null);
    this.editing.set(w ? structuredClone(w) : { id: '', clientId: this.me(), date: isoDate(), title: t('Workout'), entries: [{ exercise: '', sets: [{ reps: 8, weight: 0 }] }], createdAt: '' });
  }
  close(v: boolean) { if (!v) this.editing.set(null); }
  /** Fill the workout with one day of the plan (last weights used for each exercise). */
  usePlanDay(group: string) {
    const p = this.plans().find((x) => x.id === this.planId());
    const w = this.editing();
    if (!p || !w) return;
    const items = p.items.filter((i) => i.group === group);
    const entries = items.map((i) => {
      const m = /(\d+)\s*[×x]\s*(\d+)/.exec(i.detail ?? '');
      const sets = m ? +m[1] : 3, reps = m ? +m[2] : 8;
      const last = this.store.exerciseHistory(this.me(), i.name).at(-1);
      return { exercise: i.name, itemId: i.id, sets: Array.from({ length: sets }, () => ({ reps, weight: last?.weight ?? 0 })) };
    });
    this.editing.set({ ...w, title: group, planId: p.id, entries });
  }
  addExercise() { const w = this.editing()!; this.editing.set({ ...w, entries: [...w.entries, { exercise: '', sets: [{ reps: 8, weight: 0 }] }] }); }
  removeExercise(i: number) { const w = this.editing()!; this.editing.set({ ...w, entries: w.entries.filter((_, k) => k !== i) }); }
  addSet(i: number) {
    const w = this.editing()!;
    const e = w.entries[i];
    const last = e.sets.at(-1) ?? { reps: 8, weight: 0 };
    this.editing.set({ ...w, entries: w.entries.map((x, k) => (k === i ? { ...x, sets: [...x.sets, { ...last }] } : x)) });
  }
  removeSet(i: number, j: number) { const w = this.editing()!; this.editing.set({ ...w, entries: w.entries.map((x, k) => (k === i ? { ...x, sets: x.sets.filter((_, n) => n !== j) } : x)) }); }
  save() {
    const w = this.editing();
    if (!w) return;
    const entries = w.entries.map((e) => ({ ...e, exercise: e.exercise.trim(), sets: e.sets.filter((s) => s.reps > 0) })).filter((e) => e.exercise && e.sets.length);
    if (!entries.length) { this.toast.add({ severity: 'error', summary: t('Add at least one exercise with a set.') }); return; }
    const before = new Map(this.records().map((r) => [r.exercise, r.e1rm]));
    this.store.saveWorkout({ ...w, title: w.title.trim() || t('Workout'), entries });
    const newPrs = this.store.personalRecords(this.me()).filter((r) => r.e1rm > (before.get(r.exercise) ?? Infinity)).map((r) => r.exercise);
    this.toast.add({ severity: 'success', summary: newPrs.length ? t('New personal record!') : t('Workout saved'), detail: newPrs.join(', ') || undefined });
    this.editing.set(null);
  }
  remove(w: WorkoutLog) {
    this.undo.run(t('Workout deleted'), ['workouts'], () => this.store.deleteWorkout(w.id), w.title);
  }
}
