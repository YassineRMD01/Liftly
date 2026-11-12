import { Component, computed, inject, input, signal } from '@angular/core';
import { DatePipe, DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ConfirmationService, MessageService } from 'primeng/api';
import { FaIconComponent } from '@fortawesome/angular-fontawesome';
import { Button } from 'primeng/button';
import { InputNumber } from 'primeng/inputnumber';
import { InputText } from 'primeng/inputtext';
import { SelectButton } from 'primeng/selectbutton';
import { Tooltip } from 'primeng/tooltip';
import { AuthService } from '../../core/auth.service';
import { CURRENT_LANGUAGE, TranslatePipe, t } from '../../core/i18n/i18n';
import { resizeImage } from '../../core/logo';
import { ProgressEntry } from '../../core/models';
import { isoDate } from '../../core/schedule';
import { StoreService } from '../../core/store.service';
import { ChartCard, ChartSeries } from '../chart-card/chart-card';

type Metric = 'weight' | 'bodyFat' | 'waist';

/** Body measurements over time (chart + history + photos). Members and their coach can add entries. */
@Component({
  selector: 'app-progress-view',
  imports: [TranslatePipe, DatePipe, DecimalPipe, FormsModule, FaIconComponent, Button, InputNumber, InputText, SelectButton, Tooltip, ChartCard],
  templateUrl: './progress-view.html',
  styleUrl: './progress-view.css',
})
export class ProgressView {
  private readonly auth = inject(AuthService);
  protected readonly store = inject(StoreService);
  private readonly toast = inject(MessageService);
  private readonly confirm = inject(ConfirmationService);
  readonly clientId = input.required<string>();

  protected readonly entries = computed(() => this.store.progressOf(this.clientId()));
  protected readonly metric = signal<Metric>('weight');
  protected readonly metrics: { label: string; value: Metric }[] = [{ label: t('Weight'), value: 'weight' }, { label: t('Body fat'), value: 'bodyFat' }, { label: t('Waist'), value: 'waist' }];
  protected readonly unit: Record<Metric, string> = { weight: 'kg', bodyFat: '%', waist: 'cm' };
  protected readonly chart = computed(() => {
    const m = this.metric();
    const list = this.entries().filter((e) => e[m] != null);
    const f = new Intl.DateTimeFormat(CURRENT_LANGUAGE.locale, { day: 'numeric', month: 'short' });
    return {
      labels: list.map((e) => f.format(new Date(e.date + 'T00:00:00'))),
      series: [{ label: this.metrics.find((x) => x.value === m)!.label, data: list.map((e) => e[m] as number) }] as ChartSeries[],
    };
  });
  protected readonly fmt = (v: number) => `${new Intl.NumberFormat(CURRENT_LANGUAGE.locale, { maximumFractionDigits: 1 }).format(v)} ${this.unit[this.metric()]}`;
  /** Change between the first and the latest value of each metric. */
  protected readonly delta = computed(() => {
    const out: Partial<Record<Metric, { last: number; diff: number }>> = {};
    for (const m of ['weight', 'bodyFat', 'waist'] as Metric[]) {
      const list = this.entries().filter((e) => e[m] != null);
      if (list.length) out[m] = { last: list.at(-1)![m] as number, diff: (list.at(-1)![m] as number) - (list[0][m] as number) };
    }
    return out;
  });
  protected readonly photos = computed(() => this.entries().filter((e) => e.photoUrl).reverse());

  protected form: { date: string; weight: number | null; bodyFat: number | null; waist: number | null; note: string; photoUrl?: string } = this.empty();
  private empty() { return { date: isoDate(), weight: null, bodyFat: null, waist: null, note: '' }; }

  async onPhoto(ev: Event) {
    const file = (ev.target as HTMLInputElement).files?.[0];
    if (file) this.form.photoUrl = await resizeImage(file, 480);
  }

  add() {
    const f = this.form;
    if (f.weight == null && f.bodyFat == null && f.waist == null && !f.photoUrl) { this.toast.add({ severity: 'error', summary: t('Enter at least one measurement or a photo.') }); return; }
    const e: Omit<ProgressEntry, 'id'> = { clientId: this.clientId(), date: f.date, byId: this.auth.user()!.id };
    if (f.weight != null) e.weight = f.weight;
    if (f.bodyFat != null) e.bodyFat = f.bodyFat;
    if (f.waist != null) e.waist = f.waist;
    if (f.note.trim()) e.note = f.note.trim();
    if (f.photoUrl) e.photoUrl = f.photoUrl;
    this.store.addProgress(e);
    this.form = this.empty();
    this.toast.add({ severity: 'success', summary: t('Progress saved'), life: 1500 });
  }

  remove(e: ProgressEntry) {
    this.confirm.confirm({ header: t('Delete entry'), message: t('Delete the entry of {0}?', { 0: e.date }), accept: () => this.store.deleteProgress(e.id) });
  }
}
