import { HttpErrorResponse, HttpInterceptorFn, HttpRequest, HttpResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { Observable, delay, of, throwError } from 'rxjs';
import { CheckIn } from './models';
import { StoreService } from './store.service';

/**
 * Stand-in for the real backend: every `/api/...` request is answered from the local store
 * (localStorage), so pages written against `ApiService` keep working once a server exists —
 * remove this interceptor and point `API_BASE` at it.
 */
export const mockBackendInterceptor: HttpInterceptorFn = (req, next) => {
  if (!req.url.startsWith('/api/')) return next(req);
  // a real request would fail without a connection: behave the same
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    return throwError(() => new HttpErrorResponse({ status: 0, statusText: 'Offline', url: req.url }));
  }
  const store = inject(StoreService);
  const res = route(store, req);
  if (!res) return throwError(() => new HttpErrorResponse({ status: 404, statusText: 'Not Found', url: req.url }));
  return res.pipe(delay(120));
};

type Handler = (store: StoreService, req: HttpRequest<unknown>, p: string[]) => unknown;
const ROUTES: [string, RegExp, Handler][] = [
  ['GET', /^\/api\/gyms$/, (s) => s.gyms()],
  ['GET', /^\/api\/gyms\/([^/]+)$/, (s, _r, [id]) => s.gym(id) ?? null],
  ['GET', /^\/api\/gyms\/([^/]+)\/classes$/, (s, _r, [id]) => s.classesOfGym(id)],
  ['GET', /^\/api\/gyms\/([^/]+)\/members$/, (s, _r, [id]) => s.clientsOfGym(id).map(({ password: _p, ...u }) => u)],
  ['GET', /^\/api\/gyms\/([^/]+)\/checkins$/, (s, _r, [id]) => s.checkIns().filter((c) => c.gymId === id)],
  ['POST', /^\/api\/gyms\/([^/]+)\/checkins$/, (s, r, [id]) => {
    const b = r.body as { clientId: string; method: CheckIn['method']; staffId?: string; locationId?: string };
    return s.checkIn(id, b.clientId, b.method, b.staffId, b.locationId);
  }],
  ['GET', /^\/api\/users\/([^/]+)\/notifications$/, (s, _r, [id]) => s.notificationsOf(id)],
];

function route(store: StoreService, req: HttpRequest<unknown>): Observable<HttpResponse<unknown>> | null {
  const path = req.url.split('?')[0];
  for (const [method, re, handler] of ROUTES) {
    const m = method === req.method ? re.exec(path) : null;
    if (m) {
      const body = handler(store, req, m.slice(1).map(decodeURIComponent));
      return body === null ? null : of(new HttpResponse({ status: method === 'POST' ? 201 : 200, body, url: req.url }));
    }
  }
  return null;
}
