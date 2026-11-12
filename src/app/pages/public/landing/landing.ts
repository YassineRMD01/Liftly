import { GymLogo } from '../../../shared/gym-logo/gym-logo';
import { AppearanceSwitcher } from '../../../shared/appearance-switcher/appearance-switcher';
import { formatMoney } from '../../../core/currency';
import { Select } from 'primeng/select';
import { LanguageSwitcher } from '../../../shared/language-switcher/language-switcher';
import { TranslatePipe, t } from '../../../core/i18n/i18n';
import { Component, computed, inject, signal } from '@angular/core';

import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { FaIconComponent } from '@fortawesome/angular-fontawesome';
import { IconProp } from '@fortawesome/fontawesome-svg-core';
import { ButtonDirective } from 'primeng/button';
import { SelectButton } from 'primeng/selectbutton';
import { Tag } from 'primeng/tag';
import { AuthService, HOME_BY_ROLE } from '../../../core/auth.service';
import { BillingCycle, SaasPlan } from '../../../core/models';
import { StoreService } from '../../../core/store.service';
import { ThemeService } from '../../../core/theme.service';

@Component({
  selector: 'app-landing',
  imports: [GymLogo, AppearanceSwitcher, Select, LanguageSwitcher, TranslatePipe, RouterLink, FormsModule, FaIconComponent, ButtonDirective, SelectButton, Tag],
  templateUrl: './landing.html',
  styleUrl: './landing.css',
})
export class Landing {
  protected readonly auth = inject(AuthService);
  protected readonly theme = inject(ThemeService);
  protected readonly store = inject(StoreService);
  protected readonly year = new Date().getFullYear();
  protected readonly cycle = signal<BillingCycle>('MONTHLY');
  /** Pricing is shown for this country (local prices set by the super-admin, else USD). */
  protected readonly country = signal(this.store.platform().defaultCountry);
  protected readonly countries = this.store.countryOptions;
  protected readonly cycles = [
    { label: t('Monthly'), value: 'MONTHLY' },
    { label: t('Yearly (2 months free)'), value: 'YEARLY' },
  ];
  protected readonly plans = computed(() => this.store.saasPlans().filter((p) => p.active));
  protected readonly home = computed(() => HOME_BY_ROLE[this.auth.role() ?? 'CLIENT']);

  protected readonly showcase: { icon: IconProp; label: string; text: string }[] = [
    { icon: 'id-card', label: t('Memberships'), text: t('Create plans with any duration and price.') },
    { icon: 'ticket', label: t('Promo codes'), text: t('Percent or fixed discounts with limits.') },
    { icon: 'star', label: t('Coach ratings'), text: t('Members rate and review their coaches.') },
    { icon: 'palette', label: t('Your brand'), text: t('Pick your colors — the app follows.') },
  ];
  priceLabel(p: SaasPlan) {
    const x = this.store.saasPrice(p, this.country(), this.cycle());
    return formatMoney(x.amount, x.currency, 0);
  }

  protected readonly roles: { icon: IconProp; title: string; items: string[] }[] = [
    { icon: 'crown', title: t('Platform owner'), items: [t('Manage pricing plans'), t('Monitor all gyms & MRR'), t('Suspend or activate gyms')] },
    { icon: 'building', title: t('Gym admin'), items: [t('Register clients & memberships'), t('Membership plans & promo codes'), t('Opening hours: mixed, men-only & women-only'), t('Multi-sport gyms'), t('Custom theme color')] },
    { icon: 'user-tie', title: t('Coach'), items: [t('Work at multiple gyms'), t('Star ratings & comments'), t('Public profile')] },
    { icon: 'person-running', title: t('Member'), items: [t('Registered by each gym'), t('Member of many gyms'), t('See hours open to you'), t('Rate your coaches')] },
  ];
}
