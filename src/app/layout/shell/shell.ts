import { InstallButton } from '../../shared/install-button/install-button';
import { NotificationBell } from '../../shared/notification-bell/notification-bell';
import { AppearanceSwitcher } from '../../shared/appearance-switcher/appearance-switcher';
import { GymLogo } from '../../shared/gym-logo/gym-logo';
import { LanguageSwitcher } from '../../shared/language-switcher/language-switcher';
import { TranslatePipe, t, CURRENT_LANGUAGE } from '../../core/i18n/i18n';
import { Component, computed, inject, signal, viewChild } from '@angular/core';
import { CommandPalette } from '../../shared/command-palette/command-palette';
import { OfflineQueueService } from '../../core/offline-queue.service';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { IconProp } from '@fortawesome/fontawesome-svg-core';
import { FaIconComponent } from '@fortawesome/angular-fontawesome';
import { Avatar } from 'primeng/avatar';
import { ButtonDirective } from 'primeng/button';
import { Select } from 'primeng/select';
import { Tag } from 'primeng/tag';
import { Tooltip } from 'primeng/tooltip';
import { AuthService } from '../../core/auth.service';
import { GymModule, Role } from '../../core/models';
import { StoreService } from '../../core/store.service';
import { ThemeService } from '../../core/theme.service';

interface NavItem { label: string; icon: IconProp; link: string; exact?: boolean; /** Heading shown above this item. */ section?: string; badge?: 'messages' | 'requests'; /** Hidden behind a padlock when the gym's plan lacks it. */ module?: GymModule; }

const NAV: Record<Role, NavItem[]> = {
  SUPER_ADMIN: [
    { label: t('Overview'), icon: 'chart-line', link: '/super-admin', exact: true },
    { label: t('Gyms'), icon: 'building', link: '/super-admin/gyms' },
    { label: t('Pricing plans'), icon: 'tags', link: '/super-admin/plans' },
    { label: t('Users'), icon: 'users', link: '/super-admin/users' },
    { label: t('Currencies & countries'), icon: 'coins', link: '/super-admin/currencies' },
    { label: t('Reports'), icon: 'flag', link: '/super-admin/reports' },
    { label: t('Accounting'), icon: 'calculator', link: '/super-admin/accounting' },
    { label: t('Announcements'), icon: 'bullhorn', link: '/super-admin/announcements' },
    { label: t('Activity log'), icon: 'clock-rotate-left', link: '/super-admin/activity' },
    { label: t('Settings'), icon: 'gear', link: '/super-admin/settings' },
  ],
  ADMIN: [
    { label: t('Dashboard'), icon: 'gauge-high', link: '/admin', exact: true },
    { label: t('Clients'), icon: 'users', link: '/admin/clients', section: t('Members') },
    { label: t('Join requests'), icon: 'user-clock', link: '/admin/requests', badge: 'requests' },
    { label: t('Memberships'), icon: 'id-card', link: '/admin/memberships' },
    { label: t('Promo codes'), icon: 'ticket', link: '/admin/promos' },
    { label: t('Check-in'), icon: 'qrcode', link: '/admin/checkin', module: 'CHECKIN' },
    { label: t('Attendance'), icon: 'chart-column', link: '/admin/attendance', module: 'CHECKIN' },
    { label: t('Classes'), icon: 'calendar-check', link: '/admin/classes', section: t('Training'), module: 'CLASSES' },
    { label: t('Schedule'), icon: 'clock', link: '/admin/schedule' },
    { label: t('Sports'), icon: 'medal', link: '/admin/sports' },
    { label: t('Coaches'), icon: 'user-tie', link: '/admin/coaches' },
    { label: t('Messages'), icon: 'comments', link: '/admin/messages', section: t('Communication'), badge: 'messages' },
    { label: t('Announcements'), icon: 'bullhorn', link: '/admin/announcements' },
    { label: t('Challenges'), icon: 'trophy', link: '/admin/challenges', module: 'CHALLENGES' },
    { label: t('Reports'), icon: 'flag', link: '/admin/reports' },
    { label: t('Staff'), icon: 'id-badge', link: '/admin/staff', section: t('Gym') },
    { label: t('Locations'), icon: 'location-dot', link: '/admin/locations', module: 'LOCATIONS' },
    { label: t('Equipment & lockers'), icon: 'screwdriver-wrench', link: '/admin/equipment', module: 'EQUIPMENT' },
    { label: t('Staff shifts'), icon: 'business-time', link: '/admin/shifts', module: 'SHIFTS' },
    { label: t('Waiver'), icon: 'file-signature', link: '/admin/waiver', module: 'WAIVERS' },
    { label: t('Branding'), icon: 'palette', link: '/admin/branding' },
    { label: t('Accounting'), icon: 'calculator', link: '/admin/accounting', module: 'ACCOUNTING' },
    { label: t('Billing'), icon: 'credit-card', link: '/admin/billing' },
  ],
  COACH: [
    { label: t('Dashboard'), icon: 'gauge-high', link: '/coach', exact: true },
    { label: t('My schedule'), icon: 'calendar-week', link: '/coach/schedule' },
    { label: t('Athletes'), icon: 'users', link: '/coach/athletes' },
    { label: t('Private sessions'), icon: 'handshake', link: '/coach/sessions' },
    { label: t('My classes'), icon: 'calendar-check', link: '/coach/classes' },
    { label: t('Library'), icon: 'book-open', link: '/coach/library' },
    { label: t('Messages'), icon: 'comments', link: '/coach/messages', badge: 'messages' },
    { label: t('Announcements'), icon: 'bullhorn', link: '/coach/announcements' },
    { label: t('Accounting'), icon: 'calculator', link: '/coach/accounting' },
    { label: t('Reviews'), icon: 'star', link: '/coach/reviews' },
    { label: t('My profile'), icon: 'user-pen', link: '/coach/profile' },
  ],
  STAFF: [
    { label: t('Check-in'), icon: 'qrcode', link: '/staff', exact: true, module: 'CHECKIN' },
    { label: t('Classes'), icon: 'calendar-check', link: '/staff/classes', module: 'CLASSES' },
    { label: t('Clients'), icon: 'users', link: '/staff/clients' },
    { label: t('Attendance'), icon: 'chart-column', link: '/staff/attendance', module: 'CHECKIN' },
    { label: t('My shifts'), icon: 'business-time', link: '/staff/shifts', module: 'SHIFTS' },
    { label: t('Messages'), icon: 'comments', link: '/staff/messages', badge: 'messages' },
    { label: t('Announcements'), icon: 'bullhorn', link: '/staff/announcements' },
  ],
  CLIENT: [
    { label: t('My memberships'), icon: 'id-card', link: '/client', exact: true },
    { label: t('My QR card'), icon: 'qrcode', link: '/client/card' },
    { label: t('Classes'), icon: 'calendar-check', link: '/client/classes' },
    { label: t('Private sessions'), icon: 'handshake', link: '/client/sessions' },
    { label: t('My plans'), icon: 'clipboard-list', link: '/client/plans', section: t('Training') },
    { label: t('Workouts'), icon: 'dumbbell', link: '/client/workouts' },
    { label: t('Progress'), icon: 'weight-scale', link: '/client/progress' },
    { label: t('Achievements'), icon: 'trophy', link: '/client/achievements' },
    { label: t('Messages'), icon: 'comments', link: '/client/messages', section: t('Communication'), badge: 'messages' },
    { label: t('Announcements'), icon: 'bullhorn', link: '/client/announcements' },
    { label: t('Gyms'), icon: 'magnifying-glass', link: '/client/gyms', section: t('Explore') },
    { label: t('Coaches'), icon: 'user-tie', link: '/client/coaches' },
  ],
};

const ROLE_LABEL: Record<Role, string> = { SUPER_ADMIN: t('Super admin'), ADMIN: t('Gym admin'), COACH: t('Coach'), CLIENT: t('Member'), STAFF: t('Front desk') };

@Component({
  selector: 'app-shell',
  imports: [CommandPalette, InstallButton, NotificationBell, AppearanceSwitcher, GymLogo, LanguageSwitcher, TranslatePipe, RouterOutlet, RouterLink, RouterLinkActive, FormsModule, FaIconComponent, Avatar, ButtonDirective, Select, Tag, Tooltip],
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
  protected readonly unread = computed(() => this.store.unreadMessages(this.auth.user()?.id ?? ''));
  protected readonly newRequests = computed(() => this.store.joinRequestsOf(this.auth.activeGym()?.id ?? '').filter((r) => r.status === 'NEW').length);
  locked(item: NavItem) { return !!item.module && !!this.auth.activeGym() && !this.store.hasModule(this.auth.activeGym()!.id, item.module); }
  /** Liftly team messages for this user (banner). */
  protected readonly banners = computed(() => this.store.platformBannersFor(this.auth.user()?.id ?? ''));
  dismissBanner(id: string) { this.store.dismissPlatformAnnouncement(id, this.auth.user()!.id); }
  protected readonly palette = viewChild.required(CommandPalette);
  protected readonly offline = inject(OfflineQueueService);
  skip(e: Event) { e.preventDefault(); document.getElementById('main')?.focus(); }
  protected readonly brandName = computed(() => this.auth.activeGym()?.name ?? 'Liftly');
}
