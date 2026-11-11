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
import { AuthService } from '../../core/auth.service';
import { User } from '../../core/models';
import { StoreService } from '../../core/store.service';
import { CoachCard, PageHeader, Stars } from '../../shared/ui';

@Component({
  selector: 'app-admin-coaches',
  imports: [FormsModule, DatePipe, FaIconComponent, Button, Dialog, InputText, Message, SelectButton, CoachCard, PageHeader, Stars],
  template: `
    <app-page-header title="Coaches" subtitle="Coaches can work at several gyms — link existing ones or invite new.">
      <p-button label="Add coach" (onClick)="openAdd()"><ng-template #icon><fa-icon icon="user-plus" /></ng-template></p-button>
    </app-page-header>

    <div class="grid md:grid-cols-2 xl:grid-cols-3 gap-5">
      @for (c of coaches(); track c.id) {
        <app-coach-card [coachId]="c.id">
          <p-button label="Reviews" size="small" [outlined]="true" (onClick)="showReviews(c)" />
          <p-button label="Remove" size="small" severity="danger" [text]="true" (onClick)="unlink(c)" />
        </app-coach-card>
      } @empty {
        <div class="card md:col-span-2 xl:col-span-3 text-center py-12">
          <fa-icon icon="user-tie" class="text-4xl text-primary" />
          <p class="mt-3 font-semibold">No coaches yet</p>
          <p class="muted text-sm">Add coaches from the Liftly network or invite your own.</p>
        </div>
      }
    </div>

    <!-- add coach -->
    <p-dialog header="Add a coach" [(visible)]="addVisible" [modal]="true" [style]="{ width: '40rem' }" [breakpoints]="{ '640px': '95vw' }">
      <p-selectbutton [options]="modes" optionLabel="label" optionValue="value" [(ngModel)]="mode" [allowEmpty]="false" class="mb-4" />
      @if (limitReached()) { <p-message severity="warn" styleClass="mb-3">Coach limit of your plan reached — upgrade in Billing.</p-message> }
      @if (mode === 'network') {
        <input pInputText class="w-full mb-3" placeholder="Search by name or specialty" [ngModel]="q()" (ngModelChange)="q.set($event)" />
        <div class="space-y-2 max-h-96 overflow-y-auto">
          @for (c of available(); track c.id) {
            <div class="flex items-center gap-3 p-3 rounded-xl border border-surface-200 dark:border-surface-700">
              <div class="flex-1 min-w-0">
                <div class="font-medium">{{ c.firstName }} {{ c.lastName }}</div>
                <div class="text-xs muted truncate">{{ store.coachProfile(c.id)?.specialties?.join(' · ') }}</div>
                <app-stars [value]="store.coachRating(c.id).avg" [count]="store.coachRating(c.id).count" />
              </div>
              <p-button label="Link" size="small" (onClick)="link(c)" [disabled]="limitReached()" />
            </div>
          } @empty { <p class="muted text-sm text-center py-6">No more coaches available.</p> }
        </div>
      } @else {
        <div class="grid grid-cols-2 gap-3">
          <div class="field"><label>First name</label><input pInputText [(ngModel)]="invite.firstName" /></div>
          <div class="field"><label>Last name</label><input pInputText [(ngModel)]="invite.lastName" /></div>
          <div class="field col-span-2"><label>Email</label><input pInputText type="email" [(ngModel)]="invite.email" /></div>
        </div>
        <p class="text-xs muted mt-2">The coach gets an account with temporary password <b>welcome</b>.</p>
        <div class="flex justify-end mt-4"><p-button label="Invite & link" (onClick)="createAndLink()" [disabled]="limitReached()" /></div>
      }
    </p-dialog>

    <!-- reviews -->
    <p-dialog [header]="'Reviews · ' + (reviewCoach()?.firstName ?? '')" [(visible)]="reviewsVisible" [modal]="true" [style]="{ width: '40rem' }" [breakpoints]="{ '640px': '95vw' }">
      <div class="space-y-4">
        @for (r of reviews(); track r.id) {
          <div class="p-4 rounded-xl bg-surface-50 dark:bg-surface-800">
            <div class="flex justify-between items-center gap-2">
              <span class="font-medium">{{ store.fullName(r.clientId) }}</span>
              <app-stars [value]="r.rating" />
            </div>
            <p class="mt-2 text-sm">{{ r.comment }}</p>
            <div class="text-xs muted mt-2">{{ store.gym(r.gymId)?.name }} · {{ r.createdAt | date }}</div>
          </div>
        } @empty { <p class="muted text-center py-6">No reviews yet.</p> }
      </div>
    </p-dialog>
  `,
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
