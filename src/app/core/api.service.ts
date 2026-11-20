import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { AppNotification, CheckIn, Gym, GymClass, User } from './models';

/** Base URL of the backend. `/api` is answered by `mockBackendInterceptor` until a server exists. */
export const API_BASE = '/api';

/** Typed HTTP client for the Liftly API. */
@Injectable({ providedIn: 'root' })
export class ApiService {
  private readonly http = inject(HttpClient);
  private get<T>(path: string) { return firstValueFrom(this.http.get<T>(API_BASE + path)); }
  private post<T>(path: string, body: unknown) { return firstValueFrom(this.http.post<T>(API_BASE + path, body)); }

  gyms() { return this.get<Gym[]>('/gyms'); }
  gym(id: string) { return this.get<Gym>(`/gyms/${id}`); }
  classes(gymId: string) { return this.get<GymClass[]>(`/gyms/${gymId}/classes`); }
  members(gymId: string) { return this.get<Omit<User, 'password'>[]>(`/gyms/${gymId}/members`); }
  checkIns(gymId: string) { return this.get<CheckIn[]>(`/gyms/${gymId}/checkins`); }
  checkIn(gymId: string, body: { clientId: string; method: CheckIn['method']; staffId?: string; locationId?: string }) {
    return this.post<CheckIn>(`/gyms/${gymId}/checkins`, body);
  }
  notifications(userId: string) { return this.get<AppNotification[]>(`/users/${userId}/notifications`); }
}
