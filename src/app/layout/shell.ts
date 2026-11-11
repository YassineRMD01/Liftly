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
import { AuthService } from '../core/auth.service';
import { Role } from '../core/models';
import { StoreService } from '../core/store.service';
import { ThemeService } from '../core/theme.service';

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
    { label: 'Find a gym', icon: 'magnifying-glass', link: '/client/gyms' },
    { label: 'Coaches', icon: 'user-tie', link: '/client/coaches' },
  ],
};

const ROLE_LABEL: Record<Role, string> = { SUPER_ADMIN: 'Super admin', ADMIN: 'Gym admin', COACH: 'Coach', CLIENT: 'Member' };

@Component({
  selector: 'app-shell',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, FormsModule, FaIconComponent, Avatar, Button, Select, Tag, Tooltip],
  template: `
    <div class="min-h-screen flex">
      <!-- mobile backdrop -->
      @if (open()) {
        <div class="fixed inset-0 bg-black/40 z-30 lg:hidden" (click)="open.set(false)"></div>
      }

      <aside
        class="fixed lg:sticky top-0 z-40 h-screen w-64 shrink-0 flex flex-col bg-surface-0 dark:bg-surface-900 border-r border-surface-200 dark:border-surface-800 transition-transform lg:translate-x-0"
        [class.-translate-x-full]="!open()"
      >
        <a routerLink="/" class="flex items-center gap-3 px-5 h-16 border-b border-surface-200 dark:border-surface-800">
          <span class="w-9 h-9 rounded-xl bg-primary text-primary-contrast grid place-items-center font-extrabold text-sm">
            {{ brandLogo() }}
          </span>
          <span class="font-bold text-lg truncate">{{ brandName() }}</span>
        </a>

        @if (auth.adminGyms().length > 1) {
          <div class="px-4 pt-4">
            <p-select
              class="w-full"
              [options]="auth.adminGyms()"
              optionLabel="name"
              optionValue="id"
              [ngModel]="auth.activeGym()?.id"
              (ngModelChange)="auth.selectGym($event)"
            />
          </div>
        }

        <nav class="flex-1 overflow-y-auto p-3 space-y-1">
          @for (item of nav(); track item.link) {
            <a
              [routerLink]="item.link"
              routerLinkActive="!bg-primary !text-primary-contrast shadow"
              [routerLinkActiveOptions]="{ exact: !!item.exact }"
              (click)="open.set(false)"
              class="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-surface-600 dark:text-surface-300 hover:bg-surface-100 dark:hover:bg-surface-800 transition-colors"
            >
              <fa-icon [icon]="item.icon" class="w-5 text-center" />
              {{ item.label }}
            </a>
          }
        </nav>

        <div class="p-4 border-t border-surface-200 dark:border-surface-800 flex items-center gap-3">
          <p-avatar [label]="initials()" shape="circle" styleClass="!bg-primary-100 !text-primary-700" />
          <div class="min-w-0 flex-1">
            <div class="text-sm font-semibold truncate">{{ auth.user()?.firstName }} {{ auth.user()?.lastName }}</div>
            <div class="text-xs muted truncate">{{ auth.user()?.email }}</div>
          </div>
          <p-button [text]="true" [rounded]="true" severity="secondary" (onClick)="auth.logout()" pTooltip="Sign out">
            <fa-icon icon="right-from-bracket" />
          </p-button>
        </div>
      </aside>

      <div class="flex-1 min-w-0 flex flex-col">
        <header class="sticky top-0 z-20 h-16 flex items-center gap-3 px-4 lg:px-8 bg-surface-0/80 dark:bg-surface-900/80 backdrop-blur border-b border-surface-200 dark:border-surface-800">
          <p-button class="lg:hidden" [text]="true" severity="secondary" (onClick)="open.set(true)" ariaLabel="Open menu">
            <fa-icon icon="bars" />
          </p-button>
          <p-tag [value]="roleLabel()" [rounded]="true" />
          @if (auth.activeGym(); as g) {
            <span class="hidden sm:inline text-sm muted">Managing <b class="text-surface-800 dark:text-surface-100">{{ g.name }}</b></span>
          }
          <div class="flex-1"></div>
          <p-button [text]="true" [rounded]="true" severity="secondary" (onClick)="theme.toggleDark()" [pTooltip]="theme.dark() ? 'Light mode' : 'Dark mode'" tooltipPosition="left">
            <fa-icon [icon]="theme.dark() ? 'sun' : 'moon'" />
          </p-button>
        </header>
        <main class="flex-1 p-4 lg:p-8 max-w-7xl w-full mx-auto">
          <router-outlet />
        </main>
      </div>
    </div>
  `,
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
