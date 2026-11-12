import { Component, computed, inject, input } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { FaIconComponent } from '@fortawesome/angular-fontawesome';
import { ButtonDirective, ButtonLabel } from 'primeng/button';
import { Message } from 'primeng/message';
import { Password } from 'primeng/password';
import { AuthService } from '../../../core/auth.service';
import { TranslatePipe, t } from '../../../core/i18n/i18n';
import { StoreService } from '../../../core/store.service';
import { GymLogo } from '../../../shared/gym-logo/gym-logo';

/** Activation page reached from an invitation link: the user chooses a password. */
@Component({
  selector: 'app-activate',
  imports: [TranslatePipe, FormsModule, RouterLink, FaIconComponent, ButtonDirective, ButtonLabel, Message, Password, GymLogo],
  templateUrl: './activate.html',
  styleUrl: './activate.css',
})
export class Activate {
  protected readonly store = inject(StoreService);
  private readonly auth = inject(AuthService);
  /** Route param. */
  readonly token = input.required<string>();
  protected readonly user = computed(() => this.store.userByInvite(this.token()));
  protected password = '';
  protected confirm = '';
  protected error = '';

  submit() {
    if (this.password.length < 6) { this.error = t('Use at least 6 characters.'); return; }
    if (this.password !== this.confirm) { this.error = t('The passwords do not match.'); return; }
    const u = this.store.activate(this.token(), this.password);
    if (!u) { this.error = t('This invitation is no longer valid.'); return; }
    this.auth.signIn(u);
  }
}
