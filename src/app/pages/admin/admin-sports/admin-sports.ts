import { Component, computed, inject, signal, viewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ConfirmationService, MessageService } from 'primeng/api';
import { FaIconComponent } from '@fortawesome/angular-fontawesome';
import { IconProp } from '@fortawesome/fontawesome-svg-core';
import { ButtonDirective, ButtonIcon, ButtonLabel } from 'primeng/button';
import { Dialog } from 'primeng/dialog';
import { InputText } from 'primeng/inputtext';
import { Tag } from 'primeng/tag';
import { AuthService } from '../../../core/auth.service';
import { TranslatePipe, t } from '../../../core/i18n/i18n';
import { Sport } from '../../../core/models';
import { StoreService } from '../../../core/store.service';
import { PageHeader } from '../../../shared/page-header/page-header';
import { SportDialog } from '../../../shared/sport-dialog/sport-dialog';

/** Gym admin: the sports / activities the gym offers (from the catalog or custom). */
@Component({
  selector: 'app-admin-sports',
  imports: [TranslatePipe, FormsModule, FaIconComponent, ButtonDirective, ButtonIcon, ButtonLabel, Dialog, InputText, Tag, PageHeader, SportDialog],
  templateUrl: './admin-sports.html',
  styleUrl: './admin-sports.css',
})
export class AdminSports {
  private readonly auth = inject(AuthService);
  protected readonly store = inject(StoreService);
  private readonly toast = inject(MessageService);
  private readonly confirm = inject(ConfirmationService);
  private readonly sportDialog = viewChild.required(SportDialog);

  protected readonly gym = this.auth.activeGym;
  protected readonly sports = computed(() => this.store.sportsOfGym(this.gym()));
  /** Catalog sports the gym doesn't offer yet. */
  protected readonly addable = computed(() => {
    const have = new Set(this.gym()?.sportIds ?? []);
    const q = this.q().toLowerCase();
    return this.store.catalogSports()
      .filter((s) => !have.has(s.id) && this.store.sportName(s.id).toLowerCase().includes(q))
      .sort((a, b) => this.store.sportName(a.id).localeCompare(this.store.sportName(b.id)));
  });

  protected readonly catalogVisible = signal(false);
  protected readonly q = signal('');
  protected readonly picked = signal<string[]>([]);

  iconOf(s: Sport) { return s.icon as IconProp; }
  slots(s: Sport) { return this.store.slotsUsingSport(this.gym()!.id, s.id); }

  openCatalog() {
    this.q.set('');
    this.picked.set([]);
    this.catalogVisible.set(true);
  }

  togglePick(id: string) {
    this.picked.update((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));
  }

  addPicked() {
    const g = this.gym()!;
    this.store.setGymSports(g.id, [...g.sportIds, ...this.picked()]);
    this.toast.add({ severity: 'success', summary: t('Sports added'), detail: this.picked().map((id) => this.store.sportName(id)).join(', ') });
    this.catalogVisible.set(false);
  }

  newCustom() { this.sportDialog().open({ id: '', name: '', icon: 'dumbbell', gymId: this.gym()!.id }); }
  editCustom(s: Sport) { this.sportDialog().open(s); }

  onSaved(s: Sport) {
    const g = this.gym()!;
    const saved = this.store.saveSport({ ...s, gymId: g.id });
    if (!g.sportIds.includes(saved.id)) this.store.setGymSports(g.id, [...g.sportIds, saved.id]);
    this.toast.add({ severity: 'success', summary: t('Sport saved'), detail: saved.name });
  }

  remove(s: Sport) {
    const g = this.gym()!;
    const slots = this.slots(s);
    this.confirm.confirm({
      header: t('Remove sport'),
      message: slots
        ? t('{0} is used by {1} schedule sessions. They will become "whole gym" sessions. Remove it?', { 0: this.store.sportName(s.id), 1: slots })
        : t('Remove {0} from your gym?', { 0: this.store.sportName(s.id) }),
      acceptButtonStyleClass: 'p-button-danger',
      accept: () => {
        this.store.removeSportFromGym(g.id, s.id);
        this.toast.add({ severity: 'success', summary: t('Sport removed') });
      },
    });
  }
}
