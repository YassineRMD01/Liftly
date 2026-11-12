import { Component, computed, inject, viewChild } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ConfirmationService, MessageService } from 'primeng/api';
import { FaIconComponent } from '@fortawesome/angular-fontawesome';
import { ButtonDirective, ButtonIcon, ButtonLabel } from 'primeng/button';
import { Dialog } from 'primeng/dialog';
import { InputText } from 'primeng/inputtext';
import { Tooltip } from 'primeng/tooltip';
import { AuthService } from '../../../core/auth.service';
import { TranslatePipe, t } from '../../../core/i18n/i18n';
import { User } from '../../../core/models';
import { StoreService } from '../../../core/store.service';
import { PageHeader } from '../../../shared/page-header/page-header';
import { InviteDialog } from '../../../shared/invite-dialog/invite-dialog';

/** Front-desk staff (receptionists): check members in and manage class rosters, no billing or settings. */
@Component({
  selector: 'app-admin-staff',
  imports: [TranslatePipe, DatePipe, FormsModule, FaIconComponent, ButtonDirective, ButtonIcon, ButtonLabel, Dialog, InputText, Tooltip, PageHeader, InviteDialog],
  templateUrl: './admin-staff.html',
  styleUrl: './admin-staff.css',
})
export class AdminStaff {
  private readonly auth = inject(AuthService);
  protected readonly store = inject(StoreService);
  private readonly toast = inject(MessageService);
  private readonly confirm = inject(ConfirmationService);
  private readonly gymId = computed(() => this.auth.activeGym()?.id ?? '');
  protected readonly staff = computed(() => this.store.staffOfGym(this.gymId()));
  protected addVisible = false;
  protected readonly inviteDialog = viewChild.required(InviteDialog);
  protected form = { firstName: '', lastName: '', email: '' };

  since(u: User) { return this.store.staff().find((s) => s.gymId === this.gymId() && s.userId === u.id)?.since; }

  openAdd() { this.form = { firstName: '', lastName: '', email: '' }; this.addVisible = true; }

  add() {
    const { firstName, lastName, email } = this.form;
    if (!firstName.trim() || !lastName.trim() || !email.trim()) return;
    const existing = this.store.users().find((u) => u.email.toLowerCase() === email.trim().toLowerCase());
    if (existing && existing.role !== 'STAFF') {
      this.toast.add({ severity: 'error', summary: t('Email already registered'), detail: t('This email belongs to another kind of account.') });
      return;
    }
    const u = existing ?? this.store.addUser({ role: 'STAFF', firstName: firstName.trim(), lastName: lastName.trim(), email: email.trim() });
    this.store.linkStaff(this.gymId(), u.id);
    this.addVisible = false;
    this.toast.add({ severity: 'success', summary: t('Staff member added') });
    if (!existing) this.inviteDialog().open(u);
  }

  remove(u: User) {
    this.confirm.confirm({
      header: t('Remove staff member'), message: t('Remove {0} {1} from your gym?', { 0: u.firstName, 1: u.lastName }), acceptButtonStyleClass: 'p-button-danger',
      accept: () => { this.store.unlinkStaff(this.gymId(), u.id); this.toast.add({ severity: 'success', summary: t('Staff member removed') }); },
    });
  }
}
