import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService, HOME_BY_ROLE } from './auth.service';
import { StoreService } from './store.service';
import { Role } from './models';

export const roleGuard = (...roles: Role[]): CanActivateFn => () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  const role = auth.role();
  if (!role) return router.createUrlTree(['/login']);
  return roles.includes(role) ? true : router.createUrlTree([HOME_BY_ROLE[role]]);
};

export const guestGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const role = auth.role();
  return role ? inject(Router).createUrlTree([HOME_BY_ROLE[role]]) : true;
};

/** Any signed-in user. */
export const authGuard: CanActivateFn = () => (inject(AuthService).role() ? true : inject(Router).createUrlTree(['/login']));

/** The gym's Liftly plan must include the module; otherwise show the upgrade page. */
export const moduleGuard = (mod: import('./models').GymModule): CanActivateFn => () => {
  const auth = inject(AuthService);
  const store = inject(StoreService);
  const gym = auth.activeGym();
  return !gym || store.hasModule(gym.id, mod) ? true : inject(Router).createUrlTree([auth.role() === 'STAFF' ? '/staff/upgrade' : '/admin/upgrade'], { queryParams: { feature: mod } });
};
