import { Component, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { FaIconComponent } from '@fortawesome/angular-fontawesome';
import { ButtonDirective, ButtonIcon, ButtonLabel } from 'primeng/button';
import { IconField } from 'primeng/iconfield';
import { InputIcon } from 'primeng/inputicon';
import { InputText } from 'primeng/inputtext';
import { Select } from 'primeng/select';
import { downloadCsv } from '../../../core/csv';
import { TranslatePipe } from '../../../core/i18n/i18n';
import { StoreService } from '../../../core/store.service';
import { PageHeader } from '../../../shared/page-header/page-header';

/** Platform activity log: who did what, in which gym. */
@Component({
  selector: 'app-sa-activity',
  imports: [TranslatePipe, DatePipe, FormsModule, FaIconComponent, ButtonDirective, ButtonIcon, ButtonLabel, IconField, InputIcon, InputText, Select, PageHeader],
  templateUrl: './sa-activity.html',
  styleUrl: './sa-activity.css',
})
export class SaActivity {
  protected readonly store = inject(StoreService);
  protected readonly q = signal('');
  protected readonly gymId = signal<string | null>(null);
  protected readonly action = signal<string | null>(null);
  protected readonly limit = signal(50);
  protected readonly actions = computed(() => [...new Set(this.store.audit().map((a) => a.action))].sort().map((a) => ({ value: a, label: a })));
  protected readonly filtered = computed(() => {
    const q = this.q().trim().toLowerCase();
    return this.store.auditLog().filter((e) =>
      (!this.gymId() || e.gymId === this.gymId()) && (!this.action() || e.action === this.action()) &&
      (!q || `${e.action} ${e.target ?? ''} ${this.who(e.actorId)}`.toLowerCase().includes(q)));
  });
  protected readonly shown = computed(() => this.filtered().slice(0, this.limit()));

  who(id?: string) { return id ? this.store.fullName(id) : 'System'; }
  iconOf(action: string) {
    const a = action.toLowerCase();
    if (a.includes('payment')) return 'money-bill';
    if (a.includes('ban')) return 'user-slash';
    if (a.includes('gym')) return 'building';
    if (a.includes('invite') || a.includes('user') || a.includes('activated')) return 'user-plus';
    if (a.includes('membership')) return 'id-card';
    if (a.includes('announcement')) return 'bullhorn';
    return 'circle-info';
  }
  export() {
    downloadCsv('liftly-activity', ['Date', 'Time', 'User', 'Action', 'Gym', 'Details'],
      this.filtered().map((e) => [e.at.slice(0, 10), e.at.slice(11, 19), this.who(e.actorId), e.action, this.store.gym(e.gymId)?.name, e.target]));
  }
}
