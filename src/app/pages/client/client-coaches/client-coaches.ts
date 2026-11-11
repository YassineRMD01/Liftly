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
import { AuthService } from '../../../core/auth.service';
import { CoachReview, User } from '../../../core/models';
import { StoreService } from '../../../core/store.service';
import { CoachCard } from '../../../shared/coach-card/coach-card';
import { PageHeader } from '../../../shared/page-header/page-header';
import { Stars } from '../../../shared/stars/stars';

@Component({
  selector: 'app-client-coaches',
  imports: [DatePipe, FormsModule, FaIconComponent, Button, Dialog, Rating, Select, SelectButton, Textarea, CoachCard, PageHeader, Stars],
  templateUrl: './client-coaches.html',
  styleUrl: './client-coaches.css',
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
