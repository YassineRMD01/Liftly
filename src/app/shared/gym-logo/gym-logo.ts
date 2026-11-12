import { Component, computed, input } from '@angular/core';
import { GymTheme } from '../../core/models';

/** A gym's logo: the uploaded image, or its initials on its brand color. */
@Component({
  selector: 'app-gym-logo',
  templateUrl: './gym-logo.html',
  styleUrl: './gym-logo.css',
  host: { class: 'inline-block shrink-0' },
})
export class GymLogo {
  readonly theme = input<GymTheme | null | undefined>();
  readonly name = input('');
  /** Size in px (square). */
  readonly size = input(40);
  /** Translucent badge for use on top of colored headers. */
  readonly onColor = input(false);
  protected readonly radius = computed(() => Math.round(this.size() * 0.25));
  protected readonly fontSize = computed(() => Math.max(10, Math.round(this.size() * 0.32)));
}
