import { OfflineQueueService } from '../../core/offline-queue.service';
import { Component, DestroyRef, computed, inject, signal, viewChild } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { FaIconComponent } from '@fortawesome/angular-fontawesome';
import { ButtonDirective } from 'primeng/button';
import { InputText } from 'primeng/inputtext';
import { AuthService, HOME_BY_ROLE } from '../../core/auth.service';
import { TranslatePipe, t } from '../../core/i18n/i18n';
import { CheckIn } from '../../core/models';
import { parseMemberQr } from '../../core/qr';
import { StoreService } from '../../core/store.service';
import { GymLogo } from '../../shared/gym-logo/gym-logo';
import { Modal } from '../../shared/modal/modal';
import { QrCamera } from '../../shared/qr-camera/qr-camera';

/** Self check-in kiosk: full screen at the entrance; members scan their QR card. Staff password to exit. */
@Component({
  selector: 'app-kiosk',
  imports: [TranslatePipe, DatePipe, FormsModule, FaIconComponent, ButtonDirective, InputText, GymLogo, Modal, QrCamera],
  templateUrl: './kiosk.html',
  styleUrl: './kiosk.css',
})
export class Kiosk {
  protected readonly offline = inject(OfflineQueueService);
  private readonly auth = inject(AuthService);
  protected readonly store = inject(StoreService);
  private readonly router = inject(Router);
  private readonly camera = viewChild(QrCamera);
  protected readonly gym = this.auth.activeGym;
  protected readonly started = signal(false);
  protected readonly now = signal(new Date());
  protected readonly result = signal<CheckIn | null>(null);
  protected readonly todayCount = computed(() => {
    const day = new Date().toISOString().slice(0, 10);
    return new Set(this.store.checkInsOfGym(this.gym()?.id ?? '').filter((c) => c.ok && c.at.startsWith(day)).map((c) => c.clientId)).size;
  });
  protected readonly info = computed(() => {
    const r = this.result();
    if (!r?.ok) return null;
    const ms = this.store.activeMemberships(r.gymId, r.clientId);
    const pass = ms.find((m) => m.credits !== undefined);
    return { plan: this.store.plan(ms[0]?.planId)?.name, credits: pass?.credits, locker: this.store.lockerOf(r.gymId, r.clientId)?.number, firstName: this.store.user(r.clientId)?.firstName ?? '' };
  });
  private resetTimer?: ReturnType<typeof setTimeout>;
  private readonly locationId = (() => { try { return localStorage.getItem('liftly-desk-location'); } catch { return null; } })();

  constructor() {
    const clock = setInterval(() => this.now.set(new Date()), 15000);
    inject(DestroyRef).onDestroy(() => { clearInterval(clock); clearTimeout(this.resetTimer); if (document.fullscreenElement) document.exitFullscreen?.().catch(() => undefined); });
  }

  async start() {
    this.started.set(true);
    try { await document.documentElement.requestFullscreen?.(); } catch { /* not allowed: keep going */ }
    queueMicrotask(() => this.camera()?.start());
  }
  onScan(text: string) {
    const g = this.gym();
    if (!g) return;
    const id = parseMemberQr(text) ?? '';
    const loc = this.store.locationsOf(g.id).some((l) => l.id === this.locationId) ? this.locationId! : undefined;
    this.offline.checkIn(g.id, id, 'QR', undefined, loc).then((r) => {
      this.result.set(r);
      clearTimeout(this.resetTimer);
      this.resetTimer = setTimeout(() => this.result.set(null), 4500);
    });
  }

  // ---------- exit ----------
  protected readonly exiting = signal(false);
  protected password = '';
  protected readonly exitError = signal('');
  exit() {
    if (this.password !== this.auth.user()?.password) { this.exitError.set(t('Wrong password.')); return; }
    this.camera()?.stop();
    this.router.navigateByUrl(HOME_BY_ROLE[this.auth.role() ?? 'ADMIN'] + (this.auth.role() === 'ADMIN' ? '/checkin' : ''));
  }
  askExit() { this.password = ''; this.exitError.set(''); this.exiting.set(true); }
}
