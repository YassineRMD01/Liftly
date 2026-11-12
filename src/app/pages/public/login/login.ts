import { GymLogo } from '../../../shared/gym-logo/gym-logo';
import { LanguageSwitcher } from '../../../shared/language-switcher/language-switcher';
import { TranslatePipe, t } from '../../../core/i18n/i18n';
import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { FaIconComponent } from '@fortawesome/angular-fontawesome';
import { Button } from 'primeng/button';
import { InputText } from 'primeng/inputtext';
import { Message } from 'primeng/message';
import { Password } from 'primeng/password';
import { Tag } from 'primeng/tag';
import { AuthService } from '../../../core/auth.service';
import { Role, User } from '../../../core/models';
import { StoreService } from '../../../core/store.service';

@Component({
  selector: 'app-login',
  imports: [GymLogo, LanguageSwitcher, TranslatePipe, FormsModule, RouterLink, FaIconComponent, Button, InputText, Message, Password, Tag],
  templateUrl: './login.html',
  styleUrl: './login.css',
})
export class Login {
  protected readonly auth = inject(AuthService);
  protected readonly store = inject(StoreService);
  protected email = '';
  protected password = '';
  protected readonly error = signal<string | null>(null);
  protected readonly label: Record<Role, string> = { SUPER_ADMIN: t('Super admin'), ADMIN: t('Gym admin'), COACH: t('Coach'), CLIENT: t('Member') };
  protected readonly sev: Record<Role, 'danger' | 'warn' | 'info' | 'success'> = { SUPER_ADMIN: 'danger', ADMIN: 'warn', COACH: 'info', CLIENT: 'success' };
  protected readonly demo = computed(() =>
    ['u-sa', 'u-a1', 'u-a2', 'u-c1', 'u-k1', 'u-k2'].map((id) => this.store.user(id)).filter((u): u is User => !!u),
  );

  submit() {
    const u = this.auth.login(this.email, this.password);
    if (!u) {
      this.error.set(t('Invalid email or password.'));
      return;
    }
    this.auth.loginAs(u);
  }
}
