import { Component, computed, inject, signal } from '@angular/core';
import { CurrencyPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MessageService } from 'primeng/api';
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
import { PromoCheck, StoreService } from '../../core/store.service';
import { ThemeService } from '../../core/theme.service';
import { PageHeader, Stars } from '../../shared/ui';
import { OpenStatusBadge, WeekSchedule } from '../../shared/schedule-ui';

@Component({
  selector: 'app-client-gyms',
  imports: [FormsModule, CurrencyPipe, FaIconComponent, Button, Dialog, IconField, InputIcon, InputText, Message, Select, Tag, PageHeader, Stars, OpenStatusBadge, WeekSchedule],
  template: `
    <app-page-header title="Find a gym" subtitle="Join as many gyms as you like — any sport." />

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
              <p-button label="Hours" [outlined]="true" severity="secondary" (onClick)="showHours(g)"><ng-template #icon><fa-icon icon="clock" /></ng-template></p-button>
              <p-button [label]="isMember(g.id) ? 'Add plan' : 'Join'" (onClick)="open(g)" [disabled]="!store.plansOfGym(g.id).length" />
            </div>
          </div>
        </div>
      } @empty { <p class="muted">No gyms match your search.</p> }
    </div>

    <p-dialog [header]="'Opening hours · ' + (hoursGym()?.name ?? '')" [(visible)]="hoursVisible" [modal]="true" [style]="{ width: '40rem' }" [breakpoints]="{ '640px': '95vw' }">
      @if (hoursGym(); as hg) {
        <div class="mb-3"><app-open-status [gymId]="hg.id" [gender]="gender()" /></div>
        <app-week-schedule [gymId]="hg.id" [gender]="gender()" />
      }
    </p-dialog>

    <p-dialog [header]="'Join ' + (gym()?.name ?? '')" [(visible)]="visible" [modal]="true" [style]="{ width: '40rem' }" [breakpoints]="{ '640px': '95vw' }" (onHide)="theme.preview.set(null)">
      @if (gym(); as g) {
        <div class="space-y-5">
          <div>
            <div class="text-sm font-semibold mb-2">1. Choose a plan</div>
            <div class="grid sm:grid-cols-2 gap-3">
              @for (p of plans(); track p.id) {
                <button type="button" (click)="selectPlan(p.id)" class="text-left p-4 rounded-xl border cursor-pointer transition-all border-surface-200 dark:border-surface-700"
                  [class.!border-primary]="planId() === p.id" [class.bg-primary-50]="planId() === p.id" [class.dark:bg-primary-950]="planId() === p.id">
                  <div class="font-semibold">{{ p.name }}</div>
                  <div class="text-xs muted">{{ p.description }}</div>
                  <div class="text-lg font-bold mt-2 text-primary">{{ p.price | currency }} <span class="text-xs muted font-normal">/ {{ p.durationDays }} days</span></div>
                </button>
              }
            </div>
          </div>

          <div>
            <div class="text-sm font-semibold mb-2">2. Pick a coach (optional)</div>
            <div class="space-y-2">
              @for (c of coaches(); track c.id) {
                <button type="button" (click)="coachId.set(coachId() === c.id ? undefined : c.id)"
                  class="w-full flex items-center justify-between gap-3 p-3 rounded-xl border cursor-pointer border-surface-200 dark:border-surface-700"
                  [class.!border-primary]="coachId() === c.id">
                  <span class="font-medium text-sm">{{ c.firstName }} {{ c.lastName }}</span>
                  <app-stars [value]="store.coachRating(c.id).avg" [count]="store.coachRating(c.id).count" />
                </button>
              } @empty { <p class="text-sm muted">No coaches at this gym yet.</p> }
            </div>
          </div>

          <details class="text-sm">
            <summary class="cursor-pointer font-semibold"><fa-icon icon="clock" class="text-primary" /> Opening hours</summary>
            <div class="mt-3"><app-week-schedule [gymId]="g.id" [gender]="gender()" /></div>
          </details>

          <div>
            <div class="text-sm font-semibold mb-2">3. Promo code</div>
            <div class="flex gap-2">
              <input pInputText class="flex-1 font-mono uppercase" placeholder="e.g. IRON20" [(ngModel)]="code" [disabled]="!planId()" />
              <p-button label="Apply" [outlined]="true" (onClick)="apply()" [disabled]="!planId() || !code" />
            </div>
            @if (promo(); as r) { <p-message [severity]="r.ok ? 'success' : 'error'" size="small" styleClass="mt-2">{{ r.message }}</p-message> }
          </div>

          @if (planId()) {
            <div class="flex justify-between items-center p-4 rounded-xl bg-surface-100 dark:bg-surface-800">
              <span class="muted">Total today</span>
              <span class="text-2xl font-bold">
                @if (promo()?.ok) { <s class="text-sm muted mr-2">{{ price() | currency }}</s> }
                {{ (promo()?.ok ? promo()!.finalPrice : price()) | currency }}
              </span>
            </div>
          }
        </div>
      }
      <ng-template #footer>
        <p-button label="Cancel" [text]="true" severity="secondary" (onClick)="visible = false" />
        <p-button label="Confirm & pay" (onClick)="confirm()" [disabled]="!planId()" />
      </ng-template>
    </p-dialog>
  `,
})
export class ClientGyms {
  private readonly auth = inject(AuthService);
  protected readonly store = inject(StoreService);
  protected readonly theme = inject(ThemeService);
  private readonly toast = inject(MessageService);
  protected visible = false;
  protected code = '';
  protected readonly q = signal('');
  protected readonly sport = signal<string | null>(null);
  protected readonly gym = signal<Gym | null>(null);
  protected readonly planId = signal<string | null>(null);
  protected readonly coachId = signal<string | undefined>(undefined);
  protected readonly promo = signal<PromoCheck | null>(null);

  protected readonly sports = computed(() => [...new Set(this.store.gyms().flatMap((g) => g.sports))].sort());
  protected readonly gender = computed(() => this.auth.user()?.gender);
  protected hoursVisible = false;
  protected readonly hoursGym = signal<Gym | null>(null);
  protected readonly gyms = computed(() => {
    const q = this.q().toLowerCase();
    return this.store.gyms().filter((g) => g.status !== 'SUSPENDED' &&
      (!this.sport() || g.sports.includes(this.sport()!)) &&
      (!q || `${g.name} ${g.city} ${g.sports.join(' ')}`.toLowerCase().includes(q)));
  });
  protected readonly plans = computed(() => (this.gym() ? this.store.plansOfGym(this.gym()!.id).filter((p) => p.active) : []));
  protected readonly coaches = computed(() => (this.gym() ? this.store.coachesOfGym(this.gym()!.id) : []));
  protected readonly price = computed(() => this.store.plan(this.planId() ?? undefined)?.price ?? 0);

  minPrice(gymId: string) {
    const prices = this.store.plansOfGym(gymId).filter((p) => p.active).map((p) => p.price);
    return prices.length ? Math.min(...prices) : 0;
  }
  isMember(gymId: string) {
    return this.store.membershipsOfClient(this.auth.user()!.id).some((m) => m.gymId === gymId && m.status === 'ACTIVE');
  }

  showHours(g: Gym) {
    this.hoursGym.set(g);
    this.hoursVisible = true;
  }

  open(g: Gym) {
    this.gym.set(g);
    this.planId.set(null);
    this.coachId.set(undefined);
    this.promo.set(null);
    this.code = '';
    this.theme.preview.set(g.theme); // show the gym's own brand while joining
    this.visible = true;
  }

  selectPlan(id: string) {
    this.planId.set(id);
    if (this.code) this.apply();
  }

  apply() { this.promo.set(this.store.checkPromo(this.gym()!.id, this.planId()!, this.code)); }

  confirm() {
    const g = this.gym()!;
    if (this.code && !this.store.checkPromo(g.id, this.planId()!, this.code).ok) {
      this.apply();
      return;
    }
    this.store.subscribeClient({ gymId: g.id, clientId: this.auth.user()!.id, planId: this.planId()!, coachId: this.coachId(), promoCode: this.code || undefined });
    this.visible = false;
    this.toast.add({ severity: 'success', summary: `Welcome to ${g.name}!`, detail: 'Your membership is active.' });
  }
}
