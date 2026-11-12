import { TranslatePipe, t } from '../../../core/i18n/i18n';
import { Component, OnDestroy, computed, effect, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { MessageService } from 'primeng/api';
import { FaIconComponent } from '@fortawesome/angular-fontawesome';
import { Button } from 'primeng/button';
import { ColorPicker } from 'primeng/colorpicker';
import { InputText } from 'primeng/inputtext';
import { Message } from 'primeng/message';
import { Select } from 'primeng/select';
import { MoneyPipe } from '../../../core/currency';
import { Tag } from 'primeng/tag';
import { Textarea } from 'primeng/textarea';
import { AuthService } from '../../../core/auth.service';
import { Gym } from '../../../core/models';
import { StoreService } from '../../../core/store.service';
import { ThemeService } from '../../../core/theme.service';
import { PageHeader } from '../../../shared/page-header/page-header';
import { GymLogo } from '../../../shared/gym-logo/gym-logo';
import { SelectButton } from 'primeng/selectbutton';
import { extractLogoColors, resizeImage } from '../../../core/logo';
import { Appearance } from '../../../core/models';

const PRESETS = ['#6366f1', '#ef4444', '#f97316', '#f59e0b', '#10b981', '#14b8a6', '#0ea5e9', '#3b82f6', '#8b5cf6', '#ec4899', '#111827', '#84cc16'];

@Component({
  selector: 'app-admin-branding',
  imports: [TranslatePipe, MoneyPipe, FormsModule, RouterLink, FaIconComponent, Button, ColorPicker, InputText, Message, Select, Tag, Textarea, PageHeader, GymLogo, SelectButton],
  templateUrl: './admin-branding.html',
  styleUrl: './admin-branding.css',
})
export class AdminBranding implements OnDestroy {
  private readonly auth = inject(AuthService);
  protected readonly store = inject(StoreService);
  protected readonly theme = inject(ThemeService);
  private readonly toast = inject(MessageService);
  protected readonly presets = PRESETS;
  /** Active currencies (managed by the super-admin). */
  protected readonly currencies = inject(StoreService).currencyOptions;
  protected readonly color = signal('#6366f1');
  protected readonly logo = signal('');
  /** Uploaded logo (data URL). */
  protected readonly logoUrl = signal<string | undefined>(undefined);
  /** Brand colors found in the logo, strongest first. */
  protected readonly logoColors = signal<string[]>([]);
  protected readonly appearance = signal<Appearance>('system');
  protected readonly appearances = [
    { value: 'system', label: t('Auto (system)'), icon: 'circle-half-stroke' },
    { value: 'light', label: t('Light'), icon: 'sun' },
    { value: 'dark', label: t('Dark'), icon: 'moon' },
  ];
  protected readonly uploading = signal(false);
  /** Theme being edited, for the logo component and the live preview. */
  protected readonly draftTheme = computed(() => ({ primary: this.color(), logoText: this.logo(), logoUrl: this.logoUrl(), appearance: this.appearance() }));
  protected draft: Gym = this.auth.activeGym()!;
  protected readonly allowed = computed(() => !!this.store.saasPlan(this.auth.activeGym()?.saasPlanId)?.customTheme);

  constructor() {
    this.load();
    effect(() => this.theme.preview.set(this.draftTheme()));
  }

  ngOnDestroy() { this.theme.preview.set(null); }

  load() {
    const g = this.auth.activeGym();
    if (!g) return;
    this.draft = structuredClone(g);
    this.color.set(g.theme.primary);
    this.logo.set(g.theme.logoText);
    this.logoUrl.set(g.theme.logoUrl);
    this.appearance.set(g.theme.appearance ?? 'system');
    this.logoColors.set([]);
    if (g.theme.logoUrl) extractLogoColors(g.theme.logoUrl).then((c) => this.logoColors.set(c));
  }

  /** Upload a logo: it is resized in the browser and its main color becomes the theme color. */
  async onLogoFile(event: Event) {
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
      this.logoUrl.set(url);
      const colors = await extractLogoColors(url);
      this.logoColors.set(colors);
      if (colors[0]) {
        this.setColor(colors[0]);
        this.toast.add({ severity: 'info', summary: t('Theme matched to your logo'), detail: t('You can pick another color from the logo or any other color.') });
      }
    } catch {
      this.toast.add({ severity: 'error', summary: t('Could not read this image') });
    } finally {
      this.uploading.set(false);
    }
  }

  removeLogo() {
    this.logoUrl.set(undefined);
    this.logoColors.set([]);
  }

  setColor(c: string) { this.color.set(c.toLowerCase()); }
  onHex(v: string) { if (/^#[0-9a-f]{6}$/i.test(v)) this.setColor(v); }
  setLogo(v: string) { this.logo.set(v.toUpperCase().slice(0, 3)); }

  save() {
    const current = this.auth.activeGym();
    if (!current) return;
    const keepColor = this.allowed() ? this.color() : current.theme.primary;
    this.store.updateGym({ ...this.draft, theme: { primary: keepColor, logoText: this.logo(), logoUrl: this.logoUrl(), appearance: this.appearance() } });
    if (!this.allowed()) {
      this.color.set(current.theme.primary);
      this.toast.add({ severity: 'warn', summary: t('Saved without color'), detail: t('Upgrade to Pro to use a custom color.') });
    } else {
      this.toast.add({ severity: 'success', summary: t('Branding saved'), detail: t('Your gym theme is live.') });
    }
  }
}
