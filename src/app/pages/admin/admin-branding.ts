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
import { Tag } from 'primeng/tag';
import { Textarea } from 'primeng/textarea';
import { ToggleSwitch } from 'primeng/toggleswitch';
import { AuthService } from '../../core/auth.service';
import { Gym } from '../../core/models';
import { StoreService } from '../../core/store.service';
import { ThemeService } from '../../core/theme.service';
import { PageHeader } from '../../shared/ui';
import { SPORTS } from '../public/signup';

const PRESETS = ['#6366f1', '#ef4444', '#f97316', '#f59e0b', '#10b981', '#14b8a6', '#0ea5e9', '#3b82f6', '#8b5cf6', '#ec4899', '#111827', '#84cc16'];

@Component({
  selector: 'app-admin-branding',
  imports: [FormsModule, RouterLink, FaIconComponent, Button, ColorPicker, InputText, Message, Select, Tag, Textarea, ToggleSwitch, PageHeader],
  template: `
    <app-page-header title="Branding" subtitle="Make the app look like your gym — your members and coaches will see it too.">
      <p-button label="Reset" severity="secondary" [outlined]="true" (onClick)="load()" />
      <p-button label="Save changes" (onClick)="save()" />
    </app-page-header>

    @if (!allowed()) {
      <p-message severity="warn" styleClass="mb-6">
        <span>Custom colors are part of the <b>Pro</b> plan. You can preview them here, then <a routerLink="/admin/billing" class="underline font-semibold">upgrade</a> to save.</span>
      </p-message>
    }

    <div class="grid lg:grid-cols-5 gap-6">
      <div class="lg:col-span-3 space-y-6">
        <div class="card space-y-5">
          <h2 class="font-semibold">Brand color</h2>
          <div class="flex flex-wrap gap-3">
            @for (c of presets; track c) {
              <button type="button" (click)="setColor(c)" [style.background]="c" [attr.aria-label]="'Use ' + c"
                class="w-10 h-10 rounded-xl cursor-pointer ring-offset-2 ring-offset-surface-0 dark:ring-offset-surface-900 transition"
                [class.ring-2]="color() === c" [class.ring-surface-900]="color() === c"></button>
            }
          </div>
          <div class="flex items-center gap-4">
            <p-colorpicker [ngModel]="color().slice(1)" (ngModelChange)="setColor('#' + $event)" />
            <input pInputText class="w-32 font-mono" [ngModel]="color()" (ngModelChange)="onHex($event)" />
            <span class="text-sm muted">Any hex color</span>
          </div>
          <label class="flex items-center gap-3"><p-toggleswitch [ngModel]="theme.dark()" (ngModelChange)="theme.dark.set($event)" /> Preview in dark mode</label>
        </div>

        <div class="card space-y-4">
          <h2 class="font-semibold">Gym identity</h2>
          <div class="grid sm:grid-cols-2 gap-4">
            <div class="field"><label>Gym name</label><input pInputText [(ngModel)]="draft.name" /></div>
            <div class="field"><label>Logo initials</label><input pInputText maxlength="3" class="uppercase" [ngModel]="logo()" (ngModelChange)="setLogo($event)" /></div>
            <div class="field"><label>Sport</label><p-select [options]="sports" [(ngModel)]="draft.sport" styleClass="w-full" /></div>
            <div class="field"><label>City</label><input pInputText [(ngModel)]="draft.city" /></div>
            <div class="field sm:col-span-2"><label>Address</label><input pInputText [(ngModel)]="draft.address" /></div>
            <div class="field sm:col-span-2"><label>Description</label><textarea pTextarea rows="3" [(ngModel)]="draft.description"></textarea></div>
          </div>
        </div>
      </div>

      <!-- live preview -->
      <div class="lg:col-span-2">
        <div class="sticky top-24">
          <div class="text-sm font-semibold mb-2">Live preview — member app</div>
          <div class="card !p-0 overflow-hidden">
            <div class="bg-primary text-primary-contrast p-5">
              <div class="flex items-center gap-3">
                <span class="w-11 h-11 rounded-xl bg-white/20 grid place-items-center font-extrabold">{{ logo() }}</span>
                <div>
                  <div class="font-bold text-lg">{{ draft.name || 'Your gym' }}</div>
                  <div class="text-sm opacity-80">{{ draft.sport }} · {{ draft.city }}</div>
                </div>
              </div>
            </div>
            <div class="p-5 space-y-4">
              <p class="text-sm muted">{{ draft.description || 'Your description appears here.' }}</p>
              <div class="flex gap-2 flex-wrap">
                <p-tag value="Open now" /><p-tag value="Coaching" severity="secondary" />
              </div>
              <div class="p-4 rounded-xl border border-primary-200 dark:border-primary-800 bg-primary-50 dark:bg-primary-950">
                <div class="font-semibold">Monthly unlimited</div>
                <div class="text-2xl font-bold text-primary">$49</div>
              </div>
              <div class="flex gap-2">
                <p-button label="Join now" styleClass="flex-1" class="flex-1" />
                <p-button [outlined]="true"><fa-icon icon="heart" /></p-button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  `,
})
export class AdminBranding implements OnDestroy {
  private readonly auth = inject(AuthService);
  private readonly store = inject(StoreService);
  protected readonly theme = inject(ThemeService);
  private readonly toast = inject(MessageService);
  protected readonly presets = PRESETS;
  protected readonly sports = SPORTS;
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
