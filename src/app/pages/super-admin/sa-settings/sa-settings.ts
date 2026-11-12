import { Component, OnDestroy, computed, effect, inject, signal, viewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ConfirmationService, MessageService } from 'primeng/api';
import { FaIconComponent } from '@fortawesome/angular-fontawesome';
import { IconProp } from '@fortawesome/fontawesome-svg-core';
import { Button } from 'primeng/button';
import { ColorPicker } from 'primeng/colorpicker';
import { InputText } from 'primeng/inputtext';
import { Select } from 'primeng/select';
import { TranslatePipe, t } from '../../../core/i18n/i18n';
import { Appearance, Sport } from '../../../core/models';
import { SelectButton } from 'primeng/selectbutton';
import { StoreService } from '../../../core/store.service';
import { ThemeService } from '../../../core/theme.service';
import { PageHeader } from '../../../shared/page-header/page-header';
import { SportDialog } from '../../../shared/sport-dialog/sport-dialog';
import { LogoUpload } from '../../../shared/logo-upload/logo-upload';
import { SurfacePicker } from '../../../shared/surface-picker/surface-picker';
import { GymLogo } from '../../../shared/gym-logo/gym-logo';
import { DEFAULT_SURFACE } from '../../../core/theme.service';

const PRESETS = ['#6366f1', '#ef4444', '#f97316', '#f59e0b', '#10b981', '#14b8a6', '#0ea5e9', '#3b82f6', '#8b5cf6', '#ec4899', '#111827', '#84cc16'];

/** Platform settings: theme of the public site, default country and the shared sport catalog. */
@Component({
  selector: 'app-sa-settings',
  imports: [LogoUpload, SurfacePicker, GymLogo, SelectButton, TranslatePipe, FormsModule, FaIconComponent, Button, ColorPicker, InputText, Select, PageHeader, SportDialog],
  templateUrl: './sa-settings.html',
  styleUrl: './sa-settings.css',
})
export class SaSettings implements OnDestroy {
  protected readonly store = inject(StoreService);
  protected readonly theme = inject(ThemeService);
  private readonly toast = inject(MessageService);
  private readonly confirm = inject(ConfirmationService);
  private readonly sportDialog = viewChild.required(SportDialog);

  protected readonly presets = PRESETS;
  protected readonly color = signal(this.store.platform().theme.primary);
  protected readonly logo = signal(this.store.platform().theme.logoText);
  protected readonly defaultCountry = signal(this.store.platform().defaultCountry);
  protected readonly appearance = signal<Appearance>(this.store.platform().theme.appearance ?? 'system');
  protected readonly logoUrl = signal<string | undefined>(this.store.platform().theme.logoUrl);
  protected readonly surface = signal({ ...(this.store.platform().theme.surface ?? DEFAULT_SURFACE) });
  /** Platform theme being edited (live preview + logo fallback). */
  protected readonly draftTheme = computed(() => ({ primary: this.color(), logoText: this.logo(), logoUrl: this.logoUrl(), appearance: this.appearance(), surface: this.surface() }));
  protected readonly appearances = [
    { value: 'system', label: t('Auto (system)'), icon: 'circle-half-stroke' },
    { value: 'light', label: t('Light'), icon: 'sun' },
    { value: 'dark', label: t('Dark'), icon: 'moon' },
  ];
  protected readonly countries = this.store.countryOptions;
  protected readonly catalog = computed(() =>
    [...this.store.catalogSports()].sort((a, b) => this.store.sportName(a.id).localeCompare(this.store.sportName(b.id))));
  protected readonly dirty = computed(() => {
    const p = this.store.platform();
    return p.theme.primary !== this.color() || p.theme.logoText !== this.logo() || p.defaultCountry !== this.defaultCountry() || (p.theme.appearance ?? 'system') !== this.appearance()
      || p.theme.logoUrl !== this.logoUrl() || JSON.stringify(p.theme.surface ?? DEFAULT_SURFACE) !== JSON.stringify(this.surface());
  });

  constructor() {
    // live preview of the public theme while editing
    effect(() => this.theme.preview.set(this.draftTheme()));
  }

  ngOnDestroy() { this.theme.preview.set(null); }

  setColor(c: string) { this.color.set(c.toLowerCase()); }
  onHex(v: string) { if (/^#[0-9a-f]{6}$/i.test(v)) this.setColor(v); }
  setLogo(v: string) { this.logo.set(v.toUpperCase().slice(0, 3)); }
  iconOf(s: Sport) { return s.icon as IconProp; }

  save() {
    this.store.updatePlatform({ theme: { primary: this.color(), logoText: this.logo() || 'LF', logoUrl: this.logoUrl(), appearance: this.appearance(), surface: this.surface() }, defaultCountry: this.defaultCountry() });
    this.toast.add({ severity: 'success', summary: t('Settings saved'), detail: t('The public site now uses this theme.') });
  }

  reset() {
    const p = this.store.platform();
    this.color.set(p.theme.primary);
    this.logo.set(p.theme.logoText);
    this.defaultCountry.set(p.defaultCountry);
    this.appearance.set(p.theme.appearance ?? 'system');
    this.logoUrl.set(p.theme.logoUrl);
    this.surface.set({ ...(p.theme.surface ?? DEFAULT_SURFACE) });
  }

  onLogoColors(colors: string[]) { if (colors[0]) this.setColor(colors[0]); }

  // ---------- sport catalog ----------
  newSport() { this.sportDialog().open({ id: '', name: '', icon: 'dumbbell' }); }
  editSport(s: Sport) { this.sportDialog().open(s); }
  usage(s: Sport) { return this.store.sportUsage(s.id).gyms; }

  onSportSaved(s: Sport) {
    this.store.saveSport({ ...s, gymId: undefined });
    this.toast.add({ severity: 'success', summary: t('Sport saved'), detail: s.name });
  }

  deleteSport(s: Sport) {
    const used = this.store.sportUsage(s.id);
    this.confirm.confirm({
      header: t('Delete sport'),
      message: used.gyms ? t('{0} is used by {1} gyms. It will be removed from them. Continue?', { 0: this.store.sportName(s.id), 1: used.gyms }) : t('Delete {0}?', { 0: this.store.sportName(s.id) }),
      acceptButtonStyleClass: 'p-button-danger',
      accept: () => {
        this.store.deleteSport(s.id);
        this.toast.add({ severity: 'success', summary: t('Sport deleted') });
      },
    });
  }
}
