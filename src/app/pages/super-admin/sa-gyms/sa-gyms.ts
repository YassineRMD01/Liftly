import { TranslatePipe, t, TranslateJoinPipe } from '../../../core/i18n/i18n';
import { Component, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MessageService } from 'primeng/api';
import { FaIconComponent } from '@fortawesome/angular-fontawesome';
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
  imports: [TranslateJoinPipe, TranslatePipe, FormsModule, DatePipe, FaIconComponent, IconField, InputIcon, InputText, Select, TableModule, Tag, PageHeader],
  templateUrl: './sa-gyms.html',
  styleUrl: './sa-gyms.css',
})
export class SaGyms {
  protected readonly store = inject(StoreService);
  private readonly toast = inject(MessageService);
  protected readonly statuses: GymStatus[] = ['ACTIVE', 'TRIAL', 'SUSPENDED'];
  protected readonly sev = statusSeverity;

  update(g: Gym, patch: Partial<Gym>) {
    this.store.updateGym({ ...g, ...patch });
    this.toast.add({ severity: 'success', summary: t('Gym updated'), detail: g.name });
  }
}
