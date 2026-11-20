import { Component, ElementRef, OnDestroy, input, output, signal, viewChild } from '@angular/core';
import jsQR from 'jsqr';
import { t, TranslatePipe } from '../../core/i18n/i18n';

/** Camera preview that reads QR codes continuously; the same code is ignored for `cooldownMs`. */
@Component({
  selector: 'app-qr-camera',
  imports: [TranslatePipe],
  template: `
    <div class="relative rounded-3xl overflow-hidden bg-black" [class]="frameClass()">
      <video #video class="w-full h-full object-cover" autoplay playsinline muted data-testid="qr-video"></video>
      <div class="absolute inset-[15%] border-4 border-white/80 rounded-3xl pointer-events-none"></div>
      @if (!running()) { <div class="absolute inset-0 grid place-items-center text-white/80 text-sm p-4 text-center">{{ error() || ('Starting the camera…' | t) }}</div> }
    </div>`,
})
export class QrCamera implements OnDestroy {
  readonly scanned = output<string>();
  readonly cooldownMs = input(4000);
  readonly frameClass = input('aspect-video');
  private readonly video = viewChild.required<ElementRef<HTMLVideoElement>>('video');
  protected readonly running = signal(false);
  protected readonly error = signal('');
  private stream?: MediaStream;
  private timer?: ReturnType<typeof setInterval>;
  private last = { text: '', at: 0 };
  private readonly canvas = document.createElement('canvas');

  async start() {
    this.error.set('');
    if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) { this.error.set(t('The camera only works on a secure page (https:// or localhost).')); return false; }
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'user' } }, audio: false });
      const v = this.video().nativeElement;
      v.srcObject = this.stream; v.muted = true;
      await v.play();
      this.running.set(true);
      this.timer = setInterval(() => this.scan(v), 250);
      return true;
    } catch (e) {
      this.error.set((e as DOMException)?.name === 'NotAllowedError' ? t('Camera access was blocked. Allow the camera in your browser settings (icon in the address bar), then try again.') : t('Camera not available. Allow camera access or search the member by name.'));
      return false;
    }
  }
  stop() {
    clearInterval(this.timer);
    this.stream?.getTracks().forEach((tr) => tr.stop());
    this.stream = undefined;
    this.running.set(false);
  }
  private scan(v: HTMLVideoElement) {
    if (!v.videoWidth) return;
    const w = 480, h = Math.round((v.videoHeight / v.videoWidth) * 480);
    this.canvas.width = w; this.canvas.height = h;
    const ctx = this.canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return;
    ctx.drawImage(v, 0, 0, w, h);
    const code = jsQR(ctx.getImageData(0, 0, w, h).data, w, h);
    if (code?.data) this.emit(code.data);
  }
  /** Also used by tests. */
  emit(text: string) {
    if (text === this.last.text && Date.now() - this.last.at < this.cooldownMs()) return;
    this.last = { text, at: Date.now() };
    this.scanned.emit(text);
  }
  ngOnDestroy() { this.stop(); }
}
