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
    { label: 'Overview', icon: 'chart-line', link: '/super-admin', exact: true },
    { label: 'Gyms', icon: 'building', link: '/super-admin/gyms' },
    { label: 'Pricing plans', icon: 'tags', link: '/super-admin/plans' },
    { label: 'Users', icon: 'users', link: '/super-admin/users' },
  ],
  ADMIN: [
    { label: 'Dashboard', icon: 'gauge-high', link: '/admin', exact: true },
    { label: 'Memberships', icon: 'id-card', link: '/admin/memberships' },
    { label: 'Promo codes', icon: 'ticket', link: '/admin/promos' },
    { label: 'Clients', icon: 'users', link: '/admin/clients' },
    { label: 'Coaches', icon: 'user-tie', link: '/admin/coaches' },
    { label: 'Schedule', icon: 'clock', link: '/admin/schedule' },
    { label: 'Branding', icon: 'palette', link: '/admin/branding' },
    { label: 'Billing', icon: 'credit-card', link: '/admin/billing' },
  ],
  COACH: [
    { label: 'Dashboard', icon: 'gauge-high', link: '/coach', exact: true },
    { label: 'Reviews', icon: 'star', link: '/coach/reviews' },
    { label: 'My profile', icon: 'user-pen', link: '/coach/profile' },
  ],
  CLIENT: [
    { label: 'My memberships', icon: 'id-card', link: '/client', exact: true },
    { label: 'Gyms', icon: 'magnifying-glass', link: '/client/gyms' },
    { label: 'Coaches', icon: 'user-tie', link: '/client/coaches' },
  ],
};

const ROLE_LABEL: Record<Role, string> = { SUPER_ADMIN: 'Super admin', ADMIN: 'Gym admin', COACH: 'Coach', CLIENT: 'Member' };

@Component({
  selector: 'app-shell',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, FormsModule, FaIconComponent, Avatar, Button, Select, Tag, Tooltip],
  templateUrl: './shell.html',
  styleUrl: './shell.css',
})
export class Shell {
  protected readonly auth = inject(AuthService);
  protected readonly theme = inject(ThemeService);
  private readonly store = inject(StoreService);
  protected readonly router = inject(Router);
  protected readonly open = signal(false);

  protected readonly nav = computed(() => NAV[this.auth.role() ?? 'CLIENT']);
  protected readonly roleLabel = computed(() => ROLE_LABEL[this.auth.role() ?? 'CLIENT']);
  protected readonly initials = computed(() => {
    const u = this.auth.user();
    return u ? (u.firstName[0] + u.lastName[0]).toUpperCase() : '?';
  });
  protected readonly brandName = computed(() => this.auth.activeGym()?.name ?? 'Liftly');
  protected readonly brandLogo = computed(() => this.theme.current().logoText || 'LF');
}
