import { UndoService } from '../../../core/undo.service';
import { Component, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ConfirmationService, MessageService } from 'primeng/api';
import { FaIconComponent } from '@fortawesome/angular-fontawesome';
import { ButtonDirective } from 'primeng/button';
import { InputNumber } from 'primeng/inputnumber';
import { InputText } from 'primeng/inputtext';
import { ProgressBar } from 'primeng/progressbar';
import { SelectButton } from 'primeng/selectbutton';
import { Tag } from 'primeng/tag';
import { Tooltip } from 'primeng/tooltip';
import { AuthService } from '../../../core/auth.service';
import { TranslatePipe, t } from '../../../core/i18n/i18n';
import { ChallengeMetric, GymChallenge } from '../../../core/models';
import { isoDate } from '../../../core/schedule';
import { StoreService } from '../../../core/store.service';
import { Modal } from '../../../shared/modal/modal';
import { PageHeader } from '../../../shared/page-header/page-header';
import { METRIC_LABEL } from '../../client/client-achievements/client-achievements';

/** Gym challenges with leaderboards (members are notified of new ones). */
@Component({
  selector: 'app-admin-challenges',
  imports: [TranslatePipe, DatePipe, FormsModule, FaIconComponent, ButtonDirective, InputNumber, InputText, ProgressBar, SelectButton, Tag, Tooltip, Modal, PageHeader],
  templateUrl: './admin-challenges.html',
  styleUrl: './admin-challenges.css',
})
export class AdminChallenges {
  private readonly undo = inject(UndoService);
  private readonly auth = inject(AuthService);
  protected readonly store = inject(StoreService);
  private readonly toast = inject(MessageService);
  private readonly confirm = inject(ConfirmationService);
  protected readonly gym = this.auth.activeGym;
  protected readonly metric = METRIC_LABEL;
  protected readonly metrics = (Object.keys(METRIC_LABEL) as ChallengeMetric[]).map((value) => ({ value, label: t(METRIC_LABEL[value]) }));
  protected readonly list = computed(() => this.store.challengesOfGym(this.gym()?.id ?? '').map((c) => ({ c, board: this.store.leaderboard(c), status: c.end < isoDate() ? 'ENDED' : c.start > isoDate() ? 'UPCOMING' : 'RUNNING' })));
  protected readonly editing = signal<GymChallenge | null>(null);

  edit(c?: GymChallenge) {
    const now = new Date();
    const end = isoDate(new Date(now.getFullYear(), now.getMonth() + 1, 0));
    this.editing.set(c ? { ...c } : { id: '', gymId: this.gym()!.id, title: '', metric: 'VISITS', target: 10, start: isoDate(), end, reward: '' });
  }
  close(v: boolean) { if (!v) this.editing.set(null); }
  save() {
    const c = this.editing();
    if (!c || !c.title.trim() || !(c.target > 0) || c.end < c.start) { this.toast.add({ severity: 'error', summary: t('Give a title, a target and valid dates.') }); return; }
    this.store.saveChallenge({ ...c, title: c.title.trim(), reward: c.reward?.trim() || undefined });
    this.toast.add({ severity: 'success', summary: t('Challenge saved'), detail: c.id ? undefined : t('Members were notified.') });
    this.editing.set(null);
  }
  remove(c: GymChallenge) {
    this.undo.run(t('Challenge deleted'), ['challenges'], () => this.store.deleteChallenge(c.id), c.title);
  }
  sev(s: string) { return ({ RUNNING: 'success', UPCOMING: 'info', ENDED: 'secondary' } as Record<string, 'success' | 'info' | 'secondary'>)[s]; }
  finishers(x: { c: GymChallenge; board: { value: number }[] }) { return x.board.filter((b) => b.value >= x.c.target).length; }
}
