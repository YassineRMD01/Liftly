import { UndoService } from '../../../core/undo.service';
import { Component, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ConfirmationService, MessageService } from 'primeng/api';
import { FaIconComponent } from '@fortawesome/angular-fontawesome';
import { ButtonDirective } from 'primeng/button';
import { InputText } from 'primeng/inputtext';
import { SelectButton } from 'primeng/selectbutton';
import { Tag } from 'primeng/tag';
import { Textarea } from 'primeng/textarea';
import { TranslatePipe, t } from '../../../core/i18n/i18n';
import { AnnouncementAudience, AnnouncementLevel, PlatformAnnouncement } from '../../../core/models';
import { StoreService } from '../../../core/store.service';
import { PageHeader } from '../../../shared/page-header/page-header';

export const LEVEL_SEV: Record<AnnouncementLevel, 'info' | 'success' | 'warn'> = { INFO: 'info', FEATURE: 'success', MAINTENANCE: 'warn' };
export const LEVEL_ICON: Record<AnnouncementLevel, string> = { INFO: 'circle-info', FEATURE: 'wand-magic-sparkles', MAINTENANCE: 'screwdriver-wrench' };

/** Messages from the Liftly team to every gym: banner in the app + notification. */
@Component({
  selector: 'app-sa-announcements',
  imports: [TranslatePipe, DatePipe, FormsModule, FaIconComponent, ButtonDirective, InputText, SelectButton, Tag, Textarea, PageHeader],
  templateUrl: './sa-announcements.html',
  styleUrl: './sa-announcements.css',
})
export class SaAnnouncements {
  private readonly undo = inject(UndoService);
  protected readonly store = inject(StoreService);
  private readonly toast = inject(MessageService);
  private readonly confirm = inject(ConfirmationService);
  protected readonly sev = LEVEL_SEV;
  protected readonly levels = [{ label: t('Info'), value: 'INFO' }, { label: t('New feature'), value: 'FEATURE' }, { label: t('Maintenance'), value: 'MAINTENANCE' }];
  protected readonly audiences = [{ label: t('Gym admins'), value: 'ADMINS' }, { label: t('Admins, staff & coaches'), value: 'STAFF' }, { label: t('Everyone'), value: 'EVERYONE' }];
  protected readonly list = computed(() => [...this.store.platformAnnouncements()].sort((a, b) => b.at.localeCompare(a.at)));
  protected readonly form = signal<{ title: string; body: string; level: AnnouncementLevel; audience: AnnouncementAudience; until: string }>({ title: '', body: '', level: 'INFO', audience: 'ADMINS', until: '' });
  patch(p: Partial<ReturnType<typeof this.form>>) { this.form.update((f) => ({ ...f, ...p })); }
  post() {
    const f = this.form();
    if (!f.title.trim() || !f.body.trim()) return;
    const n = this.store.postPlatformAnnouncement({ title: f.title.trim(), body: f.body.trim(), level: f.level, audience: f.audience, ...(f.until ? { until: f.until } : {}) });
    this.toast.add({ severity: 'success', summary: t('Announcement sent'), detail: t('{0} people notified', { 0: n }) });
    this.form.set({ title: '', body: '', level: 'INFO', audience: 'ADMINS', until: '' });
  }
  remove(a: PlatformAnnouncement) { this.undo.run(t('Announcement deleted'), ['platformAnnouncements'], () => this.store.deletePlatformAnnouncement(a.id), a.title); }
  audienceLabel(a: AnnouncementAudience) { return this.audiences.find((x) => x.value === a)?.label ?? a; }
}
