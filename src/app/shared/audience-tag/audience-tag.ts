import { Component, computed, input } from '@angular/core';
import { FaIconComponent } from '@fortawesome/angular-fontawesome';
import { ScheduleSlot } from '../../core/models';
import { AUDIENCE } from '../../core/schedule';

/** Small colored pill showing who a slot is for. */
@Component({
  selector: 'app-audience-tag',
  imports: [FaIconComponent],
  templateUrl: './audience-tag.html',
  styleUrl: './audience-tag.css',
})
export class AudienceTag {
  readonly audience = input.required<ScheduleSlot['audience']>();
  readonly short = input(false);
  protected readonly meta = computed(() => AUDIENCE[this.audience()]);
}
