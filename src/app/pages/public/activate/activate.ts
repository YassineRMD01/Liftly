import { Component, computed, inject, input, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { FaIconComponent } from '@fortawesome/angular-fontawesome';
import { ButtonDirective } from 'primeng/button';
import { Message } from 'primeng/message';
import { InputPassword } from 'primeng/inputpassword';
import { IconField } from 'primeng/iconfield';
import { InputIcon } from 'primeng/inputicon';
import { AuthService } from '../../../core/auth.service';
import { TranslatePipe, t } from '../../../core/i18n/i18n';
import { StoreService } from '../../../core/store.service';
import { GymLogo } from '../../../shared/gym-logo/gym-logo';

/** Activation page reached from an invitation link: the user chooses a password. */
@Component({
  selector: 'app-activate',
  imports: [TranslatePipe, FormsModule, RouterLink, FaIconComponent, ButtonDirective, Message, InputPassword, IconField, InputIcon, GymLogo],
  templateUrl: './activate.html',
  styleUrl: './activate.css',
})
export class Activate {
  protected readonly store = inject(StoreService);
  private readonly auth = inject(AuthService);
  /** Route param. */
  readonly token = input.required<string>();
  protected readonly user = computed(() => this.store.userByInvite(this.token()));
  private readonly pwd = signal('');
  protected get password() { return this.pwd(); }
  protected set password(v: string) { this.pwd.set(v ?? ''); }
  protected confirm = '';
  /** Password hidden (pInputPassword mask). */
  protected masked = true;
  /** 0–4: length, mixed case, digits, symbols. */
  protected readonly strength = computed(() => {
    const p = this.pwd();
    if (!p) return 0;
    let n = p.length >= 8 ? 1 : 0;
    if (/[a-z]/.test(p) && /[A-Z]/.test(p)) n++;
    if (/\d/.test(p)) n++;
    if (/[^A-Za-z0-9]/.test(p)) n++;
    return Math.max(1, p.length >= 12 ? Math.min(4, n + 1) : n);
  });
  protected readonly strengthLabel = computed(() => ['', 'Weak', 'Fair', 'Good', 'Strong'][this.strength()]);
  protected readonly strengthColor = computed(() => ['', 'bg-red-500', 'bg-amber-500', 'bg-lime-500', 'bg-green-600'][this.strength()]);
  protected error = '';

  submit() {
    if (this.password.length < 6) { this.error = t('Use at least 6 characters.'); return; }
    if (this.password !== this.confirm) { this.error = t('The passwords do not match.'); return; }
    const u = this.store.activate(this.token(), this.password);
    if (!u) { this.error = t('This invitation is no longer valid.'); return; }
    this.auth.signIn(u);
  }
}
