import { Component, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ConfirmationService, MessageService } from 'primeng/api';
import { FaIconComponent } from '@fortawesome/angular-fontawesome';
import { ButtonDirective, ButtonLabel } from 'primeng/button';
import { Dialog } from 'primeng/dialog';
import { SelectButton } from 'primeng/selectbutton';
import { Tag } from 'primeng/tag';
import { Textarea } from 'primeng/textarea';
import { AuthService } from '../../core/auth.service';
import { TranslatePipe, t } from '../../core/i18n/i18n';
import { CoachReport, ReportCategory, ReportStatus } from '../../core/models';
import { StoreService } from '../../core/store.service';
import { PageHeader } from '../../shared/page-header/page-header';

export const REPORT_CATEGORY: Record<ReportCategory, string> = {
  HARASSMENT: t('Harassment'),
  INAPPROPRIATE_LANGUAGE: t('Inappropriate language'),
  UNSAFE_TRAINING: t('Unsafe training'),
  DISCRIMINATION: t('Discrimination'),
  UNPROFESSIONAL: t('Unprofessional behavior'),
  OTHER: t('Other'),
};
export const reportSeverity = (s: ReportStatus) => ({ OPEN: 'danger', RESOLVED: 'success', DISMISSED: 'secondary' } as const)[s];

/**
 * Coach reports sent by clients. Gym admins see their gym's reports;
 * the super-admin sees every gym's.
 */
@Component({
  selector: 'app-reports',
  imports: [TranslatePipe, DatePipe, FormsModule, FaIconComponent, ButtonDirective, ButtonLabel, Dialog, SelectButton, Tag, Textarea, PageHeader],
  templateUrl: './reports.html',
  styleUrl: './reports.css',
})
export class Reports {
  private readonly auth = inject(AuthService);
  protected readonly store = inject(StoreService);
  private readonly toast = inject(MessageService);
  private readonly confirm = inject(ConfirmationService);

  protected readonly superAdmin = computed(() => this.auth.role() === 'SUPER_ADMIN');
  protected readonly category = REPORT_CATEGORY;
  protected readonly sev = reportSeverity;
  protected readonly filter = signal<ReportStatus | 'ALL'>('OPEN');
  protected readonly filters = [
    { label: t('Open'), value: 'OPEN' }, { label: t('Resolved'), value: 'RESOLVED' }, { label: t('Dismissed'), value: 'DISMISSED' }, { label: t('All'), value: 'ALL' },
  ];

  private readonly scoped = computed(() =>
    this.superAdmin() ? [...this.store.reports()].sort((a, b) => b.createdAt.localeCompare(a.createdAt)) : this.store.reportsOfGym(this.auth.activeGym()?.id ?? ''));
  protected readonly reports = computed(() => this.scoped().filter((r) => this.filter() === 'ALL' || r.status === this.filter()));
  protected readonly openCount = computed(() => this.scoped().filter((r) => r.status === 'OPEN').length);

  // handle dialog
  protected readonly handling = signal<{ report: CoachReport; status: 'RESOLVED' | 'DISMISSED' } | null>(null);
  protected note = '';

  reportsAgainst(coachId: string) { return this.store.reports().filter((r) => r.coachId === coachId).length; }
  coachWorksAt(r: CoachReport) { return this.store.gymCoaches().some((l) => l.gymId === r.gymId && l.coachId === r.coachId); }

  handle(report: CoachReport, status: 'RESOLVED' | 'DISMISSED') {
    this.note = '';
    this.handling.set({ report, status });
  }

  onDialog(visible: boolean) { if (!visible) this.handling.set(null); }

  confirmHandle() {
    const h = this.handling();
    if (!h) return;
    this.store.updateReport({ ...h.report, status: h.status, resolutionNote: this.note.trim() || undefined, handledAt: new Date().toISOString() });
    this.toast.add({ severity: 'success', summary: h.status === 'RESOLVED' ? t('Report resolved') : t('Report dismissed') });
    this.handling.set(null);
  }

  reopen(r: CoachReport) {
    this.store.updateReport({ ...r, status: 'OPEN', resolutionNote: undefined, handledAt: undefined });
    this.toast.add({ severity: 'info', summary: t('Report reopened') });
  }

  removeCoach(r: CoachReport) {
    this.confirm.confirm({
      header: t('Remove coach'),
      message: t('Remove {0} from {1}? Their account and other gyms are not affected.', { 0: this.store.fullName(r.coachId), 1: this.store.gym(r.gymId)?.name ?? '' }),
      acceptButtonStyleClass: 'p-button-danger',
      accept: () => {
        this.store.unlinkCoach(r.gymId, r.coachId);
        this.store.updateReport({ ...r, status: 'RESOLVED', resolutionNote: t('Coach removed from the gym.'), handledAt: new Date().toISOString() });
        this.toast.add({ severity: 'success', summary: t('Coach removed') });
      },
    });
  }
}
