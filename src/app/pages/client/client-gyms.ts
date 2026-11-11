import { Component, computed, inject, signal } from '@angular/core';
import { CurrencyPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { FaIconComponent } from '@fortawesome/angular-fontawesome';
import { Button } from 'primeng/button';
import { Dialog } from 'primeng/dialog';
import { IconField } from 'primeng/iconfield';
import { InputIcon } from 'primeng/inputicon';
import { InputText } from 'primeng/inputtext';
import { Message } from 'primeng/message';
import { Select } from 'primeng/select';
import { Tag } from 'primeng/tag';
import { AuthService } from '../../core/auth.service';
import { Gym } from '../../core/models';
import { StoreService } from '../../core/store.service';
import { ThemeService } from '../../core/theme.service';
import { OpenStatusBadge, WeekSchedule } from '../../shared/schedule-ui';
import { PageHeader, Stars } from '../../shared/ui';

/**
 * Members can browse gyms, but cannot subscribe themselves:
 * memberships are created by the gym admin (Admin → Clients).
 */
@Component({
  selector: 'app-client-gyms',
  imports: [FormsModule, CurrencyPipe, FaIconComponent, Button, Dialog, IconField, InputIcon, InputText, Message, Select, Tag, PageHeader, Stars, OpenStatusBadge, WeekSchedule],
  template: `
    <app-page-header title="Gyms" subtitle="Browse gyms, their sports, plans and opening hours. To become a member, ask the gym — they register you." />

    <div class="flex flex-col sm:flex-row gap-3 mb-6">
      <p-iconfield class="flex-1">
        <p-inputicon><fa-icon icon="magnifying-glass" /></p-inputicon>
        <input pInputText class="w-full" placeholder="Search by name, city or sport" [ngModel]="q()" (ngModelChange)="q.set($event)" />
      </p-iconfield>
      <p-select [options]="sports()" [ngModel]="sport()" (ngModelChange)="sport.set($event)" placeholder="All sports" [showClear]="true" />
    </div>

    <div class="grid md:grid-cols-2 xl:grid-cols-3 gap-5">
      @for (g of gyms(); track g.id) {
        <div class="card !p-0 overflow-hidden flex flex-col">
          <div class="h-28 p-5 flex items-end text-white relative" [style.background]="'linear-gradient(135deg,' + g.theme.primary + ', #0f172a)'">
            <span class="absolute top-4 right-4 flex flex-wrap justify-end gap-1 max-w-[60%]">
              @for (s of g.sports.slice(0, 3); track s) { <p-tag [value]="s" severity="contrast" [rounded]="true" /> }
              @if (g.sports.length > 3) { <p-tag [value]="'+' + (g.sports.length - 3)" severity="contrast" [rounded]="true" /> }
            </span>
            <div class="flex items-center gap-3">
              <span class="w-11 h-11 rounded-xl bg-white/20 backdrop-blur grid place-items-center font-extrabold">{{ g.theme.logoText }}</span>
              <div><div class="font-bold text-lg">{{ g.name }}</div><div class="text-sm opacity-80"><fa-icon icon="location-dot" /> {{ g.city }}</div></div>
            </div>
          </div>
          <div class="p-5 flex-1 flex flex-col gap-3">
            <app-open-status [gymId]="g.id" [gender]="gender()" />
            <p class="text-sm muted">{{ g.description }}</p>
            <div class="text-sm"><b>{{ store.coachesOfGym(g.id).length }}</b> coaches · from <b>{{ minPrice(g.id) | currency }}</b></div>
            <div class="mt-auto flex items-center gap-2">
              @if (isMember(g.id)) { <p-tag value="Member" severity="success" /> }
              <div class="flex-1"></div>
              <p-button label="Details & hours" [outlined]="true" (onClick)="open(g)"><ng-template #icon><fa-icon icon="clock" /></ng-template></p-button>
            </div>
          </div>
        </div>
      } @empty { <p class="muted">No gyms match your search.</p> }
    </div>

    <p-dialog [header]="gym()?.name ?? ''" [(visible)]="visible" [modal]="true" [style]="{ width: '42rem' }" [breakpoints]="{ '640px': '95vw' }" (onHide)="theme.preview.set(null)">
      @if (gym(); as g) {
        <div class="space-y-6">
          <div class="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
            <app-open-status [gymId]="g.id" [gender]="gender()" />
            <span class="muted"><fa-icon icon="location-dot" /> {{ g.address ? g.address + ', ' : '' }}{{ g.city }}</span>
          </div>

          @if (!isMember(g.id)) {
            <p-message severity="info">
              <span>Memberships are registered by the gym. Visit or contact <b>{{ g.name }}</b> and they'll add you to a plan.</span>
            </p-message>
          }

          <div>
            <h3 class="font-semibold mb-2">Membership plans</h3>
            <div class="grid sm:grid-cols-2 gap-3">
              @for (p of plans(); track p.id) {
                <div class="p-4 rounded-xl border border-surface-200 dark:border-surface-700">
                  <div class="font-semibold">{{ p.name }}</div>
                  <div class="text-xs muted">{{ p.description }}</div>
                  <div class="text-lg font-bold mt-2 text-primary">{{ p.price | currency }} <span class="text-xs muted font-normal">/ {{ p.durationDays }} days</span></div>
                </div>
              } @empty { <p class="text-sm muted">No plans published yet.</p> }
            </div>
          </div>

          <div>
            <h3 class="font-semibold mb-2">Coaches</h3>
            <div class="space-y-2">
              @for (c of coaches(); track c.id) {
                <div class="flex items-center justify-between gap-3 p-3 rounded-xl border border-surface-200 dark:border-surface-700">
                  <span class="font-medium text-sm">{{ c.firstName }} {{ c.lastName }}</span>
                  <app-stars [value]="store.coachRating(c.id).avg" [count]="store.coachRating(c.id).count" />
                </div>
              } @empty { <p class="text-sm muted">No coaches listed.</p> }
            </div>
          </div>

          <div>
            <h3 class="font-semibold mb-2">Opening hours</h3>
            <app-week-schedule [gymId]="g.id" [gender]="gender()" />
          </div>
        </div>
      }
    </p-dialog>
  `,
})
export class ClientGyms {
  private readonly auth = inject(AuthService);
  protected readonly store = inject(StoreService);
  protected readonly theme = inject(ThemeService);
  protected visible = false;
  protected readonly q = signal('');
  protected readonly sport = signal<string | null>(null);
  protected readonly gym = signal<Gym | null>(null);
  protected readonly gender = computed(() => this.auth.user()?.gender);

  protected readonly sports = computed(() => [...new Set(this.store.gyms().flatMap((g) => g.sports))].sort());
  protected readonly gyms = computed(() => {
    const q = this.q().toLowerCase();
    return this.store.gyms().filter((g) => g.status !== 'SUSPENDED' &&
      (!this.sport() || g.sports.includes(this.sport()!)) &&
      (!q || `${g.name} ${g.city} ${g.sports.join(' ')}`.toLowerCase().includes(q)));
  });
  protected readonly plans = computed(() => (this.gym() ? this.store.plansOfGym(this.gym()!.id).filter((p) => p.active) : []));
  protected readonly coaches = computed(() => (this.gym() ? this.store.coachesOfGym(this.gym()!.id) : []));

  minPrice(gymId: string) {
    const prices = this.store.plansOfGym(gymId).filter((p) => p.active).map((p) => p.price);
    return prices.length ? Math.min(...prices) : 0;
  }
  isMember(gymId: string) {
    return this.store.membershipsOfClient(this.auth.user()!.id).some((m) => m.gymId === gymId && m.status === 'ACTIVE');
  }

  open(g: Gym) {
    this.gym.set(g);
    this.theme.preview.set(g.theme); // show the gym's own brand while viewing it
    this.visible = true;
  }
}
