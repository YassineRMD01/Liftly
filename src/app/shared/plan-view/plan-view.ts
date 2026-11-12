import { Component, computed, inject, input } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FaIconComponent } from '@fortawesome/angular-fontawesome';
import { Checkbox } from 'primeng/checkbox';
import { FormsModule } from '@angular/forms';
import { ProgressBar } from 'primeng/progressbar';
import { TranslatePipe } from '../../core/i18n/i18n';
import { TrainingPlan } from '../../core/models';
import { StoreService } from '../../core/store.service';

/** A workout or nutrition plan grouped by day/meal. Members can tick items as done. */
@Component({
  selector: 'app-plan-view',
  imports: [TranslatePipe, DatePipe, FormsModule, FaIconComponent, Checkbox, ProgressBar],
  templateUrl: './plan-view.html',
  styleUrl: './plan-view.css',
})
export class PlanView {
  protected readonly store = inject(StoreService);
  readonly plan = input.required<TrainingPlan>();
  /** Show tick boxes (member view). */
  readonly canTick = input(false);
  protected readonly groups = computed(() => {
    const map = new Map<string, TrainingPlan['items']>();
    for (const i of this.plan().items) map.set(i.group || '—', [...(map.get(i.group || '—') ?? []), i]);
    return [...map.entries()].map(([name, items]) => ({ name, items }));
  });
  protected readonly pct = computed(() => {
    const items = this.plan().items;
    return items.length ? Math.round((items.filter((i) => i.done).length / items.length) * 100) : 0;
  });
}
