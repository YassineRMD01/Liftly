import { Component, computed, effect, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import QRCode from 'qrcode';
import { Tag } from 'primeng/tag';
import { MessageService } from 'primeng/api';
import { FaIconComponent } from '@fortawesome/angular-fontawesome';
import { ButtonDirective } from 'primeng/button';
import { AuthService } from '../../../core/auth.service';
import { TranslatePipe, t } from '../../../core/i18n/i18n';
import { memberQrPayload } from '../../../core/qr';
import { StoreService } from '../../../core/store.service';
import { GymLogo } from '../../../shared/gym-logo/gym-logo';
import { PageHeader } from '../../../shared/page-header/page-header';

/** The member's check-in QR code, with their status at each gym and recent visits. */
@Component({
  selector: 'app-client-card',
  imports: [TranslatePipe, DatePipe, FaIconComponent, ButtonDirective, Tag, GymLogo, PageHeader],
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
  private readonly toast = inject(MessageService);
  protected readonly code = computed(() => this.store.refCode(this.user()?.id ?? ''));
  protected readonly referrals = computed(() => this.store.referralsOf(this.user()?.id ?? ''));
  link(gymId: string) { return this.store.publicGymLink(gymId, this.code()); }
  async share(gymId: string, gymName: string) {
    const url = this.link(gymId);
    const text = t('Join me at {gym} with my code {code}!', { gym: gymName, code: this.code() });
    try {
      if (navigator.share) await navigator.share({ title: gymName, text, url });
      else { await navigator.clipboard.writeText(`${text} ${url}`); this.toast.add({ severity: 'success', summary: t('Link copied'), life: 1500 }); }
    } catch { /* cancelled */ }
  }
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
