import { Component, computed, inject, signal, viewChild } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { MessageService } from 'primeng/api';
import { FaIconComponent } from '@fortawesome/angular-fontawesome';
import { Button } from 'primeng/button';
import { SelectButton } from 'primeng/selectbutton';
import { Tag } from 'primeng/tag';
import { Tooltip } from 'primeng/tooltip';
import { AuthService } from '../../../core/auth.service';
import { downloadCsv } from '../../../core/csv';
import { TranslatePipe, t } from '../../../core/i18n/i18n';
import { JoinRequest, JoinRequestStatus } from '../../../core/models';
import { StoreService } from '../../../core/store.service';
import { InviteDialog } from '../../../shared/invite-dialog/invite-dialog';
import { PageHeader } from '../../../shared/page-header/page-header';

export const REQUEST_SEV: Record<JoinRequestStatus, 'info' | 'warn' | 'success' | 'secondary'> = { NEW: 'info', CONTACTED: 'warn', CONVERTED: 'success', DECLINED: 'secondary' };

/** Join requests sent from the gym's public page; converting one creates the member account. */
@Component({
  selector: 'app-admin-requests',
  imports: [TranslatePipe, DatePipe, FormsModule, RouterLink, FaIconComponent, Button, SelectButton, Tag, Tooltip, InviteDialog, PageHeader],
  templateUrl: './admin-requests.html',
  styleUrl: './admin-requests.css',
})
export class AdminRequests {
  private readonly auth = inject(AuthService);
  protected readonly store = inject(StoreService);
  private readonly toast = inject(MessageService);
  protected readonly invite = viewChild.required(InviteDialog);
  protected readonly sev = REQUEST_SEV;
  protected readonly gym = this.auth.activeGym;
  protected readonly filter = signal<'OPEN' | 'ALL'>('OPEN');
  protected readonly filters = [{ label: t('To handle'), value: 'OPEN' }, { label: t('All'), value: 'ALL' }];
  protected readonly list = computed(() => this.store.joinRequestsOf(this.gym()?.id ?? '').filter((r) => this.filter() === 'ALL' || r.status === 'NEW' || r.status === 'CONTACTED'));
  protected readonly link = computed(() => (this.gym() ? this.store.publicGymLink(this.gym()!.id) : ''));

  set(r: JoinRequest, s: JoinRequestStatus) { this.store.setJoinRequestStatus(r.id, s); }
  convert(r: JoinRequest) {
    const u = this.store.convertJoinRequest(r.id);
    if (!u) { this.toast.add({ severity: 'error', summary: t('This email belongs to another kind of account.') }); return; }
    this.toast.add({ severity: 'success', summary: t('Member account ready'), detail: t('Now add their membership in Clients.') });
    if (u.invite) this.invite().open(u);
  }
  referrer(r: JoinRequest) { return this.store.userByRefCode(r.ref); }
  export() {
    downloadCsv(`join-requests-${this.gym()?.name ?? ''}`, ['Date', 'First name', 'Last name', 'Email', 'Phone', 'Plan', 'Referral', 'Status', 'Message'],
      this.store.joinRequestsOf(this.gym()?.id ?? '').map((r) => [r.createdAt.slice(0, 10), r.firstName, r.lastName, r.email, r.phone, this.store.plan(r.planId)?.name, r.ref, r.status, r.message]));
  }
}
