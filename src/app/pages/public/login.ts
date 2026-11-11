import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { FaIconComponent } from '@fortawesome/angular-fontawesome';
import { Button } from 'primeng/button';
import { InputText } from 'primeng/inputtext';
import { Message } from 'primeng/message';
import { Password } from 'primeng/password';
import { Tag } from 'primeng/tag';
import { AuthService } from '../../core/auth.service';
import { Role, User } from '../../core/models';
import { StoreService } from '../../core/store.service';

@Component({
  selector: 'app-login',
  imports: [FormsModule, RouterLink, FaIconComponent, Button, InputText, Message, Password, Tag],
  template: `
    <div class="min-h-screen grid lg:grid-cols-2">
      <div class="hidden lg:flex flex-col justify-between p-12 bg-primary text-primary-contrast">
        <a routerLink="/" class="flex items-center gap-2 font-extrabold text-xl"><fa-icon icon="dumbbell" /> Liftly</a>
        <div>
          <h2 class="text-4xl font-extrabold leading-tight">Every sport.<br />Every role.<br />One app.</h2>
          <p class="mt-4 opacity-80 max-w-md">Sign in with your account or pick a demo profile to explore the platform as a super-admin, gym admin, coach or member.</p>
        </div>
        <div class="text-sm opacity-70">Demo password for all accounts: <b>demo</b></div>
      </div>

      <div class="flex items-center justify-center p-6">
        <div class="w-full max-w-md">
          <h1 class="page-title">Welcome back</h1>
          <p class="muted mt-1">Sign in to continue.</p>

          <form class="mt-8 space-y-4" (ngSubmit)="submit()">
            <div class="field">
              <label for="email">Email</label>
              <input pInputText id="email" name="email" type="email" [(ngModel)]="email" required autocomplete="username" />
            </div>
            <div class="field">
              <label for="pwd">Password</label>
              <p-password inputId="pwd" name="password" [(ngModel)]="password" [feedback]="false" [toggleMask]="true" styleClass="w-full" inputStyleClass="w-full" />
            </div>
            @if (error()) { <p-message severity="error">{{ error()! }}</p-message> }
            <p-button type="submit" label="Sign in" styleClass="w-full" />
          </form>

          <div class="mt-8">
            <div class="text-sm font-semibold mb-3">Quick demo access</div>
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
              @for (u of demo(); track u.id) {
                <button type="button" (click)="auth.loginAs(u)"
                  class="text-left card !p-3 hover:!border-primary transition-colors cursor-pointer">
                  <div class="flex items-center justify-between gap-2">
                    <span class="font-medium text-sm truncate">{{ u.firstName }} {{ u.lastName }}</span>
                    <p-tag [value]="label[u.role]" [severity]="sev[u.role]" />
                  </div>
                  <div class="text-xs muted truncate mt-1">{{ u.email }}</div>
                </button>
              }
            </div>
          </div>

          <p class="text-sm muted mt-8 text-center">
            New here? <a routerLink="/signup" class="text-primary font-semibold">Create an account</a>
          </p>
        </div>
      </div>
    </div>
  `,
})
export class Login {
  protected readonly auth = inject(AuthService);
  private readonly store = inject(StoreService);
  protected email = '';
  protected password = '';
  protected readonly error = signal<string | null>(null);
  protected readonly label: Record<Role, string> = { SUPER_ADMIN: 'Super admin', ADMIN: 'Gym admin', COACH: 'Coach', CLIENT: 'Member' };
  protected readonly sev: Record<Role, 'danger' | 'warn' | 'info' | 'success'> = { SUPER_ADMIN: 'danger', ADMIN: 'warn', COACH: 'info', CLIENT: 'success' };
  protected readonly demo = computed(() =>
    ['u-sa', 'u-a1', 'u-a2', 'u-c1', 'u-k1', 'u-k2'].map((id) => this.store.user(id)).filter((u): u is User => !!u),
  );

  submit() {
    const u = this.auth.login(this.email, this.password);
    if (!u) {
      this.error.set('Invalid email or password.');
      return;
    }
    this.auth.loginAs(u);
  }
}
