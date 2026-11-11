import { TranslatePipe, t } from '../../../core/i18n/i18n';
import { Component, computed, inject, signal } from '@angular/core';
import { MoneyPipe } from '../../../core/currency';
import { FormsModule } from '@angular/forms';
import { FaIconComponent } from '@fortawesome/angular-fontawesome';
import { Button } from 'primeng/button';
import { Dialog } from 'primeng/dialog';
import { IconField } from 'primeng/iconfield';
import { InputIcon } from 'primeng/inputicon';
import { InputText } from 'primeng/inputtext';
import { Message } from 'primeng/message';
import { Select } from 'primeng/select';
import { Tag } from 'primeng/tag';
import { AuthService } from '../../../core/auth.service';
import { Gym } from '../../../core/models';
import { formatMoney } from '../../../core/currency';
import { StoreService } from '../../../core/store.service';
import { ThemeService } from '../../../core/theme.service';
import { OpenStatusBadge } from '../../../shared/open-status/open-status';
import { WeekCalendar } from '../../../shared/week-calendar/week-calendar';
import { WeekSchedule } from '../../../shared/week-schedule/week-schedule';
import { PageHeader } from '../../../shared/page-header/page-header';
import { Stars } from '../../../shared/stars/stars';

/**
 * Members can browse gyms, but cannot subscribe themselves:
 * memberships are created by the gym admin (Admin → Clients).
 */
@Component({
  selector: 'app-client-gyms',
  imports: [TranslatePipe, MoneyPipe, FormsModule, FaIconComponent, Button, Dialog, IconField, InputIcon, InputText, Message, Select, Tag, PageHeader, Stars, OpenStatusBadge, WeekCalendar, WeekSchedule],
  templateUrl: './client-gyms.html',
  styleUrl: './client-gyms.css',
})
export class ClientGyms {
  private readonly auth = inject(AuthService);
  protected readonly store = inject(StoreService);
  protected readonly theme = inject(ThemeService);
  protected visible = false;
  protected readonly q = signal('');
  protected readonly sport = signal<string | null>(null);
  protected readonly gym = signal<Gym | null>(null);
  protected readonly gender = computed(() => this.auth.user()?.gender);

  protected readonly sports = computed(() =>
    [...new Set(this.store.gyms().flatMap((g) => g.sportIds))].map((id) => ({ label: this.store.sportName(id), value: id })).sort((a, b) => a.label.localeCompare(b.label)));
  protected readonly gyms = computed(() => {
    const q = this.q().toLowerCase();
    return this.store.gyms().filter((g) => g.status !== 'SUSPENDED' &&
      (!this.sport() || g.sportIds.includes(this.sport()!)) &&
      (!q || `${g.name} ${g.city} ${this.store.sportNames(g)}`.toLowerCase().includes(q)));
  });
  protected readonly plans = computed(() => (this.gym() ? this.store.plansOfGym(this.gym()!.id).filter((p) => p.active) : []));
  protected readonly coaches = computed(() => (this.gym() ? this.store.coachesOfGym(this.gym()!.id) : []));

  /** Cheapest active plan, preferring plans in the gym's own currency, formatted. */
  fromPrice(gym: Gym) {
    const plans = this.store.plansOfGym(gym.id).filter((p) => p.active);
    const local = plans.filter((p) => this.store.planCurrency(p) === gym.currency);
    const cheapest = [...(local.length ? local : plans)].sort((a, b) => a.price - b.price)[0];
    return cheapest ? formatMoney(cheapest.price, this.store.planCurrency(cheapest)) : '—';
  }
  isBanned(gymId: string) { return this.store.isBanned(gymId, this.auth.user()?.id ?? ''); }

  isMember(gymId: string) {
    return this.store.membershipsOfClient((this.auth.user()?.id ?? '')).some((m) => m.gymId === gymId && m.status === 'ACTIVE');
  }

  open(g: Gym) {
    this.gym.set(g);
    this.theme.preview.set(g.theme); // show the gym's own brand while viewing it
    this.visible = true;
  }
}
