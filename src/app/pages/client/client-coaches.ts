import { Component, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ConfirmationService, MessageService } from 'primeng/api';
import { FaIconComponent } from '@fortawesome/angular-fontawesome';
import { Button } from 'primeng/button';
import { Dialog } from 'primeng/dialog';
import { Rating } from 'primeng/rating';
import { Select } from 'primeng/select';
import { SelectButton } from 'primeng/selectbutton';
import { Textarea } from 'primeng/textarea';
import { AuthService } from '../../core/auth.service';
import { CoachReview, User } from '../../core/models';
import { StoreService } from '../../core/store.service';
import { CoachCard, PageHeader, Stars } from '../../shared/ui';

@Component({
  selector: 'app-client-coaches',
  imports: [DatePipe, FormsModule, FaIconComponent, Button, Dialog, Rating, Select, SelectButton, Textarea, CoachCard, PageHeader, Stars],
  template: `
    <app-page-header title="Coaches" subtitle="Rate and review the coaches at your gyms." >
      <p-selectbutton [options]="scopes" optionLabel="label" optionValue="value" [ngModel]="scope()" (ngModelChange)="scope.set($event)" [allowEmpty]="false" />
    </app-page-header>

    <div class="grid md:grid-cols-2 xl:grid-cols-3 gap-5">
      @for (c of coaches(); track c.id) {
        <app-coach-card [coachId]="c.id">
          @if (canRate(c)) {
            <p-button [label]="myReview(c) ? 'Edit my review' : 'Rate coach'" size="small" (onClick)="openRate(c)">
              <ng-template #icon><fa-icon icon="star" /></ng-template>
            </p-button>
          }
          <p-button label="Reviews" size="small" [outlined]="true" (onClick)="openReviews(c)" />
        </app-coach-card>
      } @empty {
        <div class="card md:col-span-2 xl:col-span-3 text-center py-12 muted">Join a gym to see its coaches.</div>
      }
    </div>

    <p-dialog [header]="'Rate ' + (coach()?.firstName ?? '')" [(visible)]="rateVisible" [modal]="true" [style]="{ width: '32rem' }" [breakpoints]="{ '640px': '95vw' }">
      <div class="space-y-4">
        @if (rateGyms().length > 1) {
          <div class="field"><label>At gym</label>
            <p-select [options]="rateGyms()" optionLabel="name" optionValue="id" [(ngModel)]="form.gymId" (ngModelChange)="prefill()" styleClass="w-full" appendTo="body" /></div>
        }
        <div class="flex flex-col items-center gap-2 py-2">
          <p-rating [(ngModel)]="form.rating" [stars]="5" styleClass="text-3xl" />
          <span class="text-sm muted">{{ labels[form.rating] ?? 'Tap a star' }}</span>
        </div>
        <div class="field"><label>Comment</label><textarea pTextarea rows="4" [(ngModel)]="form.comment" placeholder="How was your experience?"></textarea></div>
      </div>
      <ng-template #footer>
        @if (existing()) { <p-button label="Delete" severity="danger" [text]="true" (onClick)="remove()" /> }
        <p-button label="Cancel" [text]="true" severity="secondary" (onClick)="rateVisible = false" />
        <p-button label="Submit" (onClick)="submit()" [disabled]="!form.rating || !form.gymId" />
      </ng-template>
    </p-dialog>

    <p-dialog [header]="'Reviews · ' + (coach()?.firstName ?? '')" [(visible)]="reviewsVisible" [modal]="true" [style]="{ width: '40rem' }" [breakpoints]="{ '640px': '95vw' }">
      <div class="space-y-3">
        @for (r of coachReviews(); track r.id) {
          <div class="p-4 rounded-xl bg-surface-50 dark:bg-surface-800">
            <div class="flex justify-between gap-2"><span class="font-medium">{{ store.fullName(r.clientId) }}</span><app-stars [value]="r.rating" /></div>
            <p class="text-sm mt-2">{{ r.comment }}</p>
            <div class="text-xs muted mt-2">{{ store.gym(r.gymId)?.name }} · {{ r.createdAt | date }}</div>
          </div>
        } @empty { <p class="muted text-center py-6">No reviews yet — be the first!</p> }
      </div>
    </p-dialog>
  `,
})
export class ClientCoaches {
  private readonly auth = inject(AuthService);
  protected readonly store = inject(StoreService);
  private readonly toast = inject(MessageService);
  private readonly confirmSvc = inject(ConfirmationService);
  protected rateVisible = false;
  protected reviewsVisible = false;
  protected readonly scope = signal<'mine' | 'all'>('mine');
  protected readonly scopes = [{ label: 'My gyms', value: 'mine' }, { label: 'All coaches', value: 'all' }];
  protected readonly coach = signal<User | null>(null);
  protected readonly existing = signal<CoachReview | undefined>(undefined);
  protected form = { gymId: '', rating: 0, comment: '' };
  protected readonly labels: Record<number, string> = { 1: 'Poor', 2: 'Fair', 3: 'Good', 4: 'Great', 5: 'Excellent!' };

  private readonly me = computed(() => this.auth.user()!.id);
  private readonly myGymIds = computed(() => new Set(this.store.gymsOfClient(this.me()).map((g) => g.id)));
  protected readonly coaches = computed(() => {
    if (this.scope() === 'all') return this.store.coaches().filter((c) => c.active);
    const ids = new Set(this.store.gymCoaches().filter((l) => this.myGymIds().has(l.gymId)).map((l) => l.coachId));
    return this.store.coaches().filter((c) => ids.has(c.id));
  });
  /** Gyms where both the client is a member and the coach works. */
  protected readonly rateGyms = computed(() => (this.coach() ? this.store.gymsOfCoach(this.coach()!.id).filter((g) => this.myGymIds().has(g.id)) : []));
  protected readonly coachReviews = computed(() => (this.coach() ? this.store.reviewsOfCoach(this.coach()!.id) : []));

  canRate(c: User) { return this.store.gymsOfCoach(c.id).some((g) => this.myGymIds().has(g.id)); }
  myReview(c: User) { return this.store.reviews().find((r) => r.coachId === c.id && r.clientId === this.me()); }

  openRate(c: User) {
    this.coach.set(c);
    const mine = this.myReview(c);
    this.form = { gymId: mine?.gymId ?? this.rateGyms()[0]?.id ?? '', rating: 0, comment: '' };
    this.prefill();
    this.rateVisible = true;
  }

  prefill() {
    const r = this.store.reviews().find((x) => x.coachId === this.coach()?.id && x.clientId === this.me() && x.gymId === this.form.gymId);
    this.existing.set(r);
    this.form.rating = r?.rating ?? 0;
    this.form.comment = r?.comment ?? '';
  }

  openReviews(c: User) { this.coach.set(c); this.reviewsVisible = true; }

  submit() {
    this.store.saveReview({ coachId: this.coach()!.id, clientId: this.me(), gymId: this.form.gymId, rating: this.form.rating, comment: this.form.comment.trim() });
    this.rateVisible = false;
    this.toast.add({ severity: 'success', summary: 'Thanks for your review!' });
  }

  remove() {
    const r = this.existing();
    if (!r) return;
    this.confirmSvc.confirm({
      header: 'Delete review', message: 'Delete your review?', acceptButtonStyleClass: 'p-button-danger',
      accept: () => { this.store.deleteReview(r.id); this.rateVisible = false; this.toast.add({ severity: 'info', summary: 'Review deleted' }); },
    });
  }
}
