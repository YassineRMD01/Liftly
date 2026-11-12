import { Component, computed, inject } from '@angular/core';
import { AuthService } from '../../../core/auth.service';
import { TranslatePipe } from '../../../core/i18n/i18n';
import { StoreService } from '../../../core/store.service';
import { PageHeader } from '../../../shared/page-header/page-header';
import { PlanView } from '../../../shared/plan-view/plan-view';

/** Member: workout and nutrition plans written by their coaches. */
@Component({
  selector: 'app-client-plans',
  imports: [TranslatePipe, PageHeader, PlanView],
  templateUrl: './client-plans.html',
  styleUrl: './client-plans.css',
})
export class ClientPlans {
  private readonly auth = inject(AuthService);
  protected readonly store = inject(StoreService);
  protected readonly plans = computed(() => this.store.plansOfClient(this.auth.user()?.id ?? ''));
}
