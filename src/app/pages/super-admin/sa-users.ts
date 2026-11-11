import { Component, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MessageService } from 'primeng/api';
import { FaIconComponent } from '@fortawesome/angular-fontawesome';
import { Button } from 'primeng/button';
import { IconField } from 'primeng/iconfield';
import { InputIcon } from 'primeng/inputicon';
import { InputText } from 'primeng/inputtext';
import { SelectButton } from 'primeng/selectbutton';
import { TableModule } from 'primeng/table';
import { Tag } from 'primeng/tag';
import { ToggleSwitch } from 'primeng/toggleswitch';
import { Tooltip } from 'primeng/tooltip';
import { AuthService } from '../../core/auth.service';
import { Role, User } from '../../core/models';
import { StoreService } from '../../core/store.service';
import { PageHeader } from '../../shared/ui';

@Component({
  selector: 'app-sa-users',
  imports: [FormsModule, DatePipe, FaIconComponent, Button, IconField, InputIcon, InputText, SelectButton, TableModule, Tag, ToggleSwitch, Tooltip, PageHeader],
  template: `
    <app-page-header title="Users" subtitle="Everyone on the platform.">
      <p-button label="Reset demo data" severity="secondary" [outlined]="true" (onClick)="reset()" />
    </app-page-header>
    <div class="card">
      <div class="flex flex-col md:flex-row gap-3 mb-4">
        <p-selectbutton [options]="roleFilters" optionLabel="label" optionValue="value" [ngModel]="role()" (ngModelChange)="role.set($event)" [allowEmpty]="false" />
        <div class="flex-1"></div>
        <p-iconfield>
          <p-inputicon><fa-icon icon="magnifying-glass" /></p-inputicon>
          <input pInputText placeholder="Search name or email" [ngModel]="q()" (ngModelChange)="q.set($event)" />
        </p-iconfield>
      </div>
      <p-table [value]="rows()" [paginator]="true" [rows]="10" [tableStyle]="{ 'min-width': '48rem' }">
        <ng-template #header>
          <tr><th>Name</th><th>Email</th><th>Role</th><th>Linked gyms</th><th>Joined</th><th>Active</th><th></th></tr>
        </ng-template>
        <ng-template #body let-u>
          <tr>
            <td class="font-medium">{{ u.firstName }} {{ u.lastName }}</td>
            <td>{{ u.email }}</td>
            <td><p-tag [value]="u.role" [severity]="sevOf(u.role)" /></td>
            <td class="text-sm muted">{{ linked(u) }}</td>
            <td>{{ u.createdAt | date }}</td>
            <td><p-toggleswitch [ngModel]="u.active" (ngModelChange)="toggle(u, $event)" [disabled]="u.role === 'SUPER_ADMIN'" /></td>
            <td>
              @if (u.role !== 'SUPER_ADMIN') {
                <p-button [text]="true" [rounded]="true" pTooltip="Impersonate" (onClick)="auth.loginAs(u)"><fa-icon icon="user-secret" /></p-button>
              }
            </td>
          </tr>
        </ng-template>
      </p-table>
    </div>
  `,
})
export class SaUsers {
  private readonly store = inject(StoreService);
  protected readonly auth = inject(AuthService);
  private readonly toast = inject(MessageService);
  protected readonly role = signal<Role | 'ALL'>('ALL');
  protected readonly q = signal('');
  protected readonly sev: Record<Role, 'danger' | 'warn' | 'info' | 'success'> = { SUPER_ADMIN: 'danger', ADMIN: 'warn', COACH: 'info', CLIENT: 'success' };
  protected readonly roleFilters = [
    { label: 'All', value: 'ALL' }, { label: 'Admins', value: 'ADMIN' }, { label: 'Coaches', value: 'COACH' }, { label: 'Clients', value: 'CLIENT' },
  ];
  protected readonly rows = computed(() => {
    const q = this.q().toLowerCase();
    return this.store.users().filter((u) =>
      (this.role() === 'ALL' || u.role === this.role()) &&
      (!q || `${u.firstName} ${u.lastName} ${u.email}`.toLowerCase().includes(q)));
  });

  sevOf(r: Role) { return this.sev[r]; }

  linked(u: User) {
    const gyms = u.role === 'ADMIN' ? this.store.gymsOfAdmin(u.id)
      : u.role === 'COACH' ? this.store.gymsOfCoach(u.id)
      : u.role === 'CLIENT' ? this.store.gymsOfClient(u.id) : [];
    return gyms.map((g) => g.name).join(', ') || '—';
  }

  toggle(u: User, active: boolean) {
    this.store.updateUser({ ...u, active });
    this.toast.add({ severity: active ? 'success' : 'warn', summary: active ? 'User activated' : 'User deactivated', detail: u.email });
  }

  reset() {
    this.store.resetDemo();
    this.toast.add({ severity: 'info', summary: 'Demo data restored' });
  }
}
