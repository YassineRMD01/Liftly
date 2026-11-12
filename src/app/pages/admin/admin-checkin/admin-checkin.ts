import { Component, ElementRef, OnDestroy, computed, inject, signal, viewChild } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { FaIconComponent } from '@fortawesome/angular-fontawesome';
import jsQR from 'jsqr';
import { ButtonDirective } from 'primeng/button';
import { InputText } from 'primeng/inputtext';
import { Select } from 'primeng/select';
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
  imports: [TranslatePipe, DatePipe, FormsModule, FaIconComponent, ButtonDirective, InputText, Select, Tag, PageHeader],
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
  protected readonly locations = computed(() => this.store.locationsOf(this.gym()?.id ?? ''));
  /** Site of this front desk (remembered on this device). */
  protected readonly locationId = signal<string | null>((() => { try { return localStorage.getItem('liftly-desk-location'); } catch { return null; } })());
  setLocation(id: string | null) { this.locationId.set(id); try { if (id) localStorage.setItem('liftly-desk-location', id); else localStorage.removeItem('liftly-desk-location'); } catch { /* ignore */ } }

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

  /** Camera access only works on https:// or localhost. */
  protected readonly secure = typeof window !== 'undefined' && window.isSecureContext && !!navigator.mediaDevices?.getUserMedia;

  async startCamera() {
    this.cameraError.set('');
    if (!this.secure) {
      this.cameraError.set(t('The camera only works on a secure page (https:// or localhost). Use "Scan a photo" or search the member by name.'));
      return;
    }
    try {
      try {
        this.stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } }, audio: false });
      } catch (e) {
        // some laptops reject the facing-mode hint: retry with any camera
        if ((e as DOMException).name !== 'OverconstrainedError') throw e;
        this.stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
      }
      // the <video> is always in the page (hidden until scanning), so it can be attached right away
      const v = this.video()?.nativeElement;
      if (!v) throw new Error('no video element');
      v.srcObject = this.stream;
      v.setAttribute('playsinline', 'true');
      v.muted = true;
      await v.play();
      this.scanning.set(true);
      clearInterval(this.timer);
      this.timer = setInterval(() => this.scanFrame(v), 250);
    } catch (e) {
      this.stopCamera();
      const name = (e as DOMException)?.name;
      this.cameraError.set(
        name === 'NotAllowedError' ? t('Camera access was blocked. Allow the camera in your browser settings (icon in the address bar), then try again.')
          : name === 'NotFoundError' ? t('No camera found on this device. Use "Scan a photo" or search the member by name.')
            : name === 'NotReadableError' ? t('The camera is used by another app. Close it and try again.')
              : t('Camera not available. Allow camera access or search the member by name.'),
      );
    }
  }

  stopCamera() {
    clearInterval(this.timer);
    this.stream?.getTracks().forEach((tr) => tr.stop());
    this.stream = undefined;
    const v = this.video()?.nativeElement;
    if (v) v.srcObject = null;
    this.scanning.set(false);
  }

  /** Fallback without live camera: decode a photo of the QR card (phones open the camera for it). */
  async scanPhoto(ev: Event) {
    const input = ev.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    this.cameraError.set('');
    try {
      const bmp = await createImageBitmap(file);
      const scale = Math.min(1, 1200 / Math.max(bmp.width, bmp.height));
      const w = Math.round(bmp.width * scale), h = Math.round(bmp.height * scale);
      this.canvas.width = w; this.canvas.height = h;
      const ctx = this.canvas.getContext('2d', { willReadFrequently: true })!;
      ctx.drawImage(bmp, 0, 0, w, h);
      const code = jsQR(ctx.getImageData(0, 0, w, h).data, w, h);
      if (code?.data) { this.lastScan = { text: '', at: 0 }; this.onScan(code.data); }
      else this.cameraError.set(t('No QR code found in the photo. Try again closer and without glare.'));
    } catch {
      this.cameraError.set(t('No QR code found in the photo. Try again closer and without glare.'));
    }
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
    const loc = this.locations().some((l) => l.id === this.locationId()) ? this.locationId()! : undefined;
    this.result.set(this.store.checkIn(g.id, clientId, method, this.auth.user()?.id, loc));
  }

  ngOnDestroy() { this.stopCamera(); }
}
