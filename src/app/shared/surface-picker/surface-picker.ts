import { Component, computed, model } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ColorPicker } from 'primeng/colorpicker';
import { TranslatePipe, t } from '../../core/i18n/i18n';
import { DEFAULT_SURFACE, SURFACE_PRESETS, buildSurface } from '../../core/theme.service';

/**
 * Secondary (surface) color editor: one base color for light mode and one for dark mode,
 * from presets or any color, with a small preview of each mode.
 */
@Component({
  selector: 'app-surface-picker',
  imports: [TranslatePipe, FormsModule, ColorPicker],
  templateUrl: './surface-picker.html',
  styleUrl: './surface-picker.css',
})
export class SurfacePicker {
  /** Two-way: { light, dark } base colors. */
  readonly value = model<{ light: string; dark: string }>({ ...DEFAULT_SURFACE });
  protected readonly presets = SURFACE_PRESETS.map((p) => ({ ...p, label: t(p.name) }));

  protected readonly modes = computed(() => {
    const v = this.value();
    return (['light', 'dark'] as const).map((mode) => {
      const pal = buildSurface(v[mode]);
      // what a page looks like in that mode with this color
      const preview = mode === 'light'
        ? { page: pal['50'], card: pal['0'], border: pal['200'], text: pal['800'], muted: pal['500'] }
        : { page: pal['950'], card: pal['900'], border: pal['700'], text: pal['0'], muted: pal['400'] };
      return { mode, color: v[mode], preview, title: mode === 'light' ? t('Light mode') : t('Dark mode') };
    });
  });

  set(mode: 'light' | 'dark', color: string) {
    if (!/^#[0-9a-f]{6}$/i.test(color)) return;
    this.value.update((v) => ({ ...v, [mode]: color.toLowerCase() }));
  }
  reset() { this.value.set({ ...DEFAULT_SURFACE }); }
}
