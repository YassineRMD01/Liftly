import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ConfirmationService, MessageService } from 'primeng/api';
import { FaIconComponent } from '@fortawesome/angular-fontawesome';
import { Button } from 'primeng/button';
import { Dialog } from 'primeng/dialog';
import { InputText } from 'primeng/inputtext';
import { AuthService } from '../../../core/auth.service';
import { TranslatePipe, t } from '../../../core/i18n/i18n';
import { GymLocation } from '../../../core/models';
import { StoreService } from '../../../core/store.service';
import { PageHeader } from '../../../shared/page-header/page-header';

/** Branches of a multi-site gym. Classes and check-ins can be tied to a location. */
@Component({
  selector: 'app-admin-locations',
  imports: [TranslatePipe, FormsModule, FaIconComponent, Button, Dialog, InputText, PageHeader],
  templateUrl: './admin-locations.html',
  styleUrl: './admin-locations.css',
})
export class AdminLocations {
  private readonly auth = inject(AuthService);
  protected readonly store = inject(StoreService);
  private readonly toast = inject(MessageService);
  private readonly confirm = inject(ConfirmationService);
  protected readonly gym = this.auth.activeGym;
  protected readonly list = computed(() => this.store.locationsOf(this.gym()?.id ?? ''));
  protected readonly editing = signal<GymLocation | null>(null);

  classCount(id: string) { return this.store.classesOfGym(this.gym()!.id).filter((c) => c.locationId === id).length; }
  checkIns(id: string) { return this.store.checkInsOfGym(this.gym()!.id).filter((c) => c.locationId === id && c.ok).length; }
  edit(l?: GymLocation) { this.editing.set(l ? { ...l } : { id: '', name: '', address: '', city: this.gym()?.city ?? '' }); }
  close(v: boolean) { if (!v) this.editing.set(null); }
  save() {
    const l = this.editing();
    if (!l || !l.name.trim() || !l.address.trim()) return;
    this.store.saveLocation(this.gym()!.id, { ...l, name: l.name.trim(), address: l.address.trim(), city: l.city.trim() });
    this.editing.set(null);
    this.toast.add({ severity: 'success', summary: t('Location saved') });
  }
  remove(l: GymLocation) {
    this.confirm.confirm({
      header: t('Delete location'), message: t('Delete {0}? Its classes stay, without a location.', { 0: l.name }), acceptButtonStyleClass: 'p-button-danger',
      accept: () => this.store.deleteLocation(this.gym()!.id, l.id),
    });
  }
}
