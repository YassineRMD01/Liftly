import { Component, computed, inject, signal } from '@angular/core';
import { CurrencyPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { FaIconComponent } from '@fortawesome/angular-fontawesome';
import { IconProp } from '@fortawesome/fontawesome-svg-core';
import { Button } from 'primeng/button';
import { SelectButton } from 'primeng/selectbutton';
import { Tag } from 'primeng/tag';
import { AuthService, HOME_BY_ROLE } from '../../../core/auth.service';
import { BillingCycle } from '../../../core/models';
import { StoreService } from '../../../core/store.service';
import { ThemeService } from '../../../core/theme.service';

@Component({
  selector: 'app-landing',
  imports: [RouterLink, FormsModule, CurrencyPipe, FaIconComponent, Button, SelectButton, Tag],
  templateUrl: './landing.html',
  styleUrl: './landing.css',
})
export class Landing {
  protected readonly auth = inject(AuthService);
  protected readonly theme = inject(ThemeService);
  private readonly store = inject(StoreService);
  protected readonly year = new Date().getFullYear();
  protected readonly cycle = signal<BillingCycle>('MONTHLY');
  protected readonly cycles = [
    { label: 'Monthly', value: 'MONTHLY' },
    { label: 'Yearly (2 months free)', value: 'YEARLY' },
  ];
  protected readonly plans = computed(() => this.store.saasPlans().filter((p) => p.active));
  protected readonly home = computed(() => HOME_BY_ROLE[this.auth.role() ?? 'CLIENT']);

  protected readonly showcase: { icon: IconProp; label: string; text: string }[] = [
    { icon: 'id-card', label: 'Memberships', text: 'Create plans with any duration and price.' },
    { icon: 'ticket', label: 'Promo codes', text: 'Percent or fixed discounts with limits.' },
    { icon: 'star', label: 'Coach ratings', text: 'Members rate and review their coaches.' },
    { icon: 'palette', label: 'Your brand', text: 'Pick your colors — the app follows.' },
  ];
  protected readonly roles: { icon: IconProp; title: string; items: string[] }[] = [
    { icon: 'crown', title: 'Platform owner', items: ['Manage pricing plans', 'Monitor all gyms & MRR', 'Suspend or activate gyms'] },
    { icon: 'building', title: 'Gym admin', items: ['Register clients & memberships', 'Membership plans & promo codes', 'Opening hours: mixed, men-only & women-only', 'Multi-sport gyms', 'Custom theme color'] },
    { icon: 'user-tie', title: 'Coach', items: ['Work at multiple gyms', 'Star ratings & comments', 'Public profile'] },
    { icon: 'person-running', title: 'Member', items: ['Registered by each gym', 'Member of many gyms', 'See hours open to you', 'Rate your coaches'] },
  ];
}
