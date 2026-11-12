import { Injectable, computed, effect, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { Role, User } from './models';
import { StoreService } from './store.service';

const SESSION_KEY = 'liftly-session';

export const HOME_BY_ROLE: Record<Role, string> = {
  SUPER_ADMIN: '/super-admin',
  ADMIN: '/admin',
  COACH: '/coach',
  CLIENT: '/client',
  STAFF: '/staff',
};

/** Fake authentication against the mock store. Replace with a real JWT flow. */
@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly store = inject(StoreService);
  private readonly router = inject(Router);

  private readonly userId = signal<string | null>(this.read('userId'));
  /** Gym the admin is currently managing (admins may own several). */
  readonly activeGymId = signal<string | null>(this.read('gymId'));

  readonly user = computed<User | undefined>(() => this.store.user(this.userId() ?? undefined));
  readonly role = computed(() => this.user()?.role);
  readonly isLoggedIn = computed(() => !!this.user());

  /** Gyms the user manages: owned (admin) or works the front desk of (staff). */
  readonly adminGyms = computed(() => {
    const u = this.user();
    return u?.role === 'ADMIN' ? this.store.gymsOfAdmin(u.id) : u?.role === 'STAFF' ? this.store.gymsOfStaff(u.id) : [];
  });
  readonly activeGym = computed(() => {
    const gyms = this.adminGyms();
    return gyms.find((g) => g.id === this.activeGymId()) ?? gyms[0];
  });

  constructor() {
    // audit entries are attributed to the signed-in user
    effect(() => this.store.actorId.set(this.userId()));
    effect(() => {
      try {
        localStorage.setItem(SESSION_KEY, JSON.stringify({ userId: this.userId(), gymId: this.activeGymId() }));
      } catch { /* ignore */ }
    });
  }

  private read(key: 'userId' | 'gymId'): string | null {
    try {
      return JSON.parse(localStorage.getItem(SESSION_KEY) ?? '{}')[key] ?? null;
    } catch {
      return null;
    }
  }

  login(email: string, password: string): User | null {
    const u = this.store.users().find((x) => x.email.toLowerCase() === email.trim().toLowerCase() && !!x.password && x.password === password);
    if (!u || !u.active) return null;
    this.userId.set(u.id);
    this.activeGymId.set(null);
    return u;
  }

  /** An invited user whose account is not activated yet. */
  pendingInvite(email: string) { return this.store.users().find((x) => x.email.toLowerCase() === email.trim().toLowerCase() && !!x.invite && !x.password); }

  /** Sign in right after activating an invitation. */
  signIn(user: User) {
    this.userId.set(user.id);
    this.activeGymId.set(null);
    this.router.navigateByUrl(HOME_BY_ROLE[user.role]);
  }

  loginAs(user: User) {
    this.userId.set(user.id);
    this.activeGymId.set(null);
    this.router.navigateByUrl(HOME_BY_ROLE[user.role]);
  }

  logout() {
    this.userId.set(null);
    this.activeGymId.set(null);
    this.router.navigateByUrl('/');
  }

  selectGym(id: string) { this.activeGymId.set(id); }
}
