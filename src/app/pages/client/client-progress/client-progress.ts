import { Component, computed, inject } from '@angular/core';
import { AuthService } from '../../../core/auth.service';
import { TranslatePipe } from '../../../core/i18n/i18n';
import { PageHeader } from '../../../shared/page-header/page-header';
import { ProgressView } from '../../../shared/progress-view/progress-view';

/** Member: log body measurements and progress photos; their coach sees them too. */
@Component({
  selector: 'app-client-progress',
  imports: [TranslatePipe, PageHeader, ProgressView],
  template: `<app-page-header [title]="'Progress' | t" [subtitle]="'Log your weight, body fat, waist and photos. Your coach sees them too.' | t" />
    <app-progress-view [clientId]="me()" />`,
})
export class ClientProgress {
  private readonly auth = inject(AuthService);
  protected readonly me = computed(() => this.auth.user()?.id ?? '');
}
