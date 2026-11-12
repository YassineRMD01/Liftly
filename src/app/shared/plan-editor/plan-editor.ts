import { Component, inject, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MessageService } from 'primeng/api';
import { FaIconComponent } from '@fortawesome/angular-fontawesome';
import { ButtonDirective } from 'primeng/button';
import { Dialog } from 'primeng/dialog';
import { InputText } from 'primeng/inputtext';
import { SelectButton } from 'primeng/selectbutton';
import { Textarea } from 'primeng/textarea';
import { TranslatePipe, t } from '../../core/i18n/i18n';
import { TrainingPlan, TrainingPlanItem, TrainingPlanKind } from '../../core/models';
import { StoreService } from '../../core/store.service';

/** Dialog for a coach to write or edit a workout / nutrition plan. */
@Component({
  selector: 'app-plan-editor',
  imports: [TranslatePipe, FormsModule, FaIconComponent, ButtonDirective, Dialog, InputText, SelectButton, Textarea],
  templateUrl: './plan-editor.html',
  styleUrl: './plan-editor.css',
})
export class PlanEditor {
  private readonly store = inject(StoreService);
  private readonly toast = inject(MessageService);
  readonly saved = output<TrainingPlan>();
  protected readonly plan = signal<TrainingPlan | null>(null);
  protected readonly kinds = [{ label: t('Workout'), value: 'WORKOUT' }, { label: t('Nutrition'), value: 'NUTRITION' }];

  open(coachId: string, clientId: string, existing?: TrainingPlan, kind: TrainingPlanKind = 'WORKOUT') {
    this.plan.set(existing ? structuredClone(existing) : {
      id: '', coachId, clientId, kind, title: '', notes: '', createdAt: '', updatedAt: '',
      items: [{ id: '', group: kind === 'WORKOUT' ? t('Day 1') : t('Breakfast'), name: '', detail: '' }],
    });
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
    const saved = this.store.savePlan({ ...p, title: p.title.trim(), items });
    this.toast.add({ severity: 'success', summary: t('Plan saved'), detail: t('{0} was notified.', { 0: this.store.fullName(p.clientId) }) });
    this.plan.set(null);
    this.saved.emit(saved);
  }
}
