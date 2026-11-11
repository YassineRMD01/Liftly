import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService, HOME_BY_ROLE } from './auth.service';
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
