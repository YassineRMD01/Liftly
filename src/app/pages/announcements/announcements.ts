import { Component, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ConfirmationService, MessageService } from 'primeng/api';
import { FaIconComponent } from '@fortawesome/angular-fontawesome';
import { ButtonDirective } from 'primeng/button';
import { InputText } from 'primeng/inputtext';
import { Tag } from 'primeng/tag';
import { Textarea } from 'primeng/textarea';
import { ToggleSwitch } from 'primeng/toggleswitch';
import { Tooltip } from 'primeng/tooltip';
import { AuthService } from '../../core/auth.service';
import { TranslatePipe, t } from '../../core/i18n/i18n';
import { Announcement } from '../../core/models';
import { StoreService } from '../../core/store.service';
import { GymLogo } from '../../shared/gym-logo/gym-logo';
import { PageHeader } from '../../shared/page-header/page-header';

/** Gym announcements: admins post to everyone at their gym; members, coaches and staff read them. */
@Component({
  selector: 'app-announcements',
  imports: [TranslatePipe, DatePipe, FormsModule, FaIconComponent, ButtonDirective, InputText, Tag, Textarea, ToggleSwitch, Tooltip, GymLogo, PageHeader],
  templateUrl: './announcements.html',
  styleUrl: './announcements.css',
})
export class Announcements {
  private readonly auth = inject(AuthService);
  protected readonly store = inject(StoreService);
  private readonly toast = inject(MessageService);
  private readonly confirm = inject(ConfirmationService);
  protected readonly isAdmin = computed(() => this.auth.role() === 'ADMIN');
  protected readonly list = computed(() => {
    if (this.isAdmin()) {
      const g = this.auth.activeGym()?.id;
      return this.store.announcementsFor(this.auth.user()?.id ?? '').filter((a) => a.gymId === g);
    }
    return this.store.announcementsFor(this.auth.user()?.id ?? '');
  });
  protected readonly form = signal({ title: '', body: '', pinned: false });

  post() {
    const f = this.form();
    const g = this.auth.activeGym();
    if (!g || !f.title.trim() || !f.body.trim()) return;
    const n = this.store.postAnnouncement({ gymId: g.id, authorId: this.auth.user()!.id, title: f.title.trim(), body: f.body.trim(), pinned: f.pinned });
    this.form.set({ title: '', body: '', pinned: false });
    this.toast.add({ severity: 'success', summary: t('Announcement posted'), detail: t('{0} people notified', { 0: n }) });
  }
  patch(p: Partial<{ title: string; body: string; pinned: boolean }>) { this.form.update((f) => ({ ...f, ...p })); }
  remove(a: Announcement) {
    this.confirm.confirm({
      header: t('Delete announcement'), message: t('Delete "{0}"?', { 0: a.title }), acceptButtonStyleClass: 'p-button-danger',
      accept: () => this.store.deleteAnnouncement(a.id),
    });
  }
}
