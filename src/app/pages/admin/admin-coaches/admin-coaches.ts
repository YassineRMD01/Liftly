import { Component, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ConfirmationService, MessageService } from 'primeng/api';
import { FaIconComponent } from '@fortawesome/angular-fontawesome';
import { Button } from 'primeng/button';
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

@Component({
  selector: 'app-admin-coaches',
  imports: [FormsModule, DatePipe, FaIconComponent, Button, Dialog, InputText, Message, SelectButton, CoachCard, PageHeader, Stars],
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
  protected readonly modes = [{ label: 'From Liftly network', value: 'network' }, { label: 'Invite new coach', value: 'invite' }];
  protected invite = { firstName: '', lastName: '', email: '' };
  protected readonly q = signal('');
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
    this.toast.add({ severity: 'success', summary: 'Coach linked', detail: `${c.firstName} ${c.lastName}` });
  }

  createAndLink() {
    const { firstName, lastName, email } = this.invite;
    if (!firstName || !lastName || !email) return;
    if (this.store.users().some((u) => u.email.toLowerCase() === email.toLowerCase())) {
      this.toast.add({ severity: 'error', summary: 'Email already registered', detail: 'Find this coach in the network tab.' });
      return;
    }
    const c = this.store.addUser({ role: 'COACH', firstName, lastName, email, password: 'welcome' });
    this.link(c);
    this.addVisible = false;
  }

  showReviews(c: User) { this.reviewCoach.set(c); this.reviewsVisible = true; }

  unlink(c: User) {
    this.confirm.confirm({
      header: 'Remove coach', message: `Remove ${c.firstName} ${c.lastName} from your gym? Their account and other gyms are not affected.`,
      acceptButtonStyleClass: 'p-button-danger',
      accept: () => { this.store.unlinkCoach(this.gymId(), c.id); this.toast.add({ severity: 'success', summary: 'Coach removed' }); },
    });
  }
}
