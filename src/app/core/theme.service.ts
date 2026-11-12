import { Injectable, computed, effect, inject, signal } from '@angular/core';
import { updatePrimaryPalette } from '@primeuix/themes';
import { AuthService } from './auth.service';
import { StoreService } from './store.service';
import { Appearance, GymTheme } from './models';

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

export type AppearanceChoice = 'auto' | 'light' | 'dark';
const APPEARANCE_KEY = 'liftly-appearance';

/**
 * Applies the white-label theme of the gym in context.
 * Admins see their gym brand; other roles see the platform theme set by the super-admin,
 * unless a page sets a preview (e.g. branding editor, client browsing a gym).
 *
 * Dark mode: each theme has an appearance (system / light / dark) chosen by its admin.
 * A user can override it for themselves (light / dark), or keep "auto" to use the theme's setting;
 * "system" follows the operating system and updates live when it changes.
 */
@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly auth = inject(AuthService);
  private readonly store = inject(StoreService);
  readonly preview = signal<GymTheme | null>(null);
  /** Theme in use: preview → gym of the admin → platform. */
  readonly current = computed<GymTheme>(() => this.preview() ?? this.auth.activeGym()?.theme ?? this.store.platform().theme);

  /** The user's own choice in the header menu. */
  readonly userAppearance = signal<AppearanceChoice>(this.readChoice());
  private readonly media = typeof matchMedia === 'function' ? matchMedia('(prefers-color-scheme: dark)') : null;
  /** Live operating-system preference. */
  readonly systemDark = signal(this.media?.matches ?? false);

  readonly dark = computed(() => {
    const resolve = (a: Appearance | undefined) => ((a ?? 'system') === 'system' ? this.systemDark() : a === 'dark');
    // while an admin previews a theme with a forced light/dark mode, show it so they see what members will see
    const previewing = this.preview()?.appearance;
    if (previewing && previewing !== 'system') return previewing === 'dark';
    const choice = this.userAppearance();
    if (choice !== 'auto') return choice === 'dark';
    return resolve(this.current().appearance);
  });

  constructor() {
    this.media?.addEventListener('change', (e) => this.systemDark.set(e.matches));
    effect(() => updatePrimaryPalette(buildPalette(this.current().primary)));
    effect(() => document.documentElement.classList.toggle('app-dark', this.dark()));
    effect(() => {
      try { localStorage.setItem(APPEARANCE_KEY, this.userAppearance()); } catch { /* ignore */ }
    });
  }

  private readChoice(): AppearanceChoice {
    try {
      const v = localStorage.getItem(APPEARANCE_KEY);
      return v === 'light' || v === 'dark' ? v : 'auto';
    } catch {
      return 'auto';
    }
  }

  setAppearance(choice: AppearanceChoice) { this.userAppearance.set(choice); }
}
