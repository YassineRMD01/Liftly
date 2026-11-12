import { TranslatePipe, t } from '../../../core/i18n/i18n';
import { Component, computed, inject, signal, viewChild } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ConfirmationService, MessageService } from 'primeng/api';
import { FaIconComponent } from '@fortawesome/angular-fontawesome';
import { ButtonDirective, ButtonIcon, ButtonLabel } from 'primeng/button';
import { Dialog } from 'primeng/dialog';
import { InputText } from 'primeng/inputtext';
import { Message } from 'primeng/message';
import { SelectButton } from 'primeng/selectbutton';
import { AuthService } from '../../../core/auth.service';
import { User } from '../../../core/models';
import { StoreService } from '../../../core/store.service';
import { CoachCard } from '../../../shared/coach-card/coach-card';
import { PageHeader } from '../../../shared/page-header/page-header';
import { Stars } from '../../../shared/stars/stars';
import { InviteDialog } from '../../../shared/invite-dialog/invite-dialog';

@Component({
  selector: 'app-admin-coaches',
  imports: [TranslatePipe, FormsModule, DatePipe, FaIconComponent, ButtonDirective, ButtonIcon, ButtonLabel, Dialog, InputText, Message, SelectButton, CoachCard, PageHeader, Stars, InviteDialog],
  templateUrl: './admin-coaches.html',
  styleUrl: './admin-coaches.css',
})
export class AdminCoaches {
  private readonly auth = inject(AuthService);
  protected readonly store = inject(StoreService);
  private readonly toast = inject(MessageService);
  private readonly confirm = inject(ConfirmationService);
  protected addVisible = false;
  protected reviewsVisible = false;
  protected mode: 'network' | 'invite' = 'network';
  protected readonly modes = [{ label: t('From Liftly network'), value: 'network' }, { label: t('Invite new coach'), value: 'invite' }];
  protected invite = { firstName: '', lastName: '', email: '' };
  protected readonly q = signal('');
  protected readonly inviteDialog = viewChild.required(InviteDialog);
  protected readonly reviewCoach = signal<User | null>(null);

  private readonly gymId = computed(() => this.auth.activeGym()?.id ?? '');
  protected readonly coaches = computed(() => this.store.coachesOfGym(this.gymId()));
  protected readonly available = computed(() => {
    const linked = new Set(this.coaches().map((c) => c.id));
    const q = this.q().toLowerCase();
    return this.store.coaches().filter((c) => c.active && !linked.has(c.id) &&
      (!q || `${c.firstName} ${c.lastName} ${this.store.coachProfile(c.id)?.specialties.join(' ')}`.toLowerCase().includes(q)));
  });
  protected readonly reviews = computed(() => (this.reviewCoach() ? this.store.reviewsOfCoach(this.reviewCoach()!.id) : []));
  protected readonly limitReached = computed(() => {
    const max = this.store.saasPlan(this.auth.activeGym()?.saasPlanId)?.maxCoaches ?? -1;
    return max !== -1 && this.coaches().length >= max;
  });

  openAdd() { this.invite = { firstName: '', lastName: '', email: '' }; this.q.set(''); this.addVisible = true; }

  link(c: User) {
    this.store.linkCoach(this.gymId(), c.id);
    this.toast.add({ severity: 'success', summary: t('Coach linked'), detail: `${c.firstName} ${c.lastName}` });
  }

  createAndLink() {
    const { firstName, lastName, email } = this.invite;
    if (!firstName || !lastName || !email) return;
    if (this.store.users().some((u) => u.email.toLowerCase() === email.toLowerCase())) {
      this.toast.add({ severity: 'error', summary: t('Email already registered'), detail: t('Find this coach in the network tab.') });
      return;
    }
    const c = this.store.addUser({ role: 'COACH', firstName, lastName, email });
    this.link(c);
    this.addVisible = false;
    this.inviteDialog().open(c);
  }

  showReviews(c: User) { this.reviewCoach.set(c); this.reviewsVisible = true; }

  unlink(c: User) {
    this.confirm.confirm({
      header: t('Remove coach'), message: t('Remove {0} {1} from your gym? Their account and other gyms are not affected.', { 0: c.firstName, 1: c.lastName }),
      acceptButtonStyleClass: 'p-button-danger',
      accept: () => { this.store.unlinkCoach(this.gymId(), c.id); this.toast.add({ severity: 'success', summary: t('Coach removed') }); },
    });
  }
}
