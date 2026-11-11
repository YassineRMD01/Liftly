import { Component, OnDestroy, computed, effect, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { MessageService } from 'primeng/api';
import { FaIconComponent } from '@fortawesome/angular-fontawesome';
import { Button } from 'primeng/button';
import { ColorPicker } from 'primeng/colorpicker';
import { InputText } from 'primeng/inputtext';
import { Message } from 'primeng/message';
import { MultiSelect } from 'primeng/multiselect';
import { Select } from 'primeng/select';
import { CURRENCIES, MoneyPipe } from '../../../core/currency';
import { Tag } from 'primeng/tag';
import { Textarea } from 'primeng/textarea';
import { ToggleSwitch } from 'primeng/toggleswitch';
import { AuthService } from '../../../core/auth.service';
import { Gym } from '../../../core/models';
import { StoreService } from '../../../core/store.service';
import { ThemeService } from '../../../core/theme.service';
import { PageHeader } from '../../../shared/page-header/page-header';
import { SPORTS } from '../../public/signup/signup';

const PRESETS = ['#6366f1', '#ef4444', '#f97316', '#f59e0b', '#10b981', '#14b8a6', '#0ea5e9', '#3b82f6', '#8b5cf6', '#ec4899', '#111827', '#84cc16'];

@Component({
  selector: 'app-admin-branding',
  imports: [MoneyPipe, FormsModule, RouterLink, FaIconComponent, Button, ColorPicker, InputText, Message, MultiSelect, Select, Tag, Textarea, ToggleSwitch, PageHeader],
  templateUrl: './admin-branding.html',
  styleUrl: './admin-branding.css',
})
export class AdminBranding implements OnDestroy {
  private readonly auth = inject(AuthService);
  private readonly store = inject(StoreService);
  protected readonly theme = inject(ThemeService);
  private readonly toast = inject(MessageService);
  protected readonly presets = PRESETS;
  protected readonly sports = SPORTS;
  protected readonly currencies = CURRENCIES;
  protected readonly color = signal('#6366f1');
  protected readonly logo = signal('');
  protected draft: Gym = this.auth.activeGym()!;
  protected readonly allowed = computed(() => !!this.store.saasPlan(this.auth.activeGym()?.saasPlanId)?.customTheme);

  constructor() {
    this.load();
    effect(() => this.theme.preview.set({ primary: this.color(), logoText: this.logo() }));
  }

  ngOnDestroy() { this.theme.preview.set(null); }

  load() {
    const g = this.auth.activeGym();
    if (!g) return;
    this.draft = structuredClone(g);
    this.color.set(g.theme.primary);
    this.logo.set(g.theme.logoText);
  }

  setColor(c: string) { this.color.set(c.toLowerCase()); }
  onHex(v: string) { if (/^#[0-9a-f]{6}$/i.test(v)) this.setColor(v); }
  setLogo(v: string) { this.logo.set(v.toUpperCase().slice(0, 3)); }

  save() {
    const current = this.auth.activeGym();
    if (!current) return;
    if (!this.draft.sports.length) {
      this.toast.add({ severity: 'error', summary: 'Pick at least one sport' });
      return;
    }
    const keepColor = this.allowed() ? this.color() : current.theme.primary;
    this.store.updateGym({ ...this.draft, theme: { primary: keepColor, logoText: this.logo() } });
    if (!this.allowed()) {
      this.color.set(current.theme.primary);
      this.toast.add({ severity: 'warn', summary: 'Saved without color', detail: 'Upgrade to Pro to use a custom color.' });
    } else {
      this.toast.add({ severity: 'success', summary: 'Branding saved', detail: 'Your gym theme is live.' });
    }
  }
}
