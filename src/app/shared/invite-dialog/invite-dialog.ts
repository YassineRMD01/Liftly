import { Component, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { MessageService } from 'primeng/api';
import { FaIconComponent } from '@fortawesome/angular-fontawesome';
import QRCode from 'qrcode';
import { ButtonDirective } from 'primeng/button';
import { Dialog } from 'primeng/dialog';
import { InputText } from 'primeng/inputtext';
import { TranslatePipe, t } from '../../core/i18n/i18n';
import { User } from '../../core/models';
import { StoreService } from '../../core/store.service';

/** Shows the activation link of a new account (copy, QR, e-mail draft). Sending it needs a backend. */
@Component({
  selector: 'app-invite-dialog',
  imports: [TranslatePipe, DatePipe, FaIconComponent, ButtonDirective, Dialog, InputText],
  templateUrl: './invite-dialog.html',
  styleUrl: './invite-dialog.css',
})
export class InviteDialog {
  private readonly store = inject(StoreService);
  private readonly toast = inject(MessageService);
  protected readonly user = signal<User | null>(null);
  protected readonly link = signal('');
  protected readonly qr = signal('');

  open(u: User) {
    const user = u.invite && u.invite.expiresAt > new Date().toISOString() ? u : this.store.reinvite(u.id);
    const link = this.store.inviteLink(user);
    this.user.set(user);
    this.link.set(link);
    QRCode.toDataURL(link, { margin: 1, width: 200 }).then((q) => this.qr.set(q));
  }
  close(v: boolean) { if (!v) this.user.set(null); }

  async copy() {
    try { await navigator.clipboard.writeText(this.link()); this.toast.add({ severity: 'success', summary: t('Link copied'), life: 1500 }); }
    catch { this.toast.add({ severity: 'warn', summary: t('Copy the link by hand.') }); }
  }
  mailto() {
    const u = this.user()!;
    const subject = encodeURIComponent(t('Your Liftly account'));
    const body = encodeURIComponent(t('Hello {name}, activate your account and choose a password here: {link}', { name: u.firstName, link: this.link() }));
    return `mailto:${u.email}?subject=${subject}&body=${body}`;
  }
}
