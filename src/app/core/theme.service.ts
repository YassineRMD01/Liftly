import { Injectable, effect, inject, signal } from '@angular/core';
import { updatePrimaryPalette } from '@primeuix/themes';
import { AuthService } from './auth.service';
import { GymTheme } from './models';

export const DEFAULT_PRIMARY = '#6366f1';

const hexToRgb = (hex: string) => {
  const h = hex.replace('#', '');
  const n = parseInt(h.length === 3 ? h.split('').map((c) => c + c).join('') : h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};
const rgbToHex = (rgb: number[]) => '#' + rgb.map((v) => Math.round(v).toString(16).padStart(2, '0')).join('');
const mix = (a: number[], b: number[], w: number) => a.map((v, i) => v * (1 - w) + b[i] * w);

/** Builds a 50…950 palette from a single brand color (like Tailwind scales). */
export function buildPalette(hex: string): Record<string, string> {
  const base = hexToRgb(hex);
  const white = [255, 255, 255];
  const black = [0, 0, 0];
  const steps: Record<string, [number[], number]> = {
    50: [white, 0.95], 100: [white, 0.85], 200: [white, 0.7], 300: [white, 0.5], 400: [white, 0.25],
    500: [white, 0], 600: [black, 0.12], 700: [black, 0.28], 800: [black, 0.42], 900: [black, 0.55], 950: [black, 0.7],
  };
  return Object.fromEntries(Object.entries(steps).map(([k, [target, w]]) => [k, rgbToHex(mix(base, target, w))]));
}

/**
 * Applies the white-label theme of the gym in context.
 * Admins see their gym brand; other roles see the platform default
 * unless a page sets a preview (e.g. branding editor, client browsing a gym).
 * Dark mode is a per-user preference.
 */
@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly auth = inject(AuthService);
  readonly preview = signal<GymTheme | null>(null);
  readonly dark = signal(this.readDark());
  readonly current = signal<GymTheme>({ primary: DEFAULT_PRIMARY, logoText: 'LF' });

  constructor() {
    effect(() => {
      const theme = this.preview() ?? this.auth.activeGym()?.theme ?? { primary: DEFAULT_PRIMARY, logoText: 'LF' };
      this.current.set(theme);
      updatePrimaryPalette(buildPalette(theme.primary));
    });
    effect(() => {
      document.documentElement.classList.toggle('app-dark', this.dark());
      try { localStorage.setItem('liftly-dark', this.dark() ? '1' : '0'); } catch { /* ignore */ }
    });
  }

  private readDark() {
    try { return localStorage.getItem('liftly-dark') === '1'; } catch { return false; }
  }

  toggleDark() { this.dark.update((v) => !v); }
}
