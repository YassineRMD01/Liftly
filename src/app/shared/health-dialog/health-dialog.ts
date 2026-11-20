import { Component, computed, inject, signal } from '@angular/core';
import { ProgressBar } from 'primeng/progressbar';
import { TranslatePipe } from '../../core/i18n/i18n';
import { StoreService } from '../../core/store.service';
import { Modal } from '../modal/modal';

export const HEALTH_SEV = { HEALTHY: 'success', WATCH: 'warn', AT_RISK: 'danger' } as const;
export const HEALTH_LABEL = { HEALTHY: 'Healthy', WATCH: 'Watch', AT_RISK: 'At risk' } as const;

/** Breakdown of a gym's health score (super-admin). */
@Component({
  selector: 'app-health-dialog',
  imports: [TranslatePipe, ProgressBar, Modal],
  template: `
    <app-modal [visible]="!!gymId()" (visibleChange)="!$event && gymId.set(null)" [header]="'Gym health' | t" [subtitle]="store.gym(gymId() ?? undefined)?.name" [tone]="tone()" icon="heart-pulse" width="30rem">
      @if (health(); as h) {
        <div class="space-y-4">
          <div class="text-center"><div class="text-5xl font-extrabold" data-testid="health-score">{{ h.score }}</div><div class="muted">{{ label[h.level] | t }}</div></div>
          @for (f of h.factors; track f.key) {
            <div>
              <div class="flex justify-between text-sm"><span class="font-medium">{{ f.label | t }} <span class="muted text-xs">· {{ f.weight }}%</span></span><span class="tabular-nums">{{ f.score }}</span></div>
              <p-progressbar [value]="f.score" [showValue]="false" styleClass="!h-1.5 my-1" />
              <div class="text-xs muted">{{ f.detail }}</div>
            </div>
          }
        </div>
      }
    </app-modal>`,
})
export class HealthDialog {
  protected readonly store = inject(StoreService);
  protected readonly label = HEALTH_LABEL;
  readonly gymId = signal<string | null>(null);
  protected readonly health = computed(() => (this.gymId() ? this.store.gymHealth(this.gymId()!) : null));
  protected readonly tone = computed(() => ({ HEALTHY: 'success', WATCH: 'edit', AT_RISK: 'danger' } as const)[this.health()?.level ?? 'HEALTHY']);
  open(id: string) { this.gymId.set(id); }
}
