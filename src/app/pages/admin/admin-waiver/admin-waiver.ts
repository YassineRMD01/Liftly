import { Component, computed, effect, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ConfirmationService, MessageService } from 'primeng/api';
import { FaIconComponent } from '@fortawesome/angular-fontawesome';
import { ButtonDirective } from 'primeng/button';
import { InputText } from 'primeng/inputtext';
import { SelectButton } from 'primeng/selectbutton';
import { Tag } from 'primeng/tag';
import { Textarea } from 'primeng/textarea';
import { AuthService } from '../../../core/auth.service';
import { TranslatePipe, t } from '../../../core/i18n/i18n';
import { WaiverSignature } from '../../../core/models';
import { StoreService } from '../../../core/store.service';
import { Modal } from '../../../shared/modal/modal';
import { PageHeader } from '../../../shared/page-header/page-header';

/** The gym's liability waiver: edit the text (a new version asks everyone again) and see who signed. */
@Component({
  selector: 'app-admin-waiver',
  imports: [TranslatePipe, DatePipe, FormsModule, FaIconComponent, ButtonDirective, InputText, SelectButton, Tag, Textarea, Modal, PageHeader],
  templateUrl: './admin-waiver.html',
  styleUrl: './admin-waiver.css',
})
export class AdminWaiver {
  private readonly auth = inject(AuthService);
  protected readonly store = inject(StoreService);
  private readonly toast = inject(MessageService);
  private readonly confirm = inject(ConfirmationService);
  protected readonly gym = this.auth.activeGym;
  protected readonly title = signal('');
  protected readonly text = signal('');
  protected readonly filter = signal<'ALL' | 'MISSING'>('MISSING');
  protected readonly filters = [{ label: t('Not signed'), value: 'MISSING' }, { label: t('All'), value: 'ALL' }];
  protected readonly viewing = signal<WaiverSignature | null>(null);
  protected readonly members = computed(() => {
    const g = this.gym();
    if (!g) return [];
    return this.store.clientsOfGym(g.id).filter((c) => this.store.clientStatus(g.id, c.id) !== 'EXPIRED' || this.filter() === 'ALL')
      .map((c) => ({ user: c, sig: this.store.waiverSignature(g.id, c.id) })).filter((x) => this.filter() === 'ALL' || !x.sig)
      .sort((a, b) => Number(!!a.sig) - Number(!!b.sig) || a.user.firstName.localeCompare(b.user.firstName));
  });
  protected readonly signedCount = computed(() => { const g = this.gym(); return g ? this.store.clientsOfGym(g.id).filter((c) => this.store.waiverSignature(g.id, c.id)).length : 0; });
  protected readonly total = computed(() => this.store.clientsOfGym(this.gym()?.id ?? '').length);
  protected readonly dirty = computed(() => { const w = this.gym()?.waiver; return (w?.title ?? '') !== this.title() || (w?.text ?? '') !== this.text(); });

  constructor() {
    effect(() => { const w = this.gym()?.waiver; this.title.set(w?.title ?? t('Liability waiver')); this.text.set(w?.text ?? ''); });
  }
  save() {
    if (!this.title().trim() || this.text().trim().length < 20) { this.toast.add({ severity: 'error', summary: t('Write a title and the waiver text.') }); return; }
    const had = !!this.gym()?.waiver;
    this.store.saveWaiver(this.gym()!.id, this.title().trim(), this.text().trim());
    this.toast.add({ severity: 'success', summary: had ? t('New waiver version published') : t('Waiver published'), detail: t('Members are asked to sign it.') });
  }
  remove() {
    this.confirm.confirm({ header: t('Remove waiver'), message: t('Members will no longer be asked to sign a waiver.'), acceptButtonStyleClass: 'p-button-danger', accept: () => this.store.removeWaiver(this.gym()!.id) });
  }
}
