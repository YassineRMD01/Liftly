import { Component, computed, input, model } from '@angular/core';
import { FaIconComponent } from '@fortawesome/angular-fontawesome';
import { IconProp } from '@fortawesome/fontawesome-svg-core';
import { Dialog } from 'primeng/dialog';
import { TranslatePipe } from '../../core/i18n/i18n';

/** Header colours: primary (create / neutral), edit (amber), success (green), danger (red), info (sky). */
export type ModalTone = 'primary' | 'edit' | 'success' | 'danger' | 'info';

const TONES: Record<ModalTone, string> = {
  primary: 'from-primary-500 to-primary-800 text-primary-contrast',
  edit: 'from-amber-500 to-orange-700 text-white',
  success: 'from-green-500 to-green-700 text-white',
  danger: 'from-red-500 to-rose-700 text-white',
  info: 'from-sky-500 to-blue-700 text-white',
};

/**
 * The app's dialog (same look as the payment calendar): rounded card, gradient header bar with icon,
 * title and a round close button, padded body, centred footer. Visibility is a two-way signal:
 *   <app-modal [(visible)]="open" header="…" icon="pen" tone="edit"> body <div modal-footer>buttons</div></app-modal>
 */
@Component({
  selector: 'app-modal',
  imports: [Dialog, FaIconComponent, TranslatePipe],
  templateUrl: './modal.html',
  styleUrl: './modal.css',
})
export class Modal {
  readonly visible = model(false);
  readonly header = input('');
  readonly subtitle = input<string>();
  readonly icon = input<IconProp>('circle-info');
  readonly tone = input<ModalTone>('primary');
  /** CSS width on large screens (phones use 94vw). */
  readonly width = input('30rem');
  /** Clicking outside closes the dialog. */
  readonly dismissable = input(true);
  protected readonly toneClass = computed(() => TONES[this.tone()]);
  protected readonly style = computed(() => ({ width: this.width() }));
}
