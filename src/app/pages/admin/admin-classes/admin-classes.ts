import { Component, computed, inject, signal, viewChild } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ConfirmationService, MessageService } from 'primeng/api';
import { FaIconComponent } from '@fortawesome/angular-fontawesome';
import { Button } from 'primeng/button';
import { Dialog } from 'primeng/dialog';
import { InputNumber } from 'primeng/inputnumber';
import { InputText } from 'primeng/inputtext';
import { Message } from 'primeng/message';
import { Select } from 'primeng/select';
import { SelectButton } from 'primeng/selectbutton';
import { TableModule } from 'primeng/table';
import { Tag } from 'primeng/tag';
import { ToggleSwitch } from 'primeng/toggleswitch';
import { Tooltip } from 'primeng/tooltip';
import { AuthService } from '../../../core/auth.service';
import { TranslatePipe, t } from '../../../core/i18n/i18n';
import { GymClass } from '../../../core/models';
import { AUDIENCE, DAY_LABEL, WEEK, toMin } from '../../../core/schedule';
import { StoreService } from '../../../core/store.service';
import { AudienceTag } from '../../../shared/audience-tag/audience-tag';
import { ClassRoster } from '../../../shared/class-roster/class-roster';
import { PageHeader } from '../../../shared/page-header/page-header';
import { LEVEL_LABEL } from '../../client/client-classes/client-classes';

/** Gym classes: upcoming occurrences with rosters, and the weekly timetable (admins only). */
@Component({
  selector: 'app-admin-classes',
  imports: [TranslatePipe, DatePipe, FormsModule, FaIconComponent, Button, Dialog, InputNumber, InputText, Message, Select, SelectButton, TableModule, Tag, ToggleSwitch, Tooltip, AudienceTag, ClassRoster, PageHeader],
  templateUrl: './admin-classes.html',
  styleUrl: './admin-classes.css',
})
export class AdminClasses {
  private readonly auth = inject(AuthService);
  protected readonly store = inject(StoreService);
  private readonly toast = inject(MessageService);
  private readonly confirm = inject(ConfirmationService);
  protected readonly roster = viewChild.required(ClassRoster);

  protected readonly canEdit = computed(() => this.auth.role() === 'ADMIN');
  protected readonly gym = this.auth.activeGym;
  protected readonly view = signal<'upcoming' | 'timetable'>('upcoming');
  protected readonly views = [{ label: t('Upcoming'), value: 'upcoming' }, { label: t('Timetable'), value: 'timetable' }];
  protected readonly dayLabel = DAY_LABEL;
  protected readonly level = LEVEL_LABEL;
  protected readonly days = WEEK.map((d) => ({ value: d, label: DAY_LABEL[d] }));
  protected readonly levels = (Object.keys(LEVEL_LABEL) as GymClass['level'][]).map((value) => ({ value, label: LEVEL_LABEL[value] }));
  protected readonly audiences = (Object.keys(AUDIENCE) as GymClass['audience'][]).map((value) => ({ value, label: AUDIENCE[value].label }));

  protected readonly classes = computed(() => this.store.classesOfGym(this.gym()?.id ?? ''));
  protected readonly upcoming = computed(() => {
    const all = this.store.upcomingClasses(this.gym()?.id ?? '', 7);
    const byDate = new Map<string, typeof all>();
    for (const o of all) byDate.set(o.date, [...(byDate.get(o.date) ?? []), o]);
    return [...byDate.entries()].map(([date, items]) => ({ date, items }));
  });
  protected readonly sports = computed(() => this.store.sportsOfGym(this.gym()).map((s) => ({ value: s.id, label: this.store.sportName(s.id) })));
  protected readonly locations = computed(() => this.store.locationsOf(this.gym()?.id ?? '').map((l) => ({ value: l.id, label: l.name })));
  locName(id?: string) { return id ? this.store.location(this.gym()?.id ?? '', id)?.name : undefined; }
  protected readonly coaches = computed(() => this.store.coachesOfGym(this.gym()?.id ?? '').map((c) => ({ value: c.id, label: `${c.firstName} ${c.lastName}` })));

  // editor
  protected readonly editing = signal<GymClass | null>(null);
  protected error = '';

  occ(c: GymClass, date: string) { return this.store.occupancy(c.id, date); }
  levelOf(l: string) { return LEVEL_LABEL[l as GymClass['level']]; }

  edit(c?: GymClass) {
    this.error = '';
    this.editing.set(c ? { ...c } : { id: '', gymId: this.gym()!.id, name: '', day: 1, start: '18:00', end: '19:00', capacity: 12, audience: 'MIXED', level: 'ALL', active: true });
  }
  close(v: boolean) { if (!v) this.editing.set(null); }

  save() {
    const c = this.editing();
    if (!c) return;
    if (!c.name.trim()) { this.error = t('Give the class a name.'); return; }
    if (toMin(c.end) <= toMin(c.start)) { this.error = t('Closing time must be after opening time (use 23:59 for midnight).'); return; }
    if (!(c.capacity > 0)) { this.error = t('Capacity must be at least 1.'); return; }
    this.store.saveClass({ ...c, name: c.name.trim() });
    this.editing.set(null);
    this.toast.add({ severity: 'success', summary: t('Class saved'), detail: c.name });
  }

  remove(c: GymClass) {
    this.confirm.confirm({
      header: t('Delete class'), message: t('Delete {0}? Upcoming bookings are cancelled and members are notified.', { 0: c.name }), acceptButtonStyleClass: 'p-button-danger',
      accept: () => { this.store.deleteClass(c.id); this.toast.add({ severity: 'success', summary: t('Class deleted') }); },
    });
  }
}
