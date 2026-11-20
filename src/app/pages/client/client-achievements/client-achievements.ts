import { Component, computed, inject } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FaIconComponent } from '@fortawesome/angular-fontawesome';
import { IconProp } from '@fortawesome/fontawesome-svg-core';
import { ProgressBar } from 'primeng/progressbar';
import { Tag } from 'primeng/tag';
import { AuthService } from '../../../core/auth.service';
import { TranslatePipe } from '../../../core/i18n/i18n';
import { ChallengeMetric, GymChallenge } from '../../../core/models';
import { isoDate } from '../../../core/schedule';
import { StoreService } from '../../../core/store.service';
import { GymLogo } from '../../../shared/gym-logo/gym-logo';
import { PageHeader } from '../../../shared/page-header/page-header';

export const METRIC_LABEL: Record<ChallengeMetric, string> = { VISITS: 'visits', CLASSES: 'classes attended', WORKOUTS: 'workouts logged' };

/** Member achievements: weekly streak, badges, and gym challenges with leaderboards. */
@Component({
  selector: 'app-client-achievements',
  imports: [TranslatePipe, DatePipe, FaIconComponent, ProgressBar, Tag, GymLogo, PageHeader],
  templateUrl: './client-achievements.html',
  styleUrl: './client-achievements.css',
})
export class ClientAchievements {
  private readonly auth = inject(AuthService);
  protected readonly store = inject(StoreService);
  protected readonly me = computed(() => this.auth.user()?.id ?? '');
  protected readonly metric = METRIC_LABEL;
  protected readonly streak = computed(() => this.store.visitStreak(this.me()));
  protected readonly badges = computed(() => this.store.badges(this.me()));
  protected readonly earned = computed(() => this.badges().filter((b) => b.earned).length);
  protected readonly challenges = computed(() => this.store.challengesFor(this.me()).map((c) => {
    const board = this.store.leaderboard(c);
    const mine = this.store.challengeProgress(c, this.me());
    const rank = board.findIndex((x) => x.user.id === this.me()) + 1;
    return { c, board: board.slice(0, 5), mine, rank, started: c.start <= isoDate(), daysLeft: Math.max(0, Math.ceil((new Date(c.end + 'T23:59:59').getTime() - Date.now()) / 86400000)) };
  }));
  icon(i: string) { return i as IconProp; }
  pct(v: number, t: number) { return Math.min(100, Math.round((v / t) * 100)); }
  isMe(id: string) { return id === this.me(); }
  gymOf(c: GymChallenge) { return this.store.gym(c.gymId); }
}
