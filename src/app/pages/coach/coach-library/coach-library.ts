import { UndoService } from '../../../core/undo.service';
import { Component, computed, inject, signal, viewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ConfirmationService, MessageService } from 'primeng/api';
import { FaIconComponent } from '@fortawesome/angular-fontawesome';
import { ButtonDirective } from 'primeng/button';
import { IconField } from 'primeng/iconfield';
import { InputIcon } from 'primeng/inputicon';
import { InputText } from 'primeng/inputtext';
import { Select } from 'primeng/select';
import { SelectButton } from 'primeng/selectbutton';
import { Tag } from 'primeng/tag';
import { Textarea } from 'primeng/textarea';
import { Tooltip } from 'primeng/tooltip';
import { AuthService } from '../../../core/auth.service';
import { TranslatePipe, t } from '../../../core/i18n/i18n';
import { Exercise, PlanTemplate } from '../../../core/models';
import { StoreService } from '../../../core/store.service';
import { Modal } from '../../../shared/modal/modal';
import { PageHeader } from '../../../shared/page-header/page-header';
import { PlanEditor } from '../../../shared/plan-editor/plan-editor';

/** Coach library: reusable exercises (with demo video and cues) and plan templates assigned to athletes. */
@Component({
  selector: 'app-coach-library',
  imports: [TranslatePipe, FormsModule, FaIconComponent, ButtonDirective, IconField, InputIcon, InputText, Select, SelectButton, Tag, Textarea, Tooltip, Modal, PageHeader, PlanEditor],
  templateUrl: './coach-library.html',
  styleUrl: './coach-library.css',
})
export class CoachLibrary {
  private readonly undo = inject(UndoService);
  private readonly auth = inject(AuthService);
  protected readonly store = inject(StoreService);
  private readonly toast = inject(MessageService);
  private readonly confirm = inject(ConfirmationService);
  protected readonly editor = viewChild.required(PlanEditor);
  protected readonly me = computed(() => this.auth.user()?.id ?? '');
  protected readonly tab = signal<'exercises' | 'templates'>('exercises');
  protected readonly tabs = [{ label: t('Exercises'), value: 'exercises' }, { label: t('Templates'), value: 'templates' }];
  protected readonly q = signal('');
  protected readonly exercises = computed(() => {
    const q = this.q().trim().toLowerCase();
    return this.store.libraryOf(this.me()).filter((e) => !q || `${e.name} ${e.category} ${e.equipment ?? ''}`.toLowerCase().includes(q));
  });
  protected readonly groups = computed(() => {
    const map = new Map<string, Exercise[]>();
    for (const e of this.exercises()) map.set(e.category, [...(map.get(e.category) ?? []), e]);
    return [...map.entries()].map(([name, items]) => ({ name, items }));
  });
  protected readonly categories = computed(() => [...new Set(this.store.libraryOf(this.me()).map((e) => e.category))]);
  protected readonly templates = computed(() => this.store.templatesOf(this.me()));
  protected readonly athletes = computed(() => this.store.athletesOf(this.me()).map((u) => ({ id: u.id, label: `${u.firstName} ${u.lastName}` })));

  /** YouTube thumbnail for a video link (other links show an icon). */
  thumb(url?: string) { const m = /(?:v=|youtu\.be\/)([\w-]{11})/.exec(url ?? ''); return m ? `https://img.youtube.com/vi/${m[1]}/mqdefault.jpg` : null; }

  protected readonly editing = signal<Exercise | null>(null);
  edit(e?: Exercise) { this.editing.set(e ? { ...e } : { id: '', coachId: this.me(), name: '', category: this.categories()[0] ?? t('Legs'), equipment: '', videoUrl: '', cues: '' }); }
  save() {
    const e = this.editing();
    if (!e || !e.name.trim() || !e.category.trim()) { this.toast.add({ severity: 'error', summary: t('Give a name and a category.') }); return; }
    if (e.videoUrl && !/^https?:\/\//.test(e.videoUrl.trim())) { this.toast.add({ severity: 'error', summary: t('The video link must start with https://') }); return; }
    this.store.saveExercise({ ...e, name: e.name.trim(), category: e.category.trim(), videoUrl: e.videoUrl?.trim() || undefined, cues: e.cues?.trim() || undefined, equipment: e.equipment?.trim() || undefined });
    this.editing.set(null);
  }
  remove(e: Exercise) { this.undo.run(t('Deleted'), ['exercises'], () => this.store.deleteExercise(e.id), e.name); }

  newTemplate(kind: 'WORKOUT' | 'NUTRITION') { this.editor().openTemplate(this.me(), undefined, kind); }
  editTemplate(tpl: PlanTemplate) { this.editor().openTemplate(this.me(), tpl); }
  removeTemplate(tpl: PlanTemplate) { this.undo.run(t('Template deleted'), ['planTemplates'], () => this.store.deletePlanTemplate(tpl.id), tpl.title); }
  groupsOf(tpl: PlanTemplate) { return [...new Set(tpl.items.map((i) => i.group))]; }

  protected readonly assigning = signal<PlanTemplate | null>(null);
  protected assignTo: string[] = [];
  assign(tpl: PlanTemplate) { this.assignTo = []; this.assigning.set(tpl); }
  confirmAssign() {
    const tpl = this.assigning();
    if (!tpl || !this.assignTo.length) return;
    const n = this.store.assignTemplate(tpl.id, this.assignTo);
    this.toast.add({ severity: 'success', summary: t('Plan sent to {n} athletes', { n }) });
    this.assigning.set(null);
  }
}
