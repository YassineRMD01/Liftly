import { UndoService } from '../../../core/undo.service';
import { DatePipe } from '@angular/common';
import { Textarea } from 'primeng/textarea';
import { Component, computed, inject, signal, viewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ConfirmationService } from 'primeng/api';
import { FaIconComponent } from '@fortawesome/angular-fontawesome';
import { Avatar } from 'primeng/avatar';
import { ButtonDirective } from 'primeng/button';
import { SelectButton } from 'primeng/selectbutton';
import { AuthService } from '../../../core/auth.service';
import { TranslatePipe, t } from '../../../core/i18n/i18n';
import { AthleteNote, TrainingPlan } from '../../../core/models';
import { StoreService } from '../../../core/store.service';
import { PageHeader } from '../../../shared/page-header/page-header';
import { PlanEditor } from '../../../shared/plan-editor/plan-editor';
import { PlanView } from '../../../shared/plan-view/plan-view';
import { ProgressView } from '../../../shared/progress-view/progress-view';

/** Coach: their athletes, with workout / nutrition plans and progress for each. */
@Component({
  selector: 'app-coach-athletes',
  imports: [DatePipe, Textarea, TranslatePipe, FormsModule, RouterLink, FaIconComponent, Avatar, ButtonDirective, SelectButton, PageHeader, PlanEditor, PlanView, ProgressView],
  templateUrl: './coach-athletes.html',
  styleUrl: './coach-athletes.css',
})
export class CoachAthletes {
  private readonly undo = inject(UndoService);
  private readonly auth = inject(AuthService);
  protected readonly store = inject(StoreService);
  private readonly confirm = inject(ConfirmationService);
  protected readonly editor = viewChild.required(PlanEditor);
  protected readonly me = computed(() => this.auth.user()?.id ?? '');
  protected readonly athletes = computed(() => this.store.athletesOf(this.me()));
  protected readonly picked = signal<string | null>(null);
  protected readonly current = computed(() => this.store.user(this.picked() ?? this.athletes()[0]?.id));
  protected readonly tab = signal<'plans' | 'progress' | 'notes'>('plans');
  protected readonly tabs = [{ label: t('Plans'), value: 'plans' }, { label: t('Progress'), value: 'progress' }, { label: t('Notes'), value: 'notes' }];
  protected readonly notes = computed(() => (this.current() ? this.store.notesOf(this.me(), this.current()!.id) : []));
  protected noteText = '';
  addNote() {
    const c = this.current();
    if (!c || !this.noteText.trim()) return;
    this.store.saveNote({ id: '', coachId: this.me(), clientId: c.id, date: new Date().toISOString().slice(0, 10), text: this.noteText.trim() });
    this.noteText = '';
  }
  removeNote(n: AthleteNote) { this.undo.run(t('Note deleted'), ['athleteNotes'], () => this.store.deleteNote(n.id)); }
  togglePin(n: AthleteNote) { this.store.saveNote({ ...n, pinned: !n.pinned }); }
  protected readonly plans = computed(() => (this.current() ? this.store.plansOfClient(this.current()!.id).filter((p) => p.coachId === this.me()) : []));

  gymsOf(clientId: string) {
    return this.store.memberships().filter((m) => m.clientId === clientId && m.coachId === this.me() && m.status === 'ACTIVE').map((m) => this.store.gym(m.gymId)?.name).join(', ');
  }
  initials(id: string) { const u = this.store.user(id); return u ? u.firstName[0] + u.lastName[0] : '?'; }
  newPlan(kind: TrainingPlan['kind']) { this.editor().open(this.me(), this.current()!.id, undefined, kind); }
  edit(p: TrainingPlan) { this.editor().open(this.me(), p.clientId, p); }
  remove(p: TrainingPlan) {
    this.undo.run(t('Plan deleted'), ['plans'], () => this.store.deletePlan(p.id), p.title);
  }
}
