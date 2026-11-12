import { Component, computed, effect, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import QRCode from 'qrcode';
import { Tag } from 'primeng/tag';
import { AuthService } from '../../../core/auth.service';
import { TranslatePipe } from '../../../core/i18n/i18n';
import { memberQrPayload } from '../../../core/qr';
import { StoreService } from '../../../core/store.service';
import { GymLogo } from '../../../shared/gym-logo/gym-logo';
import { PageHeader } from '../../../shared/page-header/page-header';

/** The member's check-in QR code, with their status at each gym and recent visits. */
@Component({
  selector: 'app-client-card',
  imports: [TranslatePipe, DatePipe, Tag, GymLogo, PageHeader],
  templateUrl: './client-card.html',
  styleUrl: './client-card.css',
})
export class ClientCard {
  private readonly auth = inject(AuthService);
  protected readonly store = inject(StoreService);
  protected readonly user = this.auth.user;
  protected readonly qr = signal('');
  protected readonly gyms = computed(() => {
    const id = this.user()?.id ?? '';
    return this.store.gymsOfClient(id).map((g) => ({ g, status: this.store.clientStatus(g.id, id) }));
  });
  protected readonly visits = computed(() => this.store.checkInsOfClient(this.user()?.id ?? '').slice(0, 8));

  constructor() {
    effect(() => {
      const id = this.user()?.id;
      if (!id) return;
      QRCode.toDataURL(memberQrPayload(id), { width: 320, margin: 1, errorCorrectionLevel: 'M' }).then((url) => this.qr.set(url));
    });
  }

  sev(s: string) { return ({ ACTIVE: 'success', FROZEN: 'info', EXPIRED: 'secondary', BANNED: 'danger' } as Record<string, 'success' | 'info' | 'secondary' | 'danger'>)[s]; }
}
