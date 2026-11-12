import { Component, computed, inject, input, signal } from '@angular/core';
import { UIChart } from 'primeng/chart';
import type { ChartData, ChartOptionsBase } from 'primeng/types/chart';
import { FaIconComponent } from '@fortawesome/angular-fontawesome';
import { ButtonDirective } from 'primeng/button';
import { Tooltip } from 'primeng/tooltip';
import { CURRENT_LANGUAGE, TranslatePipe } from '../../core/i18n/i18n';
import { ThemeService } from '../../core/theme.service';

/**
 * Chart colors (data-viz reference palette, validated for color-vision deficiency in light and dark).
 * Categorical slots are used in this fixed order; status colors only ever mean a state.
 */
export const CHART_COLORS = {
  light: { series: ['#2a78d6', '#eb6834', '#1baf7a'], surface: '#ffffff', grid: '#e1e0d9', axis: '#c3c2b7', muted: '#898781', text: '#52514e' },
  dark: { series: ['#3987e5', '#d95926', '#199e70'], surface: '#18181b', grid: '#2c2c2a', axis: '#383835', muted: '#898781', text: '#c3c2b7' },
  status: { good: '#0ca30c', warning: '#fab219', critical: '#d03b3b', neutral: '#898781' },
};

export interface ChartSeries {
  label: string;
  data: number[];
  /** Per-bar status colors (e.g. Active / Expired / Banned). Omit for categorical identity colors. */
  statusColors?: (keyof typeof CHART_COLORS.status)[];
}

/** A titled card with a bar or line chart, a hover tooltip and an accessible table view. */
@Component({
  selector: 'app-chart-card',
  imports: [UIChart, FaIconComponent, ButtonDirective, Tooltip, TranslatePipe],
  templateUrl: './chart-card.html',
  styleUrl: './chart-card.css',
})
export class ChartCard {
  private readonly theme = inject(ThemeService);

  readonly title = input.required<string>();
  readonly subtitle = input<string>();
  readonly type = input<'bar' | 'line'>('bar');
  readonly labels = input.required<string[]>();
  readonly series = input.required<ChartSeries[]>();
  /** Horizontal bars (for ranked categories). */
  readonly horizontal = input(false);
  readonly stacked = input(false);
  /** Formats values in ticks, tooltips and the table (e.g. money). */
  readonly format = input<(v: number) => string>((v) => new Intl.NumberFormat(CURRENT_LANGUAGE.locale).format(v));
  readonly height = input('16rem');
  /** The category axis is time (months): mirrored in right-to-left languages. */
  readonly timeAxis = input(false);

  protected readonly showTable = signal(false);
  private readonly rtl = CURRENT_LANGUAGE.dir === 'rtl';

  protected readonly data = computed<ChartData>(() => {
    const c = this.theme.dark() ? CHART_COLORS.dark : CHART_COLORS.light;
    const line = this.type() === 'line';
    return ({
      labels: this.labels(),
      datasets: this.series().map((s, i) => {
        const color = s.statusColors ? s.statusColors.map((k) => CHART_COLORS.status[k]) : c.series[i % c.series.length];
        return line
          ? {
              label: s.label, data: s.data, borderColor: color, backgroundColor: color,
              borderWidth: 2, pointRadius: 0, pointHoverRadius: 5, pointHoverBorderWidth: 2, pointHoverBorderColor: c.surface,
              tension: 0.25, borderCapStyle: 'round', borderJoinStyle: 'round', fill: false,
            }
          : {
              label: s.label, data: s.data, backgroundColor: color,
              // 4px rounded data end, square at the baseline; 2px surface gap between touching fills
              borderRadius: 4, borderSkipped: 'start', borderWidth: this.stacked() ? 2 : 0, borderColor: c.surface,
              maxBarThickness: 24, categoryPercentage: 0.7, barPercentage: 0.9,
            };
      }),
    }) as unknown as ChartData;
  });

  protected readonly options = computed<ChartOptionsBase>(() => {
    const c = this.theme.dark() ? CHART_COLORS.dark : CHART_COLORS.light;
    const fmt = this.format();
    const horizontal = this.horizontal();
    const multi = this.series().length > 1;
    const font = { family: 'Inter, ui-sans-serif, system-ui, sans-serif', size: 11 };
    const rtl = this.rtl;
    const valueAxis = {
      beginAtZero: true, stacked: this.stacked(),
      // right-to-left: value axis on the right for columns, bars grow from the right
      position: horizontal ? undefined : rtl ? 'right' : 'left', reverse: rtl && horizontal,
      grid: { color: c.grid, drawTicks: false }, border: { display: false },
      ticks: { color: c.muted, font, padding: 6, maxTicksLimit: 5, precision: 0, callback: (v: number | string) => fmt(Number(v)) },
    };
    const categoryAxis = {
      stacked: this.stacked(), reverse: rtl && this.timeAxis() && !horizontal,
      position: horizontal ? (rtl ? 'right' : 'left') : undefined,
      grid: { display: false }, border: { color: c.axis },
      ticks: { color: c.muted, font, autoSkip: true, maxRotation: 0 },
    };
    return ({
      maintainAspectRatio: false,
      layout: { padding: { left: 6, right: 10 } },
      indexAxis: horizontal ? 'y' : 'x',
      interaction: { mode: this.type() === 'line' ? 'index' : 'nearest', intersect: false, axis: horizontal ? 'y' : 'x' },
      plugins: {
        legend: { display: multi, position: 'bottom', rtl: this.rtl, labels: { color: c.text, font, usePointStyle: true, pointStyle: 'rectRounded', boxWidth: 8, boxHeight: 8, padding: 14 } },
        tooltip: {
          rtl: this.rtl, backgroundColor: this.theme.dark() ? '#f0efec' : '#0b0b0b', titleColor: this.theme.dark() ? '#0b0b0b' : '#ffffff',
          bodyColor: this.theme.dark() ? '#0b0b0b' : '#ffffff', padding: 10, cornerRadius: 8, boxPadding: 4, usePointStyle: true,
          callbacks: { label: (ctx: { dataset: { label?: string }; raw: unknown }) => `${multi ? ctx.dataset.label + ': ' : ''}${fmt(Number(ctx.raw))}` },
        },
      },
      scales: horizontal ? { x: valueAxis, y: categoryAxis } : { x: categoryAxis, y: valueAxis },
    }) as unknown as ChartOptionsBase;
  });

  /** Table rows for the accessible table view. */
  protected readonly rows = computed(() => this.labels().map((label, i) => ({ label, values: this.series().map((s) => this.format()(s.data[i] ?? 0)) })));
}
