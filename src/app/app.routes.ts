import { Routes } from '@angular/router';
import { guestGuard, roleGuard } from './core/guards';

export const routes: Routes = [
  { path: '', loadComponent: () => import('./pages/public/landing').then((m) => m.Landing) },
  { path: 'login', canActivate: [guestGuard], loadComponent: () => import('./pages/public/login').then((m) => m.Login) },
  { path: 'signup', loadComponent: () => import('./pages/public/signup').then((m) => m.Signup) },
  {
    path: 'super-admin',
    loadComponent: () => import('./layout/shell').then((m) => m.Shell),
    canActivate: [roleGuard('SUPER_ADMIN')],
    children: [
      { path: '', loadComponent: () => import('./pages/super-admin/sa-dashboard').then((m) => m.SaDashboard) },
      { path: 'gyms', loadComponent: () => import('./pages/super-admin/sa-gyms').then((m) => m.SaGyms) },
      { path: 'plans', loadComponent: () => import('./pages/super-admin/sa-plans').then((m) => m.SaPlans) },
      { path: 'users', loadComponent: () => import('./pages/super-admin/sa-users').then((m) => m.SaUsers) },
    ],
  },
  {
    path: 'admin',
    loadComponent: () => import('./layout/shell').then((m) => m.Shell),
    canActivate: [roleGuard('ADMIN')],
    children: [
      { path: '', loadComponent: () => import('./pages/admin/admin-dashboard').then((m) => m.AdminDashboard) },
      { path: 'memberships', loadComponent: () => import('./pages/admin/admin-memberships').then((m) => m.AdminMemberships) },
      { path: 'promos', loadComponent: () => import('./pages/admin/admin-promos').then((m) => m.AdminPromos) },
      { path: 'clients', loadComponent: () => import('./pages/admin/admin-clients').then((m) => m.AdminClients) },
      { path: 'coaches', loadComponent: () => import('./pages/admin/admin-coaches').then((m) => m.AdminCoaches) },
      { path: 'branding', loadComponent: () => import('./pages/admin/admin-branding').then((m) => m.AdminBranding) },
      { path: 'billing', loadComponent: () => import('./pages/admin/admin-billing').then((m) => m.AdminBilling) },
    ],
  },
  {
    path: 'coach',
    loadComponent: () => import('./layout/shell').then((m) => m.Shell),
    canActivate: [roleGuard('COACH')],
    children: [
      { path: '', loadComponent: () => import('./pages/coach/coach-dashboard').then((m) => m.CoachDashboard) },
      { path: 'reviews', loadComponent: () => import('./pages/coach/coach-reviews').then((m) => m.CoachReviews) },
      { path: 'profile', loadComponent: () => import('./pages/coach/coach-profile').then((m) => m.CoachProfilePage) },
    ],
  },
  {
    path: 'client',
    loadComponent: () => import('./layout/shell').then((m) => m.Shell),
    canActivate: [roleGuard('CLIENT')],
    children: [
      { path: '', loadComponent: () => import('./pages/client/client-dashboard').then((m) => m.ClientDashboard) },
      { path: 'gyms', loadComponent: () => import('./pages/client/client-gyms').then((m) => m.ClientGyms) },
      { path: 'coaches', loadComponent: () => import('./pages/client/client-coaches').then((m) => m.ClientCoaches) },
    ],
  },
  { path: '**', redirectTo: '' },
];
