import { Component, computed, inject, input } from '@angular/core';
import { TranslatePipe } from '../../core/i18n/i18n';
import { StoreService } from '../../core/store.service';

/** Retention heat-table: members by month of their first membership, % still active N months later. */
@Component({
  selector: 'app-cohort-table',
  imports: [TranslatePipe],
  templateUrl: './cohort-table.html',
  styleUrl: './cohort-table.css',
})
export class CohortTable {
  private readonly store = inject(StoreService);
  /** One gym, or the whole platform when omitted. */
  readonly gymId = input<string>();
  readonly months = input(6);
  protected readonly rows = computed(() => this.store.retentionCohorts(this.gymId(), this.months()));
  protected readonly cols = computed(() => Array.from({ length: this.months() }, (_, i) => i));
  /** Sequential single-hue scale (primary), light → dark with the value; text flips for contrast. */
  bg(v: number) { return `color-mix(in srgb, var(--p-primary-600) ${Math.max(6, v)}%, transparent)`; }
  fg(v: number) { return v >= 55 ? 'var(--p-primary-contrast-color)' : 'inherit'; }
}
