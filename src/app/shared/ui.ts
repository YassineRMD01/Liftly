import { Component, computed, inject, input } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { IconProp } from '@fortawesome/fontawesome-svg-core';
import { FaIconComponent } from '@fortawesome/angular-fontawesome';
import { Avatar } from 'primeng/avatar';
import { Chip } from 'primeng/chip';
import { Rating } from 'primeng/rating';
import { StoreService } from '../core/store.service';

@Component({
  selector: 'app-page-header',
  template: `
    <div class="flex flex-col sm:flex-row sm:items-end gap-4 mb-6">
      <div class="flex-1">
        <h1 class="page-title">{{ title() }}</h1>
        @if (subtitle()) { <p class="muted mt-1">{{ subtitle() }}</p> }
      </div>
      <div class="flex gap-2 flex-wrap"><ng-content /></div>
    </div>
  `,
})
export class PageHeader {
  readonly title = input.required<string>();
  readonly subtitle = input<string>();
}

@Component({
  selector: 'app-stat-card',
  imports: [FaIconComponent],
  template: `
    <div class="card flex items-center gap-4">
      <div class="w-12 h-12 rounded-xl grid place-items-center bg-primary-50 dark:bg-primary-950 text-primary text-xl">
        <fa-icon [icon]="icon()" />
      </div>
      <div class="min-w-0">
        <div class="text-sm muted">{{ label() }}</div>
        <div class="text-2xl font-bold">{{ value() }}</div>
        @if (hint()) { <div class="text-xs muted mt-0.5">{{ hint() }}</div> }
      </div>
    </div>
  `,
})
export class StatCard {
  readonly icon = input.required<IconProp>();
  readonly label = input.required<string>();
  readonly value = input.required<string | number>();
  readonly hint = input<string>();
}

/** Read-only star rating with average + count. */
@Component({
  selector: 'app-stars',
  imports: [Rating, FormsModule],
  template: `
    <span class="inline-flex items-center gap-2">
      <p-rating [ngModel]="rounded()" [readonly]="true" [stars]="5" />
      <span class="text-sm font-semibold">{{ value() ? value().toFixed(1) : '—' }}</span>
      @if (count() !== undefined) { <span class="text-xs muted">({{ count() }})</span> }
    </span>
  `,
})
export class Stars {
  readonly value = input(0);
  readonly count = input<number>();
  protected readonly rounded = computed(() => Math.round(this.value()));
}

@Component({
  selector: 'app-coach-card',
  imports: [Avatar, Chip, Stars],
  template: `
    @if (coach(); as c) {
      <div class="card h-full flex flex-col gap-4">
        <div class="flex items-center gap-3">
          <p-avatar [label]="c.firstName[0] + c.lastName[0]" size="large" shape="circle" styleClass="!bg-primary !text-primary-contrast" />
          <div class="min-w-0">
            <div class="font-semibold text-lg truncate">{{ c.firstName }} {{ c.lastName }}</div>
            <app-stars [value]="rating().avg" [count]="rating().count" />
          </div>
        </div>
        @if (profile(); as p) {
          <p class="text-sm muted line-clamp-2">{{ p.bio || 'No bio yet.' }}</p>
          <div class="flex flex-wrap gap-1.5">
            @for (s of p.specialties; track s) { <p-chip [label]="s" styleClass="!text-xs !py-1" /> }
          </div>
          <div class="text-xs muted">{{ p.yearsExperience }} yrs experience · \${{ p.hourlyRate }}/h</div>
        }
        <div class="text-xs muted">
          Coaches at: {{ gymNames() }}
        </div>
        <div class="mt-auto flex gap-2"><ng-content /></div>
      </div>
    }
  `,
})
export class CoachCard {
  private readonly store = inject(StoreService);
  readonly coachId = input.required<string>();
  protected readonly coach = computed(() => this.store.user(this.coachId()));
  protected readonly profile = computed(() => this.store.coachProfile(this.coachId()));
  protected readonly rating = computed(() => this.store.coachRating(this.coachId()));
  protected readonly gymNames = computed(() => this.store.gymsOfCoach(this.coachId()).map((g) => g.name).join(', ') || '—');
}
