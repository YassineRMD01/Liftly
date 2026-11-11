import { Component, computed, inject, signal } from '@angular/core';
import { CurrencyPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { FaIconComponent } from '@fortawesome/angular-fontawesome';
import { IconProp } from '@fortawesome/fontawesome-svg-core';
import { Button } from 'primeng/button';
import { SelectButton } from 'primeng/selectbutton';
import { Tag } from 'primeng/tag';
import { AuthService, HOME_BY_ROLE } from '../../core/auth.service';
import { BillingCycle } from '../../core/models';
import { StoreService } from '../../core/store.service';
import { ThemeService } from '../../core/theme.service';

@Component({
  selector: 'app-landing',
  imports: [RouterLink, FormsModule, CurrencyPipe, FaIconComponent, Button, SelectButton, Tag],
  template: `
    <header class="sticky top-0 z-20 bg-surface-0/80 dark:bg-surface-900/80 backdrop-blur border-b border-surface-200 dark:border-surface-800">
      <div class="max-w-7xl mx-auto h-16 px-4 flex items-center gap-4">
        <a routerLink="/" class="flex items-center gap-2 font-extrabold text-lg">
          <span class="w-9 h-9 rounded-xl bg-primary text-primary-contrast grid place-items-center"><fa-icon icon="dumbbell" /></span>
          Liftly
        </a>
        <nav class="hidden md:flex gap-6 text-sm muted ml-6">
          <a href="#features" class="hover:text-primary">Features</a>
          <a href="#pricing" class="hover:text-primary">Pricing</a>
        </nav>
        <div class="flex-1"></div>
        <p-button [text]="true" [rounded]="true" severity="secondary" (onClick)="theme.toggleDark()" ariaLabel="Toggle dark mode">
          <fa-icon [icon]="theme.dark() ? 'sun' : 'moon'" />
        </p-button>
        @if (auth.user(); as u) {
          <p-button label="Open dashboard" [routerLink]="home()" />
        } @else {
          <p-button label="Sign in" [text]="true" routerLink="/login" />
          <p-button label="Start free trial" routerLink="/signup" class="hidden sm:inline-flex" />
        }
      </div>
    </header>

    <!-- hero -->
    <section class="relative overflow-hidden">
      <div class="absolute inset-0 bg-gradient-to-br from-primary-100 via-transparent to-transparent dark:from-primary-950 pointer-events-none"></div>
      <div class="relative max-w-7xl mx-auto px-4 py-20 lg:py-28 grid lg:grid-cols-2 gap-12 items-center">
        <div>
          <p-tag value="For every sport — gym, pool, dojo, court" [rounded]="true" />
          <h1 class="text-4xl lg:text-6xl font-extrabold tracking-tight mt-5 leading-tight">
            Run your gym.<br /><span class="text-primary">Grow your community.</span>
          </h1>
          <p class="text-lg muted mt-5 max-w-xl">
            Memberships, promo codes, coaches with star ratings and your own brand colors —
            one platform for owners, coaches and members.
          </p>
          <div class="flex flex-wrap gap-3 mt-8">
            <p-button label="Start 14-day free trial" size="large" routerLink="/signup">
              <ng-template #icon><fa-icon icon="rocket" /></ng-template>
            </p-button>
            <p-button label="Try the demo" size="large" severity="secondary" [outlined]="true" routerLink="/login" />
          </div>
        </div>
        <div class="grid grid-cols-2 gap-4">
          @for (s of showcase; track s.label) {
            <div class="card flex flex-col gap-2">
              <div class="w-11 h-11 rounded-xl bg-primary text-primary-contrast grid place-items-center text-lg"><fa-icon [icon]="s.icon" /></div>
              <div class="font-semibold">{{ s.label }}</div>
              <div class="text-sm muted">{{ s.text }}</div>
            </div>
          }
        </div>
      </div>
    </section>

    <!-- features -->
    <section id="features" class="max-w-7xl mx-auto px-4 py-16">
      <h2 class="text-3xl font-bold text-center">Built for every role</h2>
      <div class="grid sm:grid-cols-2 lg:grid-cols-4 gap-5 mt-10">
        @for (r of roles; track r.title) {
          <div class="card">
            <fa-icon [icon]="r.icon" class="text-2xl text-primary" />
            <h3 class="font-semibold text-lg mt-3">{{ r.title }}</h3>
            <ul class="mt-3 space-y-2 text-sm muted">
              @for (f of r.items; track f) {
                <li class="flex gap-2"><fa-icon icon="check" class="text-primary mt-0.5" />{{ f }}</li>
              }
            </ul>
          </div>
        }
      </div>
    </section>

    <!-- pricing -->
    <section id="pricing" class="max-w-7xl mx-auto px-4 py-16">
      <div class="text-center">
        <h2 class="text-3xl font-bold">Simple pricing for gym owners</h2>
        <p class="muted mt-2">Coaches and members always join for free.</p>
        <p-selectbutton class="mt-6 inline-flex" [options]="cycles" optionLabel="label" optionValue="value" [(ngModel)]="cycle" [allowEmpty]="false" />
      </div>
      <div class="grid md:grid-cols-3 gap-6 mt-10">
        @for (p of plans(); track p.id) {
          <div class="card relative flex flex-col" [class.!border-primary]="p.highlighted" [class.ring-2]="p.highlighted" [class.ring-primary]="p.highlighted">
            @if (p.highlighted) {
              <p-tag value="Most popular" class="absolute -top-3 left-1/2 -translate-x-1/2" [rounded]="true" />
            }
            <h3 class="text-xl font-bold">{{ p.name }}</h3>
            <p class="text-sm muted mt-1">{{ p.description }}</p>
            <div class="mt-5 flex items-end gap-1">
              <span class="text-4xl font-extrabold">{{ (cycle() === 'MONTHLY' ? p.monthlyPrice : p.yearlyPrice) | currency: 'USD' : 'symbol' : '1.0-0' }}</span>
              <span class="muted mb-1">/{{ cycle() === 'MONTHLY' ? 'month' : 'year' }}</span>
            </div>
            <ul class="mt-6 space-y-2.5 text-sm flex-1">
              <li class="flex gap-2"><fa-icon icon="user-tie" class="text-primary w-4" />{{ p.maxCoaches === -1 ? 'Unlimited' : p.maxCoaches }} coaches</li>
              <li class="flex gap-2"><fa-icon icon="users" class="text-primary w-4" />{{ p.maxClients === -1 ? 'Unlimited' : p.maxClients }} clients</li>
              @for (f of p.features; track f) {
                <li class="flex gap-2"><fa-icon icon="check" class="text-primary w-4" />{{ f }}</li>
              }
            </ul>
            <p-button class="mt-6" styleClass="w-full" [label]="'Choose ' + p.name" [outlined]="!p.highlighted"
              routerLink="/signup" [queryParams]="{ plan: p.id, cycle: cycle() }" />
          </div>
        }
      </div>
    </section>

    <footer class="border-t border-surface-200 dark:border-surface-800 py-8 text-center text-sm muted">
      © {{ year }} Liftly · Made for gyms, pools, dojos and courts.
    </footer>
  `,
})
export class Landing {
  protected readonly auth = inject(AuthService);
  protected readonly theme = inject(ThemeService);
  private readonly store = inject(StoreService);
  protected readonly year = new Date().getFullYear();
  protected readonly cycle = signal<BillingCycle>('MONTHLY');
  protected readonly cycles = [
    { label: 'Monthly', value: 'MONTHLY' },
    { label: 'Yearly (2 months free)', value: 'YEARLY' },
  ];
  protected readonly plans = computed(() => this.store.saasPlans().filter((p) => p.active));
  protected readonly home = computed(() => HOME_BY_ROLE[this.auth.role() ?? 'CLIENT']);

  protected readonly showcase: { icon: IconProp; label: string; text: string }[] = [
    { icon: 'id-card', label: 'Memberships', text: 'Create plans with any duration and price.' },
    { icon: 'ticket', label: 'Promo codes', text: 'Percent or fixed discounts with limits.' },
    { icon: 'star', label: 'Coach ratings', text: 'Members rate and review their coaches.' },
    { icon: 'palette', label: 'Your brand', text: 'Pick your colors — the app follows.' },
  ];
  protected readonly roles: { icon: IconProp; title: string; items: string[] }[] = [
    { icon: 'crown', title: 'Platform owner', items: ['Manage pricing plans', 'Monitor all gyms & MRR', 'Suspend or activate gyms'] },
    { icon: 'building', title: 'Gym admin', items: ['Membership plans & promo codes', 'Opening hours: mixed, men-only & women-only', 'Multi-sport gyms', 'Custom theme color'] },
    { icon: 'user-tie', title: 'Coach', items: ['Work at multiple gyms', 'Star ratings & comments', 'Public profile'] },
    { icon: 'person-running', title: 'Member', items: ['Join many gyms', 'See hours open to you', 'Apply promo codes', 'Rate your coaches'] },
  ];
}
