import { Component, computed, inject } from '@angular/core';
import { MenuItem } from 'primeng/api';
import { FaIconComponent } from '@fortawesome/angular-fontawesome';
import { IconProp } from '@fortawesome/fontawesome-svg-core';
import { ButtonDirective, ButtonIcon } from 'primeng/button';
import { Menu } from 'primeng/menu';
import { Tooltip } from 'primeng/tooltip';
import { TranslatePipe, t } from '../../core/i18n/i18n';
import { AppearanceChoice, ThemeService } from '../../core/theme.service';

/** Header menu: Auto (theme / system setting), Light or Dark — the user's own choice. */
@Component({
  selector: 'app-appearance-switcher',
  imports: [TranslatePipe, FaIconComponent, ButtonDirective, ButtonIcon, Menu, Tooltip],
  templateUrl: './appearance-switcher.html',
  styleUrl: './appearance-switcher.css',
})
export class AppearanceSwitcher {
  protected readonly theme = inject(ThemeService);
  private readonly labels: Record<AppearanceChoice, string> = { auto: t('Auto'), light: t('Light'), dark: t('Dark') };
  private readonly icons: Record<AppearanceChoice, IconProp> = { auto: 'circle-half-stroke', light: 'sun', dark: 'moon' };

  protected readonly icon = computed(() => this.icons[this.theme.userAppearance()]);
  protected readonly tooltip = computed(() => `${t('Appearance')}: ${this.labels[this.theme.userAppearance()]}`);
  protected readonly items = computed<MenuItem[]>(() =>
    (['auto', 'light', 'dark'] as AppearanceChoice[]).map((c) => ({
      id: c,
      label: c === 'auto' ? t('Auto (gym or system setting)') : this.labels[c],
      styleClass: this.theme.userAppearance() === c ? 'font-semibold' : '',
      command: () => this.theme.setAppearance(c),
    })));
  iconOf(id: string | undefined) { return this.icons[(id as AppearanceChoice) ?? 'auto']; }
  selected(id: string | undefined) { return this.theme.userAppearance() === id; }
}
