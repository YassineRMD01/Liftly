import { LanguageSwitcher } from '../../../shared/language-switcher/language-switcher';
import { TranslatePipe, t } from '../../../core/i18n/i18n';
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
import { Select } from 'primeng/select';
import { CURRENCIES } from '../../../core/currency';
import { AuthService } from '../../../core/auth.service';
import { BillingCycle, Gender, Role } from '../../../core/models';
import { StoreService } from '../../../core/store.service';
import { ThemeService } from '../../../core/theme.service';

/** Sport options: English value (stored), translated label (shown). */
export const sportOptions = () => SPORTS.map((s) => ({ label: t(s), value: s }));

export const SPORTS = ['Fitness', 'Bodybuilding', 'CrossFit', 'Cardio', 'Swimming', 'Aqua Fitness', 'Martial Arts', 'Karate', 'BJJ', 'Kickboxing', 'Boxing', 'Yoga', 'Pilates', 'Tennis', 'Padel', 'Squash', 'Climbing', 'Dance', 'Cycling', 'Football', 'Basketball', 'Other'];

@Component({
  selector: 'app-signup',
  imports: [LanguageSwitcher, TranslatePipe, FormsModule, RouterLink, CurrencyPipe, FaIconComponent, Button, ColorPicker, InputText, Message, SelectButton, MultiSelect, Select],
  templateUrl: './signup.html',
  styleUrl: './signup.css',
})
export class Signup implements OnInit {
  private readonly store = inject(StoreService);
  private readonly auth = inject(AuthService);
  private readonly theme = inject(ThemeService);
  private readonly toast = inject(MessageService);

  /** query params */
  readonly plan = input<string>();
  readonly as = input<string>();

  protected readonly sports = sportOptions();
  protected readonly currencies = CURRENCIES;
  protected readonly role = signal<Role>('ADMIN');
  protected readonly cycle = signal<BillingCycle>('MONTHLY');
  protected readonly planId = signal('sp-pro');
  protected readonly error = signal<string | null>(null);
  protected readonly plans = computed(() => this.store.saasPlans().filter((p) => p.active));
  protected readonly selectedPlan = computed(() => this.store.saasPlan(this.planId()));
  protected readonly genders = [{ label: t('Male'), value: 'MALE' }, { label: t('Female'), value: 'FEMALE' }];
  protected readonly cycles = [{ label: t('Monthly'), value: 'MONTHLY' }, { label: t('Yearly'), value: 'YEARLY' }];
  protected readonly roleOptions: { value: Role; label: string; hint: string; icon: IconProp }[] = [
    { value: 'ADMIN', label: t('Gym owner'), hint: t('Subscribe and manage your gym'), icon: 'building' },
    { value: 'COACH', label: t('Coach'), hint: t('Free — work with many gyms'), icon: 'user-tie' },
  ];

  protected form = { firstName: '', lastName: '', email: '', password: '', gymName: '', sports: ['Fitness'] as string[], gender: null as Gender | null, currency: 'USD', city: '', color: '6366f1', card: '', expiry: '' };

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
    if (!f.firstName || !f.lastName || !f.email || !f.password) return this.error.set(t('Please fill in all your details.'));
    if (this.store.users().some((u) => u.email.toLowerCase() === f.email.toLowerCase())) return this.error.set(t('This email is already registered.'));
    if (this.role() === 'ADMIN' && !f.gymName) return this.error.set(t('Please give your gym a name.'));
    if (this.role() === 'ADMIN' && !f.sports.length) return this.error.set(t('Pick at least one sport.'));

    const user = this.store.addUser({ role: this.role(), firstName: f.firstName, lastName: f.lastName, email: f.email, password: f.password, ...(f.gender ? { gender: f.gender } : {}) });
    if (this.role() === 'ADMIN') {
      const now = new Date();
      this.store.addGym({
        ownerId: user.id, name: f.gymName, sports: f.sports, currency: f.currency, city: f.city, address: '', description: '',
        theme: { primary: '#' + f.color, logoText: f.gymName.split(/\s+/).map((w) => w[0]).join('').slice(0, 2).toUpperCase() },
        saasPlanId: this.planId(), billingCycle: this.cycle(), status: 'TRIAL',
        subscribedAt: now.toISOString(), renewsAt: new Date(now.getTime() + 14 * 86400000).toISOString(),
      });
    }
    this.theme.preview.set(null);
    this.toast.add({ severity: 'success', summary: t('Welcome to Liftly!'), detail: t('Your account is ready.') });
    this.auth.loginAs(user);
  }
}
