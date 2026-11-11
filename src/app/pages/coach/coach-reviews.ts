import { Component, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ProgressBar } from 'primeng/progressbar';
import { Select } from 'primeng/select';
import { AuthService } from '../../core/auth.service';
import { StoreService } from '../../core/store.service';
import { PageHeader, Stars } from '../../shared/ui';

@Component({
  selector: 'app-coach-reviews',
  imports: [DatePipe, FormsModule, ProgressBar, Select, PageHeader, Stars],
  template: `
    <app-page-header title="Reviews" subtitle="What your clients say about you, across all your gyms." />
    <div class="grid lg:grid-cols-3 gap-6">
      <div class="card h-fit">
        <div class="text-5xl font-extrabold">{{ rating().avg ? rating().avg.toFixed(1) : '—' }}</div>
        <app-stars [value]="rating().avg" [count]="rating().count" />
        <div class="space-y-2 mt-6">
          @for (b of breakdown(); track b.stars) {
            <div class="flex items-center gap-3 text-sm">
              <span class="w-10">{{ b.stars }} ★</span>
              <p-progressbar [value]="b.pct" [showValue]="false" styleClass="!h-2 flex-1" class="flex-1" />
              <span class="w-6 text-right muted">{{ b.count }}</span>
            </div>
          }
        </div>
      </div>
      <div class="lg:col-span-2 space-y-4">
        <p-select [options]="gymOptions()" optionLabel="name" optionValue="id" [ngModel]="gym()" (ngModelChange)="gym.set($event)" placeholder="All gyms" [showClear]="true" />
        @for (r of filtered(); track r.id) {
          <div class="card">
            <div class="flex justify-between gap-2 items-center">
              <span class="font-semibold">{{ store.fullName(r.clientId) }}</span>
              <app-stars [value]="r.rating" />
            </div>
            <p class="mt-2">{{ r.comment }}</p>
            <div class="text-xs muted mt-2">{{ store.gym(r.gymId)?.name }} · {{ r.createdAt | date: 'longDate' }}</div>
          </div>
        } @empty { <div class="card text-center muted py-10">No reviews yet.</div> }
      </div>
    </div>
  `,
})
export class CoachReviews {
  private readonly auth = inject(AuthService);
  protected readonly store = inject(StoreService);
  protected readonly gym = signal<string | null>(null);
  private readonly id = computed(() => this.auth.user()!.id);
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
