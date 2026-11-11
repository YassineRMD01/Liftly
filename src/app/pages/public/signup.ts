import { Component, OnInit, computed, inject, input, signal } from '@angular/core';
import { CurrencyPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { MessageService } from 'primeng/api';
import { FaIconComponent } from '@fortawesome/angular-fontawesome';
import { IconProp } from '@fortawesome/fontawesome-svg-core';
import { Button } from 'primeng/button';
import { ColorPicker } from 'primeng/colorpicker';
import { InputText } from 'primeng/inputtext';
import { Message } from 'primeng/message';
import { SelectButton } from 'primeng/selectbutton';
import { MultiSelect } from 'primeng/multiselect';
import { AuthService } from '../../core/auth.service';
import { BillingCycle, Gender, Role } from '../../core/models';
import { StoreService } from '../../core/store.service';
import { ThemeService } from '../../core/theme.service';

export const SPORTS = ['Fitness', 'Bodybuilding', 'CrossFit', 'Cardio', 'Swimming', 'Aqua Fitness', 'Martial Arts', 'Karate', 'BJJ', 'Kickboxing', 'Boxing', 'Yoga', 'Pilates', 'Tennis', 'Padel', 'Squash', 'Climbing', 'Dance', 'Cycling', 'Football', 'Basketball', 'Other'];

@Component({
  selector: 'app-signup',
  imports: [FormsModule, RouterLink, CurrencyPipe, FaIconComponent, Button, ColorPicker, InputText, Message, SelectButton, MultiSelect],
  template: `
    <div class="min-h-screen flex flex-col">
      <header class="h-16 px-4 flex items-center max-w-5xl w-full mx-auto">
        <a routerLink="/" class="flex items-center gap-2 font-extrabold text-lg">
          <span class="w-9 h-9 rounded-xl bg-primary text-primary-contrast grid place-items-center"><fa-icon icon="dumbbell" /></span> Liftly
        </a>
        <div class="flex-1"></div>
        <a routerLink="/login" class="text-sm text-primary font-semibold">Already have an account?</a>
      </header>

      <div class="flex-1 max-w-5xl w-full mx-auto px-4 py-8">
        <h1 class="page-title">Create your account</h1>
        <p class="muted mt-1">Who are you joining as?</p>
        <p class="text-sm muted mt-1"><fa-icon icon="circle-info" class="text-primary" /> Members don't sign up here — your gym creates your account and sends you your login.</p>

        <div class="grid sm:grid-cols-2 gap-3 mt-6">
          @for (r of roleOptions; track r.value) {
            <button type="button" (click)="setRole(r.value)"
              class="card !p-4 text-left cursor-pointer transition-all"
              [class.!border-primary]="role() === r.value" [class.ring-2]="role() === r.value" [class.ring-primary]="role() === r.value">
              <fa-icon [icon]="r.icon" class="text-xl text-primary" />
              <div class="font-semibold mt-2">{{ r.label }}</div>
              <div class="text-xs muted">{{ r.hint }}</div>
            </button>
          }
        </div>

        <div class="grid lg:grid-cols-3 gap-6 mt-8">
          <form class="lg:col-span-2 card space-y-5" (ngSubmit)="submit()">
            <h2 class="font-semibold text-lg">Your details</h2>
            <div class="grid sm:grid-cols-2 gap-4">
              <div class="field"><label>First name</label><input pInputText name="fn" [(ngModel)]="form.firstName" required /></div>
              <div class="field"><label>Last name</label><input pInputText name="ln" [(ngModel)]="form.lastName" required /></div>
              <div class="field"><label>Email</label><input pInputText type="email" name="em" [(ngModel)]="form.email" required /></div>
              <div class="field"><label>Password</label><input pInputText type="password" name="pw" [(ngModel)]="form.password" required /></div>
              <div class="field sm:col-span-2">
                <label>Gender <span class="muted font-normal">(used to show men-only / women-only hours that apply to you)</span></label>
                <p-selectbutton name="gd" [options]="genders" optionLabel="label" optionValue="value" [(ngModel)]="form.gender" />
              </div>
            </div>

            @if (role() === 'ADMIN') {
              <h2 class="font-semibold text-lg pt-2">Your gym</h2>
              <div class="grid sm:grid-cols-2 gap-4">
                <div class="field"><label>Gym name</label><input pInputText name="gn" [(ngModel)]="form.gymName" required /></div>
                <div class="field"><label>Sports / activities</label><p-multiselect name="sp" [options]="sports" [(ngModel)]="form.sports" display="chip" placeholder="Pick one or more" styleClass="w-full" /></div>
                <div class="field"><label>City</label><input pInputText name="ci" [(ngModel)]="form.city" /></div>
                <div class="field">
                  <label>Brand color</label>
                  <div class="flex items-center gap-3">
                    <p-colorpicker name="col" [(ngModel)]="form.color" (ngModelChange)="previewColor($event)" />
                    <span class="text-sm muted">#{{ form.color }}</span>
                  </div>
                </div>
              </div>

              <h2 class="font-semibold text-lg pt-2">Plan</h2>
              <p-selectbutton name="cy" [options]="cycles" optionLabel="label" optionValue="value" [ngModel]="cycle()" (ngModelChange)="cycle.set($event)" [allowEmpty]="false" />
              <div class="grid sm:grid-cols-3 gap-3">
                @for (p of plans(); track p.id) {
                  <button type="button" (click)="planId.set(p.id)" class="card !p-4 text-left cursor-pointer"
                    [class.!border-primary]="planId() === p.id" [class.ring-2]="planId() === p.id" [class.ring-primary]="planId() === p.id">
                    <div class="font-semibold">{{ p.name }}</div>
                    <div class="text-xl font-bold mt-1">{{ price(p.id) | currency: 'USD' : 'symbol' : '1.0-0' }}</div>
                    <div class="text-xs muted">{{ cycle() === 'MONTHLY' ? 'per month' : 'per year' }}</div>
                  </button>
                }
              </div>

              <h2 class="font-semibold text-lg pt-2">Payment</h2>
              <p-message severity="info">Demo mode — no card is charged. Plug Stripe / your PSP here.</p-message>
              <div class="grid sm:grid-cols-3 gap-4">
                <div class="field sm:col-span-2"><label>Card number</label><input pInputText name="cc" placeholder="4242 4242 4242 4242" [(ngModel)]="form.card" /></div>
                <div class="field"><label>Expiry</label><input pInputText name="ex" placeholder="12/29" [(ngModel)]="form.expiry" /></div>
              </div>
            }

            @if (error()) { <p-message severity="error">{{ error()! }}</p-message> }
            <p-button type="submit" [label]="role() === 'ADMIN' ? 'Start 14-day free trial' : 'Create account'" styleClass="w-full" />
          </form>

          @if (role() === 'ADMIN' && selectedPlan(); as p) {
            <aside class="card h-fit sticky top-6">
              <div class="text-sm muted">Summary</div>
              <div class="text-xl font-bold mt-1">{{ p.name }} plan</div>
              <div class="flex justify-between mt-4 text-sm"><span>Billing</span><span>{{ cycle() === 'MONTHLY' ? 'Monthly' : 'Yearly' }}</span></div>
              <div class="flex justify-between mt-2 text-sm"><span>Free trial</span><span>14 days</span></div>
              <div class="flex justify-between mt-4 pt-4 border-t border-surface-200 dark:border-surface-800 font-semibold">
                <span>Then</span><span>{{ price(p.id) | currency }}</span>
              </div>
              <ul class="mt-4 space-y-2 text-sm muted">
                @for (f of p.features; track f) { <li class="flex gap-2"><fa-icon icon="check" class="text-primary" />{{ f }}</li> }
              </ul>
            </aside>
          }
        </div>
      </div>
    </div>
  `,
})
export class Signup implements OnInit {
  private readonly store = inject(StoreService);
  private readonly auth = inject(AuthService);
  private readonly theme = inject(ThemeService);
  private readonly toast = inject(MessageService);

  /** query params */
  readonly plan = input<string>();
  readonly as = input<string>();

  protected readonly sports = SPORTS;
  protected readonly role = signal<Role>('ADMIN');
  protected readonly cycle = signal<BillingCycle>('MONTHLY');
  protected readonly planId = signal('sp-pro');
  protected readonly error = signal<string | null>(null);
  protected readonly plans = computed(() => this.store.saasPlans().filter((p) => p.active));
  protected readonly selectedPlan = computed(() => this.store.saasPlan(this.planId()));
  protected readonly genders = [{ label: 'Male', value: 'MALE' }, { label: 'Female', value: 'FEMALE' }];
  protected readonly cycles = [{ label: 'Monthly', value: 'MONTHLY' }, { label: 'Yearly', value: 'YEARLY' }];
  protected readonly roleOptions: { value: Role; label: string; hint: string; icon: IconProp }[] = [
    { value: 'ADMIN', label: 'Gym owner', hint: 'Subscribe and manage your gym', icon: 'building' },
    { value: 'COACH', label: 'Coach', hint: 'Free — work with many gyms', icon: 'user-tie' },
  ];

  protected form = { firstName: '', lastName: '', email: '', password: '', gymName: '', sports: ['Fitness'] as string[], gender: null as Gender | null, city: '', color: '6366f1', card: '', expiry: '' };

  ngOnInit() {
    if (this.plan()) this.planId.set(this.plan()!);
    const as = this.as()?.toUpperCase();
    if (as === 'COACH') this.role.set(as);
    const qp = new URLSearchParams(location.search).get('cycle');
    if (qp === 'YEARLY') this.cycle.set('YEARLY');
  }

  setRole(r: Role) {
    this.role.set(r);
    if (r !== 'ADMIN') this.theme.preview.set(null);
  }

  price(id: string) {
    const p = this.store.saasPlan(id);
    return p ? (this.cycle() === 'MONTHLY' ? p.monthlyPrice : p.yearlyPrice) : 0;
  }

  previewColor(hex: string) {
    this.theme.preview.set({ primary: '#' + hex, logoText: '' });
  }

  submit() {
    const f = this.form;
    this.error.set(null);
    if (!f.firstName || !f.lastName || !f.email || !f.password) return this.error.set('Please fill in all your details.');
    if (this.store.users().some((u) => u.email.toLowerCase() === f.email.toLowerCase())) return this.error.set('This email is already registered.');
    if (this.role() === 'ADMIN' && !f.gymName) return this.error.set('Please give your gym a name.');
    if (this.role() === 'ADMIN' && !f.sports.length) return this.error.set('Pick at least one sport.');

    const user = this.store.addUser({ role: this.role(), firstName: f.firstName, lastName: f.lastName, email: f.email, password: f.password, ...(f.gender ? { gender: f.gender } : {}) });
    if (this.role() === 'ADMIN') {
      const now = new Date();
      this.store.addGym({
        ownerId: user.id, name: f.gymName, sports: f.sports, city: f.city, address: '', description: '',
        theme: { primary: '#' + f.color, logoText: f.gymName.split(/\s+/).map((w) => w[0]).join('').slice(0, 2).toUpperCase() },
        saasPlanId: this.planId(), billingCycle: this.cycle(), status: 'TRIAL',
        subscribedAt: now.toISOString(), renewsAt: new Date(now.getTime() + 14 * 86400000).toISOString(),
      });
    }
    this.theme.preview.set(null);
    this.toast.add({ severity: 'success', summary: 'Welcome to Liftly!', detail: 'Your account is ready.' });
    this.auth.loginAs(user);
  }
}
