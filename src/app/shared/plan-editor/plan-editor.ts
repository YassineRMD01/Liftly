import { Component, computed, inject, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MessageService } from 'primeng/api';
import { FaIconComponent } from '@fortawesome/angular-fontawesome';
import { ButtonDirective } from 'primeng/button';
import { Modal } from '../modal/modal';
import { InputText } from 'primeng/inputtext';
import { SelectButton } from 'primeng/selectbutton';
import { Select } from 'primeng/select';
import { Textarea } from 'primeng/textarea';
import { TranslatePipe, t } from '../../core/i18n/i18n';
import { PlanTemplate, TrainingPlan, TrainingPlanItem, TrainingPlanKind } from '../../core/models';
import { StoreService } from '../../core/store.service';

/** Dialog for a coach to write or edit a workout / nutrition plan. */
@Component({
  selector: 'app-plan-editor',
  imports: [TranslatePipe, FormsModule, FaIconComponent, ButtonDirective, Modal, InputText, SelectButton, Select, Textarea],
  templateUrl: './plan-editor.html',
  styleUrl: './plan-editor.css',
})
export class PlanEditor {
  private readonly store = inject(StoreService);
  private readonly toast = inject(MessageService);
  readonly saved = output<TrainingPlan>();
  protected readonly plan = signal<TrainingPlan | null>(null);
  /** Editing a reusable template instead of a member's plan. */
  protected readonly templateMode = signal(false);
  private templateId = '';
  protected readonly templates = computed(() => { const p = this.plan(); return p ? this.store.templatesOf(p.coachId).filter((x) => x.kind === p.kind) : []; });
  protected readonly library = computed(() => { const p = this.plan(); return p ? this.store.libraryOf(p.coachId) : []; });
  protected readonly kinds = [{ label: t('Workout'), value: 'WORKOUT' }, { label: t('Nutrition'), value: 'NUTRITION' }];

  open(coachId: string, clientId: string, existing?: TrainingPlan, kind: TrainingPlanKind = 'WORKOUT') {
    this.templateMode.set(false);
    this.plan.set(existing ? structuredClone(existing) : {
      id: '', coachId, clientId, kind, title: '', notes: '', createdAt: '', updatedAt: '',
      items: [{ id: '', group: kind === 'WORKOUT' ? t('Day 1') : t('Breakfast'), name: '', detail: '' }],
    });
  }
  /** Edit (or create) a template. */
  openTemplate(coachId: string, tpl?: PlanTemplate, kind: TrainingPlanKind = 'WORKOUT') {
    this.templateMode.set(true);
    this.templateId = tpl?.id ?? '';
    this.plan.set({ id: tpl?.id ?? '', coachId, clientId: '', kind: tpl?.kind ?? kind, title: tpl?.title ?? '', notes: tpl?.notes ?? '', createdAt: tpl?.createdAt ?? '', updatedAt: '',
      items: tpl ? structuredClone(tpl.items) : [{ id: '', group: kind === 'WORKOUT' ? t('Day 1') : t('Breakfast'), name: '', detail: '' }] });
  }
  /** Fill a new plan from a template. */
  useTemplate(id: string | null) {
    const tpl = this.templates().find((x) => x.id === id);
    const p = this.plan();
    if (!tpl || !p) return;
    this.plan.set({ ...p, title: tpl.title, notes: tpl.notes ?? '', items: tpl.items.map((i) => ({ ...i, id: '', done: false })) });
  }
  saveAsTemplate() {
    const p = this.plan();
    if (!p || !p.title.trim()) return;
    this.store.savePlanTemplate({ id: '', coachId: p.coachId, kind: p.kind, title: p.title.trim(), notes: p.notes, items: p.items.filter((i) => i.name.trim()).map((i) => ({ ...i, id: '' })), createdAt: '' });
    this.toast.add({ severity: 'success', summary: t('Saved as a template'), life: 1500 });
  }
  close(v: boolean) { if (!v) this.plan.set(null); }

  addItem(after?: TrainingPlanItem) {
    const p = this.plan()!;
    const group = after?.group ?? p.items.at(-1)?.group ?? '';
    const idx = after ? p.items.indexOf(after) + 1 : p.items.length;
    p.items.splice(idx, 0, { id: '', group, name: '', detail: '' });
    this.plan.set({ ...p });
  }
  addGroup() {
    const p = this.plan()!;
    const n = new Set(p.items.map((i) => i.group)).size + 1;
    p.items.push({ id: '', group: p.kind === 'WORKOUT' ? t('Day {n}', { n }) : '', name: '', detail: '' });
    this.plan.set({ ...p });
  }
  removeItem(i: TrainingPlanItem) { const p = this.plan()!; p.items = p.items.filter((x) => x !== i); this.plan.set({ ...p }); }

  save() {
    const p = this.plan();
    if (!p) return;
    const items = p.items.filter((i) => i.name.trim()).map((i) => ({ ...i, name: i.name.trim(), group: i.group.trim(), detail: i.detail?.trim() }));
    if (!p.title.trim() || !items.length) { this.toast.add({ severity: 'error', summary: t('Add a title and at least one line.') }); return; }
    if (this.templateMode()) {
      this.store.savePlanTemplate({ id: this.templateId, coachId: p.coachId, kind: p.kind, title: p.title.trim(), notes: p.notes, items, createdAt: p.createdAt });
      this.toast.add({ severity: 'success', summary: t('Template saved') });
      this.plan.set(null);
      return;
    }
    const saved = this.store.savePlan({ ...p, title: p.title.trim(), items });
    this.toast.add({ severity: 'success', summary: t('Plan saved'), detail: t('{0} was notified.', { 0: this.store.fullName(p.clientId) }) });
    this.plan.set(null);
    this.saved.emit(saved);
  }
}
