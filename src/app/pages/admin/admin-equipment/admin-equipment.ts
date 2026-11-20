import { Component, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ConfirmationService, MessageService } from 'primeng/api';
import { FaIconComponent } from '@fortawesome/angular-fontawesome';
import { ButtonDirective } from 'primeng/button';
import { InputNumber } from 'primeng/inputnumber';
import { InputText } from 'primeng/inputtext';
import { Select } from 'primeng/select';
import { SelectButton } from 'primeng/selectbutton';
import { Tag } from 'primeng/tag';
import { Tooltip } from 'primeng/tooltip';
import { AuthService } from '../../../core/auth.service';
import { MoneyPipe } from '../../../core/currency';
import { TranslatePipe, t } from '../../../core/i18n/i18n';
import { Equipment, EquipmentStatus, Locker } from '../../../core/models';
import { isoDate } from '../../../core/schedule';
import { StoreService } from '../../../core/store.service';
import { Modal } from '../../../shared/modal/modal';
import { PageHeader } from '../../../shared/page-header/page-header';

const STATUS_SEV: Record<EquipmentStatus, 'success' | 'warn' | 'danger'> = { OK: 'success', SERVICE_DUE: 'warn', OUT_OF_ORDER: 'danger' };

/** Equipment with maintenance reminders and service log; lockers assigned to members. */
@Component({
  selector: 'app-admin-equipment',
  imports: [TranslatePipe, DatePipe, MoneyPipe, FormsModule, FaIconComponent, ButtonDirective, InputNumber, InputText, Select, SelectButton, Tag, Tooltip, Modal, PageHeader],
  templateUrl: './admin-equipment.html',
  styleUrl: './admin-equipment.css',
})
export class AdminEquipment {
  private readonly auth = inject(AuthService);
  protected readonly store = inject(StoreService);
  private readonly toast = inject(MessageService);
  private readonly confirm = inject(ConfirmationService);
  protected readonly gym = this.auth.activeGym;
  protected readonly sev = STATUS_SEV;
  protected readonly tab = signal<'equipment' | 'lockers'>('equipment');
  protected readonly tabs = [{ label: t('Equipment'), value: 'equipment' }, { label: t('Lockers'), value: 'lockers' }];
  protected readonly statuses = [{ label: t('OK'), value: 'OK' }, { label: t('Out of order'), value: 'OUT_OF_ORDER' }];
  protected readonly locations = computed(() => this.store.locationsOf(this.gym()?.id ?? ''));
  protected readonly items = computed(() => this.store.equipmentOf(this.gym()?.id ?? '').map((e) => ({ e, state: this.store.equipmentState(e), next: this.store.nextService(e) })));
  protected readonly attention = computed(() => this.items().filter((x) => x.state !== 'OK').length);
  protected readonly categories = computed(() => [...new Set(this.items().map((x) => x.e.category))]);
  locName(id?: string) { return id ? this.store.location(this.gym()!.id, id)?.name : undefined; }

  // equipment dialog
  protected readonly editing = signal<Equipment | null>(null);
  edit(e?: Equipment) { this.editing.set(e ? structuredClone(e) : { id: '', gymId: this.gym()!.id, name: '', category: this.categories()[0] ?? t('Cardio'), status: 'OK', serviceEveryDays: 90, lastServiceAt: isoDate(), log: [] }); }
  save() {
    const e = this.editing();
    if (!e || !e.name.trim() || !e.category.trim()) { this.toast.add({ severity: 'error', summary: t('Give a name and a category.') }); return; }
    this.store.saveEquipment({ ...e, name: e.name.trim(), category: e.category.trim() });
    this.editing.set(null);
  }
  remove(e: Equipment) { this.confirm.confirm({ header: t('Delete'), message: t('Delete "{0}"?', { 0: e.name }), acceptButtonStyleClass: 'p-button-danger', accept: () => this.store.deleteEquipment(e.id) }); }
  setStatus(e: Equipment, status: EquipmentStatus) { this.store.saveEquipment({ ...e, status }); }
  // service dialog
  protected readonly servicing = signal<Equipment | null>(null);
  protected serviceNote = '';
  protected serviceCost: number | null = null;
  service(e: Equipment) { this.serviceNote = ''; this.serviceCost = null; this.servicing.set(e); }
  confirmService() {
    const e = this.servicing();
    if (!e || !this.serviceNote.trim()) return;
    this.store.serviceEquipment(e.id, this.serviceNote.trim(), this.serviceCost ?? undefined);
    this.toast.add({ severity: 'success', summary: t('Service recorded'), detail: this.serviceCost ? t('The cost was added to your expenses.') : undefined });
    this.servicing.set(null);
  }

  // lockers
  protected readonly lockerLocation = signal<string | null>(null);
  protected readonly lockers = computed(() => this.store.lockersOf(this.gym()?.id ?? '').filter((l) => !this.lockerLocation() || l.locationId === this.lockerLocation()));
  protected readonly lockerStats = computed(() => { const l = this.lockers(); return { total: l.length, used: l.filter((x) => x.clientId).length, expired: l.filter((x) => x.clientId && x.until && x.until < isoDate()).length }; });
  protected readonly clients = computed(() => this.store.clientsOfGym(this.gym()?.id ?? '').map((c) => ({ id: c.id, label: `${c.firstName} ${c.lastName}` })));
  protected readonly lockerEdit = signal<{ l: Locker; clientId: string | null; until: string } | null>(null);
  openLocker(l: Locker) { this.lockerEdit.set({ l, clientId: l.clientId ?? null, until: l.until ?? isoDate(new Date(Date.now() + 30 * 86400000)) }); }
  saveLocker() {
    const x = this.lockerEdit();
    if (!x) return;
    const other = x.clientId ? this.store.lockerOf(this.gym()!.id, x.clientId) : undefined;
    if (other && other.id !== x.l.id) { this.toast.add({ severity: 'warn', summary: t('{name} already has locker {n}.', { name: this.store.fullName(x.clientId!), n: other.number }) }); return; }
    this.store.assignLocker(x.l.id, x.clientId ?? undefined, x.until);
    this.lockerEdit.set(null);
  }
  release() { const x = this.lockerEdit(); if (x) { this.store.assignLocker(x.l.id, undefined); this.lockerEdit.set(null); } }
  protected newPrefix = 'D';
  protected newCount = 8;
  protected readonly adding = signal(false);
  addLockers() {
    const n = this.store.addLockers(this.gym()!.id, this.newPrefix.trim().toUpperCase() || 'L', this.newCount, this.lockerLocation() ?? undefined);
    this.toast.add({ severity: 'success', summary: t('{n} lockers added', { n }) });
    this.adding.set(false);
  }
  expired(l: Locker) { return !!l.clientId && !!l.until && l.until < isoDate(); }
}
