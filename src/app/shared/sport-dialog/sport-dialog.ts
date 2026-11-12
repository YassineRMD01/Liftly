import { Component, computed, inject, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { FaIconComponent } from '@fortawesome/angular-fontawesome';
import { IconProp } from '@fortawesome/fontawesome-svg-core';
import { ButtonDirective } from 'primeng/button';
import { Dialog } from 'primeng/dialog';
import { InputText } from 'primeng/inputtext';
import { TranslatePipe } from '../../core/i18n/i18n';
import { Sport } from '../../core/models';

/** Icons a sport can use (all registered in core/icons.ts). */
export const SPORT_ICONS = [
  'dumbbell', 'fire', 'heart-pulse', 'person-swimming', 'water', 'hand-fist', 'user-ninja', 'spa', 'person-walking',
  'table-tennis-paddle-ball', 'mountain', 'music', 'bicycle', 'futbol', 'basketball', 'volleyball', 'person-running',
  'person-skiing', 'golf-ball-tee', 'baseball', 'bowling-ball', 'child', 'medal', 'trophy', 'stopwatch',
];

/** Create / edit a sport (name + icon). Used by the gym Sports page and the super-admin catalog. */
@Component({
  selector: 'app-sport-dialog',
  imports: [TranslatePipe, FormsModule, FaIconComponent, ButtonDirective, Dialog, InputText],
  templateUrl: './sport-dialog.html',
  styleUrl: './sport-dialog.css',
})
export class SportDialog {
  readonly saved = output<Sport>();
  protected readonly icons = SPORT_ICONS;
  protected readonly visible = signal(false);
  protected readonly draft = signal<Sport>({ id: '', name: '', icon: 'dumbbell' });
  protected readonly valid = computed(() => this.draft().name.trim().length > 1);

  open(sport: Sport) {
    this.draft.set({ ...sport });
    this.visible.set(true);
  }

  setName(name: string) { this.draft.update((d) => ({ ...d, name })); }
  setIcon(icon: string) { this.draft.update((d) => ({ ...d, icon })); }
  iconOf(name: string) { return name as IconProp; }

  save() {
    if (!this.valid()) return;
    this.saved.emit({ ...this.draft(), name: this.draft().name.trim() });
    this.visible.set(false);
  }
}
