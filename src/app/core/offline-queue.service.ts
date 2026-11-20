import { HttpErrorResponse } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { MessageService } from 'primeng/api';
import { ApiService } from './api.service';
import { t } from './i18n/i18n';
import { CheckIn } from './models';

const KEY = 'liftly-offline-queue';
interface Pending { gymId: string; clientId: string; method: CheckIn['method']; staffId?: string; locationId?: string; at: string }

/**
 * Check-ins go through the API; without a connection they are kept in localStorage
 * and sent automatically when the browser is back online.
 */
@Injectable({ providedIn: 'root' })
export class OfflineQueueService {
  private readonly api = inject(ApiService);
  private readonly toast = inject(MessageService);
  readonly online = signal(typeof navigator === 'undefined' ? true : navigator.onLine);
  readonly pending = signal<Pending[]>(this.read());
  readonly count = computed(() => this.pending().length);
  private syncing = false;

  constructor() {
    if (typeof window === 'undefined') return;
    window.addEventListener('online', () => { this.online.set(true); this.sync(); });
    window.addEventListener('offline', () => this.online.set(false));
    if (this.online() && this.count()) setTimeout(() => this.sync());
  }

  async checkIn(gymId: string, clientId: string, method: CheckIn['method'], staffId?: string, locationId?: string): Promise<CheckIn> {
    const body = { clientId, method, ...(staffId ? { staffId } : {}), ...(locationId ? { locationId } : {}) };
    try {
      return await this.api.checkIn(gymId, body);
    } catch (e) {
      if (!(e instanceof HttpErrorResponse) || e.status !== 0) throw e;
      const at = new Date().toISOString();
      // the same member scanned twice while offline: keep one
      if (!this.pending().some((p) => p.gymId === gymId && p.clientId === clientId && Date.now() - Date.parse(p.at) < 15 * 60000)) {
        this.save([...this.pending(), { gymId, ...body, at }]);
      }
      return { id: 'offline', gymId, clientId, at, method, ok: true, queued: true, reason: 'Saved offline — syncs when back online', ...(locationId ? { locationId } : {}) };
    }
  }

  /** Sends what was recorded offline, oldest first. */
  async sync() {
    if (this.syncing || !this.count()) return;
    this.syncing = true;
    let sent = 0;
    try {
      for (const p of [...this.pending()]) {
        try { await this.api.checkIn(p.gymId, { clientId: p.clientId, method: p.method, staffId: p.staffId, locationId: p.locationId }); }
        catch (e) { if (e instanceof HttpErrorResponse && e.status === 0) break; }
        sent++;
        this.save(this.pending().slice(1));
      }
    } finally { this.syncing = false; }
    if (sent) this.toast.add({ severity: 'success', summary: t('Back online'), detail: t('{count} check-ins synced', { count: sent }) });
  }

  private read(): Pending[] { try { return JSON.parse(localStorage.getItem(KEY) ?? '[]'); } catch { return []; } }
  private save(q: Pending[]) { this.pending.set(q); try { localStorage.setItem(KEY, JSON.stringify(q)); } catch { /* ignore */ } }
}
