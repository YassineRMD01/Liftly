import { TranslatePipe } from '../../core/i18n/i18n';
import { Component, computed, inject, input } from '@angular/core';
import { Avatar } from 'primeng/avatar';
import { Chip } from 'primeng/chip';
import { StoreService } from '../../core/store.service';
import { MoneyPipe } from '../../core/currency';
import { Stars } from '../stars/stars';

@Component({
  selector: 'app-coach-card',
  imports: [TranslatePipe, Avatar, Chip, Stars, MoneyPipe],
  templateUrl: './coach-card.html',
  styleUrl: './coach-card.css',
})
export class CoachCard {
  private readonly store = inject(StoreService);
  readonly coachId = input.required<string>();
  protected readonly coach = computed(() => this.store.user(this.coachId()));
  protected readonly profile = computed(() => this.store.coachProfile(this.coachId()));
  protected readonly rating = computed(() => this.store.coachRating(this.coachId()));
  protected readonly gymNames = computed(() => this.store.gymsOfCoach(this.coachId()).map((g) => g.name).join(', ') || '—');
}
