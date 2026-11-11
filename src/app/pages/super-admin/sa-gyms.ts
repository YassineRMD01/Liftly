import { Component, computed, inject, signal } from '@angular/core';
import { CurrencyPipe, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MessageService } from 'primeng/api';
import { FaIconComponent } from '@fortawesome/angular-fontawesome';
import { IconField } from 'primeng/iconfield';
import { InputIcon } from 'primeng/inputicon';
import { InputText } from 'primeng/inputtext';
import { Select } from 'primeng/select';
import { TableModule } from 'primeng/table';
import { Tag } from 'primeng/tag';
import { AuthService } from '../../core/auth.service';
import { Gym, GymStatus } from '../../core/models';
import { StoreService } from '../../core/store.service';
import { PageHeader } from '../../shared/ui';

export const statusSeverity = (s: string) =>
  ({ ACTIVE: 'success', TRIAL: 'info', SUSPENDED: 'danger', EXPIRED: 'secondary', CANCELLED: 'warn' } as const)[s as GymStatus] ?? 'secondary';

@Component({
  selector: 'app-sa-gyms',
  imports: [FormsModule, CurrencyPipe, DatePipe, FaIconComponent, IconField, InputIcon, InputText, Select, TableModule, Tag, PageHeader],
  template: `
    <app-page-header title="Gyms" subtitle="All tenants subscribed to the platform." />
    <div class="card">
      <p-table #dt [value]="store.gyms()" [paginator]="true" [rows]="10" [globalFilterFields]="['name', 'sports', 'city']" [tableStyle]="{ 'min-width': '60rem' }">
        <ng-template #caption>
          <p-iconfield>
            <p-inputicon><fa-icon icon="magnifying-glass" /></p-inputicon>
            <input pInputText placeholder="Search gyms" (input)="dt.filterGlobal($any($event.target).value, 'contains')" />
          </p-iconfield>
        </ng-template>
        <ng-template #header>
          <tr>
            <th pSortableColumn="name">Gym <p-sorticon field="name" /></th>
            <th>Owner</th><th>Plan</th><th>Coaches / Clients</th><th>Revenue</th><th>Renews</th><th>Status</th>
          </tr>
        </ng-template>
        <ng-template #body let-g>
          <tr>
            <td>
              <div class="flex items-center gap-3">
                <span class="w-9 h-9 rounded-lg grid place-items-center text-white text-xs font-bold" [style.background]="g.theme.primary">{{ g.theme.logoText }}</span>
                <div><div class="font-medium">{{ g.name }}</div><div class="text-xs muted">{{ g.sports.join(', ') }} · {{ g.city }}</div></div>
              </div>
            </td>
            <td>{{ store.fullName(g.ownerId) }}</td>
            <td>
              <p-select [options]="store.saasPlans()" optionLabel="name" optionValue="id" [ngModel]="g.saasPlanId"
                (ngModelChange)="update(g, { saasPlanId: $event })" size="small" appendTo="body" />
            </td>
            <td>{{ store.coachesOfGym(g.id).length }} / {{ store.clientsOfGym(g.id).length }}</td>
            <td>{{ store.gymRevenue(g.id) | currency }}</td>
            <td>{{ g.renewsAt | date }}</td>
            <td>
              <p-select [options]="statuses" [ngModel]="g.status" (ngModelChange)="update(g, { status: $event })" size="small" appendTo="body">
                <ng-template #selectedItem let-s><p-tag [value]="s" [severity]="sev(s)" /></ng-template>
                <ng-template #item let-s><p-tag [value]="s" [severity]="sev(s)" /></ng-template>
              </p-select>
            </td>
          </tr>
        </ng-template>
      </p-table>
    </div>
  `,
})
export class SaGyms {
  protected readonly store = inject(StoreService);
  private readonly toast = inject(MessageService);
  protected readonly statuses: GymStatus[] = ['ACTIVE', 'TRIAL', 'SUSPENDED'];
  protected readonly sev = statusSeverity;

  update(g: Gym, patch: Partial<Gym>) {
    this.store.updateGym({ ...g, ...patch });
    this.toast.add({ severity: 'success', summary: 'Gym updated', detail: g.name });
  }
}
