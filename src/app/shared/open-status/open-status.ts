import { Component, computed, inject, input } from '@angular/core';
import { Gender, ScheduleSlot } from '../../core/models';
import { AUDIENCE, DAY_SHORT } from '../../core/schedule';
import { StoreService } from '../../core/store.service';

/** "Open now · Women only until 14:00" badge. */
@Component({
  selector: 'app-open-status',
  templateUrl: './open-status.html',
  styleUrl: './open-status.css',
})
export class OpenStatusBadge {
  private readonly store = inject(StoreService);
  readonly gymId = input.required<string>();
  readonly gender = input<Gender>();
  protected readonly dayShort = DAY_SHORT;
  protected readonly status = computed(() => this.store.gymOpenStatus(this.gymId(), this.gender()));
  audienceLabel(a: ScheduleSlot['audience']) { return AUDIENCE[a].label; }
}
