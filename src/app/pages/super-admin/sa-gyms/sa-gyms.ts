import { GymLogo } from '../../../shared/gym-logo/gym-logo';
import { Stars } from '../../../shared/stars/stars';
import { countryName } from '../../../core/currency';
import { TranslatePipe, t } from '../../../core/i18n/i18n';
import { Component, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MessageService } from 'primeng/api';
import { FaIconComponent } from '@fortawesome/angular-fontawesome';
import { Button } from 'primeng/button';
import { downloadCsv } from '../../../core/csv';
import { IconField } from 'primeng/iconfield';
import { InputIcon } from 'primeng/inputicon';
import { InputText } from 'primeng/inputtext';
import { Select } from 'primeng/select';
import { TableModule } from 'primeng/table';
import { Tag } from 'primeng/tag';
import { AuthService } from '../../../core/auth.service';
import { Gym, GymStatus } from '../../../core/models';
import { StoreService } from '../../../core/store.service';
import { PageHeader } from '../../../shared/page-header/page-header';

export const statusSeverity = (s: string) =>
  ({ ACTIVE: 'success', TRIAL: 'info', SUSPENDED: 'danger', EXPIRED: 'secondary', CANCELLED: 'warn' } as const)[s as GymStatus] ?? 'secondary';

@Component({
  selector: 'app-sa-gyms',
  imports: [GymLogo, Stars, TranslatePipe, FormsModule, DatePipe, FaIconComponent, Button, IconField, InputIcon, InputText, Select, TableModule, Tag, PageHeader],
  templateUrl: './sa-gyms.html',
  styleUrl: './sa-gyms.css',
})
export class SaGyms {
  protected readonly countryName = countryName;
  protected readonly store = inject(StoreService);
  private readonly toast = inject(MessageService);
  protected readonly statuses: GymStatus[] = ['ACTIVE', 'TRIAL', 'SUSPENDED'];
  protected readonly sev = statusSeverity;

  update(g: Gym, patch: Partial<Gym>) {
    this.store.updateGym({ ...g, ...patch });
    this.toast.add({ severity: 'success', summary: t('Gym updated'), detail: g.name });
  }

  exportCsv() {
    downloadCsv('liftly-gyms', ['Gym', 'Owner', 'Email', 'Country', 'City', 'Plan', 'Cycle', 'Status', 'Subscribed', 'Renews', 'Members', 'MRR (USD)'],
      this.store.gyms().map((g) => [g.name, this.store.fullName(g.ownerId), this.store.user(g.ownerId)?.email, g.country, g.city, this.store.saasPlan(g.saasPlanId)?.name, g.billingCycle, g.status,
        g.subscribedAt.slice(0, 10), g.renewsAt.slice(0, 10), this.store.clientsOfGym(g.id).length, Math.round(this.store.gymMrrUsd(g) * 100) / 100]));
  }
}
