import { Component, OnDestroy, computed, effect, inject, input } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { FaIconComponent } from '@fortawesome/angular-fontawesome';
import { IconProp } from '@fortawesome/fontawesome-svg-core';
import { Button } from 'primeng/button';
import { InputText } from 'primeng/inputtext';
import { Message } from 'primeng/message';
import { Select } from 'primeng/select';
import { Textarea } from 'primeng/textarea';
import { MoneyPipe } from '../../../core/currency';
import { CURRENT_LANGUAGE, TranslatePipe, t } from '../../../core/i18n/i18n';
import { StoreService } from '../../../core/store.service';
import { ThemeService } from '../../../core/theme.service';
import { GymLogo } from '../../../shared/gym-logo/gym-logo';
import { OpenStatusBadge } from '../../../shared/open-status/open-status';
import { PublicHeader } from '../../../shared/public-header/public-header';
import { Stars } from '../../../shared/stars/stars';
import { WeekSchedule } from '../../../shared/week-schedule/week-schedule';

/** Public page of one gym (in its own theme): plans, hours, coaches, classes, reviews and a join form. */
@Component({
  selector: 'app-gym-page',
  imports: [TranslatePipe, DatePipe, MoneyPipe, FormsModule, RouterLink, FaIconComponent, Button, InputText, Message, Select, Textarea, GymLogo, OpenStatusBadge, PublicHeader, Stars, WeekSchedule],
  templateUrl: './gym-page.html',
  styleUrl: './gym-page.css',
})
export class GymPage implements OnDestroy {
  protected readonly store = inject(StoreService);
  private readonly theme = inject(ThemeService);
  /** Route param and ?ref= query param (component input binding). */
  readonly id = input.required<string>();
  readonly ref = input<string>();

  protected readonly gym = computed(() => this.store.publishedGyms().find((g) => g.id === this.id()));
  protected readonly plans = computed(() => this.store.plansOfGym(this.id()).filter((p) => p.active));
  protected readonly coaches = computed(() => this.store.coachesOfGym(this.id()));
  protected readonly rating = computed(() => this.store.gymRating(this.id()));
  protected readonly reviews = computed(() => this.store.gymReviews().filter((r) => r.gymId === this.id()).sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 4));
  protected readonly classes = computed(() => this.store.classesOfGym(this.id()).filter((c) => c.active));
  protected readonly referrer = computed(() => this.store.userByRefCode(this.ref()));

  protected form = { firstName: '', lastName: '', email: '', phone: '', planId: null as string | null, message: '', ref: '' };
  protected sent = false;
  protected error = '';

  constructor() {
    // the public page wears the gym's own theme
    effect(() => { const g = this.gym(); this.theme.preview.set(g ? g.theme : null); });
    effect(() => { if (this.ref()) this.form.ref = this.ref()!.toUpperCase(); });
  }
  ngOnDestroy() { this.theme.preview.set(null); }

  sportIcon(id: string) { return (this.store.sports().find((s) => s.id === id)?.icon ?? 'dumbbell') as IconProp; }
  dayLabel(day: number) { return new Intl.DateTimeFormat(CURRENT_LANGUAGE.locale, { weekday: 'short' }).format(new Date(2024, 0, 7 + day)); }
  pick(planId: string) { this.form.planId = planId; document.getElementById('join')?.scrollIntoView({ behavior: 'smooth' }); }

  submit() {
    const f = this.form;
    if (!f.firstName.trim() || !f.lastName.trim() || !/^\S+@\S+\.\S+$/.test(f.email.trim())) { this.error = t('Fill in your name and a valid e-mail.'); return; }
    this.store.addJoinRequest({
      gymId: this.id(), firstName: f.firstName.trim(), lastName: f.lastName.trim(), email: f.email.trim(),
      ...(f.phone.trim() ? { phone: f.phone.trim() } : {}), ...(f.planId ? { planId: f.planId } : {}),
      ...(f.message.trim() ? { message: f.message.trim() } : {}), ...(f.ref.trim() ? { ref: f.ref.trim().toUpperCase() } : {}),
    });
    this.sent = true; this.error = '';
  }
}
