import { Component, ElementRef, afterNextRender, output, signal, viewChild } from '@angular/core';
import { FaIconComponent } from '@fortawesome/angular-fontawesome';
import { ButtonDirective } from 'primeng/button';
import { TranslatePipe } from '../../core/i18n/i18n';

/** Draw a signature with mouse, pen or finger. Emits a PNG data URL (or '' when cleared). */
@Component({
  selector: 'app-signature-pad',
  imports: [FaIconComponent, ButtonDirective, TranslatePipe],
  template: `
    <div class="relative rounded-xl border-2 border-dashed border-surface-300 dark:border-surface-600 bg-white touch-none">
      <canvas #canvas class="w-full h-36 block cursor-crosshair" (pointerdown)="down($event)" (pointermove)="move($event)" (pointerup)="up()" (pointerleave)="up()"
        role="img" [attr.aria-label]="'Signature area' | t" data-testid="signature-canvas"></canvas>
      @if (empty()) { <span class="absolute inset-0 grid place-items-center text-sm text-surface-400 pointer-events-none">{{ 'Sign here' | t }}</span> }
      <button pButton type="button" iconOnly [text]="true" [rounded]="true" size="small" severity="secondary" class="!absolute top-1 end-1" (click)="clear()" [attr.aria-label]="'Clear' | t"><fa-icon icon="eraser" /></button>
    </div>`,
})
export class SignaturePad {
  readonly signed = output<string>();
  private readonly canvas = viewChild.required<ElementRef<HTMLCanvasElement>>('canvas');
  protected readonly empty = signal(true);
  private drawing = false;
  private ctx?: CanvasRenderingContext2D;

  constructor() {
    afterNextRender(() => {
      const c = this.canvas().nativeElement;
      const ratio = window.devicePixelRatio || 1;
      c.width = c.offsetWidth * ratio; c.height = c.offsetHeight * ratio;
      this.ctx = c.getContext('2d')!;
      this.ctx.scale(ratio, ratio);
      this.ctx.lineWidth = 2.5; this.ctx.lineCap = 'round'; this.ctx.lineJoin = 'round'; this.ctx.strokeStyle = '#1e293b';
    });
  }
  private point(e: PointerEvent) { const r = this.canvas().nativeElement.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; }
  down(e: PointerEvent) {
    if (!this.ctx) return;
    this.drawing = true;
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    const p = this.point(e); this.ctx.beginPath(); this.ctx.moveTo(p.x, p.y);
  }
  move(e: PointerEvent) {
    if (!this.drawing || !this.ctx) return;
    const p = this.point(e); this.ctx.lineTo(p.x, p.y); this.ctx.stroke();
    this.empty.set(false);
  }
  up() {
    if (!this.drawing) return;
    this.drawing = false;
    if (!this.empty()) this.signed.emit(this.canvas().nativeElement.toDataURL('image/png'));
  }
  clear() {
    const c = this.canvas().nativeElement;
    this.ctx?.clearRect(0, 0, c.width, c.height);
    this.empty.set(true);
    this.signed.emit('');
  }
}
