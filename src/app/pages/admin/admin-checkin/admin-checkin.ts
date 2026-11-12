import { Component, ElementRef, OnDestroy, computed, inject, signal, viewChild } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { FaIconComponent } from '@fortawesome/angular-fontawesome';
import jsQR from 'jsqr';
import { Button } from 'primeng/button';
import { InputText } from 'primeng/inputtext';
import { Tag } from 'primeng/tag';
import { AuthService } from '../../../core/auth.service';
import { TranslatePipe, t } from '../../../core/i18n/i18n';
import { CheckIn } from '../../../core/models';
import { parseMemberQr } from '../../../core/qr';
import { StoreService } from '../../../core/store.service';
import { PageHeader } from '../../../shared/page-header/page-header';

/** Front-desk check-in: scan a member's QR card with the camera, or search by name. */
@Component({
  selector: 'app-admin-checkin',
  imports: [TranslatePipe, DatePipe, FormsModule, FaIconComponent, Button, InputText, Tag, PageHeader],
  templateUrl: './admin-checkin.html',
  styleUrl: './admin-checkin.css',
})
export class AdminCheckin implements OnDestroy {
  private readonly auth = inject(AuthService);
  protected readonly store = inject(StoreService);
  private readonly video = viewChild<ElementRef<HTMLVideoElement>>('video');
  private stream?: MediaStream;
  private timer?: ReturnType<typeof setInterval>;
  private lastScan = { text: '', at: 0 };

  protected readonly gym = this.auth.activeGym;
  protected readonly scanning = signal(false);
  protected readonly cameraError = signal('');
  protected readonly q = signal('');
  protected readonly result = signal<CheckIn | null>(null);

  protected readonly matches = computed(() => {
    const q = this.q().trim().toLowerCase();
    if (q.length < 2) return [];
    return this.store.clientsOfGym(this.gym()?.id ?? '')
      .filter((c) => `${c.firstName} ${c.lastName} ${c.email} ${c.phone ?? ''}`.toLowerCase().includes(q)).slice(0, 6);
  });
  protected readonly today = computed(() => {
    const day = new Date().toISOString().slice(0, 10);
    return this.store.checkInsOfGym(this.gym()?.id ?? '').filter((c) => c.at.slice(0, 10) === day);
  });
  protected readonly todayOk = computed(() => new Set(this.today().filter((c) => c.ok).map((c) => c.clientId)).size);
  protected readonly activeMembership = computed(() => {
    const r = this.result();
    if (!r?.ok) return undefined;
    const now = new Date().toISOString();
    return this.store.memberships().filter((m) => m.gymId === r.gymId && m.clientId === r.clientId && m.status === 'ACTIVE' && m.endDate >= now)
      .sort((a, b) => b.endDate.localeCompare(a.endDate))[0];
  });
  protected readonly todayClasses = computed(() => {
    const r = this.result();
    if (!r) return [];
    const day = new Date().toISOString().slice(0, 10);
    return this.store.bookingsOfClient(r.clientId).filter((b) => b.gymId === r.gymId && b.date === day && b.status !== 'CANCELLED' && b.status !== 'WAITLIST')
      .map((b) => this.store.gymClass(b.classId)).filter((c) => !!c);
  });

  async startCamera() {
    this.cameraError.set('');
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      this.scanning.set(true);
      queueMicrotask(() => {
        const v = this.video()?.nativeElement;
        if (!v || !this.stream) return;
        v.srcObject = this.stream;
        v.play().catch(() => undefined);
        this.timer = setInterval(() => this.scanFrame(v), 300);
      });
    } catch {
      this.cameraError.set(t('Camera not available. Allow camera access or search the member by name.'));
    }
  }

  stopCamera() {
    clearInterval(this.timer);
    this.stream?.getTracks().forEach((tr) => tr.stop());
    this.stream = undefined;
    this.scanning.set(false);
  }

  private canvas = document.createElement('canvas');
  private scanFrame(v: HTMLVideoElement) {
    if (!v.videoWidth) return;
    const w = 480, h = Math.round((v.videoHeight / v.videoWidth) * 480);
    this.canvas.width = w; this.canvas.height = h;
    const ctx = this.canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return;
    ctx.drawImage(v, 0, 0, w, h);
    const code = jsQR(ctx.getImageData(0, 0, w, h).data, w, h);
    if (code?.data) this.onScan(code.data);
  }

  /** A QR code was read (camera or test hook). The same code is ignored for 5 s. */
  onScan(text: string) {
    if (text === this.lastScan.text && Date.now() - this.lastScan.at < 5000) return;
    this.lastScan = { text, at: Date.now() };
    const id = parseMemberQr(text);
    this.doCheckIn(id ?? '', 'QR');
  }

  manual(clientId: string) { this.q.set(''); this.doCheckIn(clientId, 'MANUAL'); }

  private doCheckIn(clientId: string, method: CheckIn['method']) {
    const g = this.gym();
    if (!g) return;
    this.result.set(this.store.checkIn(g.id, clientId, method, this.auth.user()?.id));
  }

  ngOnDestroy() { this.stopCamera(); }
}
