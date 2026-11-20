import { Component, computed, inject, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { FaIconComponent } from '@fortawesome/angular-fontawesome';
import { ButtonDirective } from 'primeng/button';
import { AuthService } from '../../../core/auth.service';
import { TranslatePipe } from '../../../core/i18n/i18n';
import { GymModule } from '../../../core/models';
import { StoreService } from '../../../core/store.service';

export const MODULE_INFO: Record<GymModule, { label: string; icon: string; pitch: string }> = {
  CLASSES: { label: 'Classes & bookings', icon: 'calendar-check', pitch: 'Timetable, online booking with waitlist and rosters.' },
  CHECKIN: { label: 'Check-in & attendance', icon: 'qrcode', pitch: 'QR check-in at the desk and attendance statistics.' },
  KIOSK: { label: 'Self check-in kiosk', icon: 'tablet-screen-button', pitch: 'A tablet at the entrance: members check in on their own.' },
  ACCOUNTING: { label: 'Accounting', icon: 'calculator', pitch: 'Income, expenses, VAT, coach pay and monthly reports.' },
  WAIVERS: { label: 'Digital waivers', icon: 'file-signature', pitch: 'Members sign your waiver in the app, with versions.' },
  EQUIPMENT: { label: 'Equipment & lockers', icon: 'screwdriver-wrench', pitch: 'Maintenance reminders, service log and locker rental.' },
  SHIFTS: { label: 'Staff shifts', icon: 'business-time', pitch: 'Plan who works at the front desk, week by week.' },
  CHALLENGES: { label: 'Challenges', icon: 'trophy', pitch: 'Monthly goals and leaderboards that keep members coming.' },
  IMPORT: { label: 'Client import', icon: 'file-import', pitch: 'Bring your members from a spreadsheet in minutes.' },
  LOCATIONS: { label: 'Multiple locations', icon: 'location-dot', pitch: 'Several branches under one gym.' },
};

/** Shown instead of a page whose module is not in the gym's Liftly plan. */
@Component({
  selector: 'app-admin-upgrade',
  imports: [TranslatePipe, RouterLink, FaIconComponent, ButtonDirective],
  template: `
    @let m = info();
    <div class="max-w-xl mx-auto text-center py-16 space-y-5" data-testid="upgrade">
      <span class="w-20 h-20 mx-auto rounded-3xl bg-primary-100 dark:bg-primary-900 text-primary grid place-items-center text-4xl relative">
        <fa-icon [icon]="$any(m.icon)" /><span class="absolute -bottom-1 -end-1 w-8 h-8 rounded-full bg-amber-400 text-white grid place-items-center text-sm"><fa-icon icon="lock" /></span></span>
      <h1 class="text-2xl font-bold">{{ m.label | t }}</h1>
      <p class="muted">{{ m.pitch | t }}</p>
      <p>{{ 'Your {current} plan does not include it.' | t: { current: current() } }}@if (plan(); as p) { {{ 'It is included from the {plan} plan.' | t: { plan: p.name } }} }</p>
      <a pButton routerLink="/admin/billing"><fa-icon icon="arrow-up-right-dots" />{{ 'See plans' | t }}</a>
    </div>`,
})
export class AdminUpgrade {
  private readonly auth = inject(AuthService);
  private readonly store = inject(StoreService);
  /** ?feature= query param */
  readonly feature = input<string>();
  protected readonly info = computed(() => MODULE_INFO[(this.feature() as GymModule) ?? 'CLASSES'] ?? MODULE_INFO.CLASSES);
  protected readonly current = computed(() => this.store.saasPlan(this.auth.activeGym()?.saasPlanId)?.name ?? '');
  protected readonly plan = computed(() => this.store.planWithModule((this.feature() as GymModule) ?? 'CLASSES'));
}
