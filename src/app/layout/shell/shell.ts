import { LanguageSwitcher } from '../../shared/language-switcher/language-switcher';
import { TranslatePipe, t, CURRENT_LANGUAGE } from '../../core/i18n/i18n';
import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { IconProp } from '@fortawesome/fontawesome-svg-core';
import { FaIconComponent } from '@fortawesome/angular-fontawesome';
import { Avatar } from 'primeng/avatar';
import { Button } from 'primeng/button';
import { Select } from 'primeng/select';
import { Tag } from 'primeng/tag';
import { Tooltip } from 'primeng/tooltip';
import { AuthService } from '../../core/auth.service';
import { Role } from '../../core/models';
import { StoreService } from '../../core/store.service';
import { ThemeService } from '../../core/theme.service';

interface NavItem { label: string; icon: IconProp; link: string; exact?: boolean; }

const NAV: Record<Role, NavItem[]> = {
  SUPER_ADMIN: [
    { label: t('Overview'), icon: 'chart-line', link: '/super-admin', exact: true },
    { label: t('Gyms'), icon: 'building', link: '/super-admin/gyms' },
    { label: t('Pricing plans'), icon: 'tags', link: '/super-admin/plans' },
    { label: t('Users'), icon: 'users', link: '/super-admin/users' },
    { label: t('Currencies & countries'), icon: 'coins', link: '/super-admin/currencies' },
    { label: t('Reports'), icon: 'flag', link: '/super-admin/reports' },
    { label: t('Settings'), icon: 'gear', link: '/super-admin/settings' },
  ],
  ADMIN: [
    { label: t('Dashboard'), icon: 'gauge-high', link: '/admin', exact: true },
    { label: t('Memberships'), icon: 'id-card', link: '/admin/memberships' },
    { label: t('Promo codes'), icon: 'ticket', link: '/admin/promos' },
    { label: t('Clients'), icon: 'users', link: '/admin/clients' },
    { label: t('Coaches'), icon: 'user-tie', link: '/admin/coaches' },
    { label: t('Schedule'), icon: 'clock', link: '/admin/schedule' },
    { label: t('Sports'), icon: 'medal', link: '/admin/sports' },
    { label: t('Reports'), icon: 'flag', link: '/admin/reports' },
    { label: t('Branding'), icon: 'palette', link: '/admin/branding' },
    { label: t('Billing'), icon: 'credit-card', link: '/admin/billing' },
  ],
  COACH: [
    { label: t('Dashboard'), icon: 'gauge-high', link: '/coach', exact: true },
    { label: t('Reviews'), icon: 'star', link: '/coach/reviews' },
    { label: t('My profile'), icon: 'user-pen', link: '/coach/profile' },
  ],
  CLIENT: [
    { label: t('My memberships'), icon: 'id-card', link: '/client', exact: true },
    { label: t('Gyms'), icon: 'magnifying-glass', link: '/client/gyms' },
    { label: t('Coaches'), icon: 'user-tie', link: '/client/coaches' },
  ],
};

const ROLE_LABEL: Record<Role, string> = { SUPER_ADMIN: t('Super admin'), ADMIN: t('Gym admin'), COACH: t('Coach'), CLIENT: t('Member') };

@Component({
  selector: 'app-shell',
  imports: [LanguageSwitcher, TranslatePipe, RouterOutlet, RouterLink, RouterLinkActive, FormsModule, FaIconComponent, Avatar, Button, Select, Tag, Tooltip],
  templateUrl: './shell.html',
  styleUrl: './shell.css',
})
export class Shell {
  protected readonly auth = inject(AuthService);
  protected readonly theme = inject(ThemeService);
  private readonly store = inject(StoreService);
  protected readonly router = inject(Router);
  protected readonly open = signal(false);
  /** Arabic: the mobile sidebar slides in from the right. */
  protected readonly rtl = CURRENT_LANGUAGE.dir === 'rtl';

  protected readonly nav = computed(() => NAV[this.auth.role() ?? 'CLIENT']);
  protected readonly roleLabel = computed(() => ROLE_LABEL[this.auth.role() ?? 'CLIENT']);
  protected readonly initials = computed(() => {
    const u = this.auth.user();
    return u ? (u.firstName[0] + u.lastName[0]).toUpperCase() : '?';
  });
  protected readonly brandName = computed(() => this.auth.activeGym()?.name ?? 'Liftly');
  protected readonly brandLogo = computed(() => this.theme.current().logoText || 'LF');
}
