import { Component, computed, effect, inject, input, model, output, signal, untracked } from '@angular/core';
import { MessageService } from 'primeng/api';
import { FaIconComponent } from '@fortawesome/angular-fontawesome';
import { ButtonDirective } from 'primeng/button';
import { TranslatePipe, t } from '../../core/i18n/i18n';
import { extractLogoColors, resizeImage } from '../../core/logo';
import { GymTheme } from '../../core/models';
import { GymLogo } from '../gym-logo/gym-logo';

/**
 * Logo uploader used by gym Branding and platform Settings: upload / remove a logo,
 * resized in the browser, and offer its main colors as swatches.
 * `detected` fires with the colors of a newly uploaded logo (the parent applies the first one).
 */
@Component({
  selector: 'app-logo-upload',
  imports: [TranslatePipe, FaIconComponent, ButtonDirective, GymLogo],
  templateUrl: './logo-upload.html',
  styleUrl: './logo-upload.css',
})
export class LogoUpload {
  private readonly toast = inject(MessageService);

  /** Uploaded logo as a data URL (two-way). */
  readonly logoUrl = model<string | undefined>(undefined);
  /** Theme used to draw the logo preview (initials fallback). */
  readonly theme = input<GymTheme>();
  readonly name = input('');
  /** Currently selected theme color, to highlight the matching swatch. */
  readonly selectedColor = input<string>();
  readonly detected = output<string[]>();
  readonly pickColor = output<string>();

  protected readonly colors = signal<string[]>([]);
  protected readonly uploading = signal(false);
  protected readonly previewTheme = computed<GymTheme>(() => ({ primary: '#6366f1', logoText: '', ...this.theme(), logoUrl: this.logoUrl() }));

  constructor() {
    // swatches for an existing logo (e.g. when the page opens or after a reset)
    effect(() => {
      const url = this.logoUrl();
      untracked(() => {
        if (!url) this.colors.set([]);
        else extractLogoColors(url).then((c) => this.colors.set(c));
      });
    });
  }

  async onFile(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      this.toast.add({ severity: 'error', summary: t('Not an image'), detail: t('Choose a PNG, JPG, SVG or WebP file.') });
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      this.toast.add({ severity: 'error', summary: t('File too large'), detail: t('The logo must be under 5 MB.') });
      return;
    }
    this.uploading.set(true);
    try {
      const url = await resizeImage(file);
      const colors = await extractLogoColors(url);
      this.logoUrl.set(url);
      this.colors.set(colors);
      this.detected.emit(colors);
      if (colors[0]) {
        this.toast.add({ severity: 'info', summary: t('Theme matched to your logo'), detail: t('You can pick another color from the logo or any other color.') });
      }
    } catch {
      this.toast.add({ severity: 'error', summary: t('Could not read this image') });
    } finally {
      this.uploading.set(false);
    }
  }

  remove() { this.logoUrl.set(undefined); }
}
