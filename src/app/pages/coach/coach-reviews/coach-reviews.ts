import { TranslatePipe } from '../../../core/i18n/i18n';
import { Component, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ProgressBar } from 'primeng/progressbar';
import { Select } from 'primeng/select';
import { AuthService } from '../../../core/auth.service';
import { StoreService } from '../../../core/store.service';
import { PageHeader } from '../../../shared/page-header/page-header';
import { Stars } from '../../../shared/stars/stars';

@Component({
  selector: 'app-coach-reviews',
  imports: [TranslatePipe, DatePipe, FormsModule, ProgressBar, Select, PageHeader, Stars],
  templateUrl: './coach-reviews.html',
  styleUrl: './coach-reviews.css',
})
export class CoachReviews {
  private readonly auth = inject(AuthService);
  protected readonly store = inject(StoreService);
  protected readonly gym = signal<string | null>(null);
  private readonly id = computed(() => (this.auth.user()?.id ?? ''));
  protected readonly rating = computed(() => this.store.coachRating(this.id()));
  protected readonly reviews = computed(() => this.store.reviewsOfCoach(this.id()));
  protected readonly gymOptions = computed(() => this.store.gymsOfCoach(this.id()));
  protected readonly filtered = computed(() => this.reviews().filter((r) => !this.gym() || r.gymId === this.gym()));
  protected readonly breakdown = computed(() => {
    const total = this.reviews().length || 1;
    return [5, 4, 3, 2, 1].map((stars) => {
      const count = this.reviews().filter((r) => r.rating === stars).length;
      return { stars, count, pct: (count / total) * 100 };
    });
  });
}
