import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { FaIconComponent } from '@fortawesome/angular-fontawesome';
import { IconProp } from '@fortawesome/fontawesome-svg-core';
import { IconField } from 'primeng/iconfield';
import { InputIcon } from 'primeng/inputicon';
import { InputText } from 'primeng/inputtext';
import { Select } from 'primeng/select';
import { countryName, formatMoney } from '../../../core/currency';
import { TranslatePipe, t } from '../../../core/i18n/i18n';
import { StoreService } from '../../../core/store.service';
import { GymLogo } from '../../../shared/gym-logo/gym-logo';
import { OpenStatusBadge } from '../../../shared/open-status/open-status';
import { PublicHeader } from '../../../shared/public-header/public-header';
import { Stars } from '../../../shared/stars/stars';

/** Public directory of Liftly gyms: search by name or city, filter by sport and country. */
@Component({
  selector: 'app-gym-directory',
  imports: [TranslatePipe, FormsModule, RouterLink, FaIconComponent, IconField, InputIcon, InputText, Select, GymLogo, OpenStatusBadge, PublicHeader, Stars],
  templateUrl: './gym-directory.html',
  styleUrl: './gym-directory.css',
})
export class GymDirectory {
  protected readonly store = inject(StoreService);
  protected readonly q = signal('');
  protected readonly sport = signal<string | null>(null);
  protected readonly country = signal<string | null>(null);

  protected readonly sports = computed(() => {
    const ids = new Set(this.store.publishedGyms().flatMap((g) => g.sportIds));
    return [...ids].map((id) => ({ value: id, label: this.store.sportName(id) })).sort((a, b) => a.label.localeCompare(b.label));
  });
  protected readonly countries = computed(() => [...new Set(this.store.publishedGyms().map((g) => g.country))].map((c) => ({ value: c, label: countryName(c) })));
  protected readonly gyms = computed(() => {
    const q = this.q().trim().toLowerCase();
    return this.store.publishedGyms().filter((g) =>
      (!q || `${g.name} ${g.city} ${g.description} ${(g.locations ?? []).map((l) => l.city + ' ' + l.name).join(' ')}`.toLowerCase().includes(q)) &&
      (!this.sport() || g.sportIds.includes(this.sport()!)) &&
      (!this.country() || g.country === this.country()));
  });
  sportIcon(id: string) { return (this.store.sports().find((s) => s.id === id)?.icon ?? 'dumbbell') as IconProp; }
  rating(id: string) { return this.store.gymRating(id); }
  minPrice(gymId: string) {
    const plans = this.store.plansOfGym(gymId).filter((p) => p.active);
    if (!plans.length) return '';
    const p = plans.reduce((a, b) => (a.price <= b.price ? a : b));
    return t('from {price}', { price: formatMoney(p.price, this.store.planCurrency(p), 0) });
  }
}
