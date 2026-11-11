import { Component, computed, inject } from '@angular/core';
import { CurrencyPipe, DatePipe } from '@angular/common';
import { ConfirmationService, MessageService } from 'primeng/api';
import { FaIconComponent } from '@fortawesome/angular-fontawesome';
import { Button } from 'primeng/button';
import { Tag } from 'primeng/tag';
import { AuthService } from '../../core/auth.service';
import { BillingCycle, SaasPlan } from '../../core/models';
import { StoreService } from '../../core/store.service';
import { PageHeader } from '../../shared/ui';
import { statusSeverity } from '../super-admin/sa-gyms';

@Component({
  selector: 'app-admin-billing',
  imports: [CurrencyPipe, DatePipe, FaIconComponent, Button, Tag, PageHeader],
  template: `
    @if (gym(); as g) {
      <app-page-header title="Billing" subtitle="Your Liftly subscription." />

      <div class="card flex flex-col md:flex-row md:items-center gap-6">
        <div class="flex-1">
          <div class="text-sm muted">Current plan</div>
          <div class="flex items-center gap-3 mt-1">
            <span class="text-2xl font-bold">{{ current()?.name }}</span>
            <p-tag [value]="g.status" [severity]="sev(g.status)" />
          </div>
          <div class="text-sm muted mt-1">
            {{ price(current(), g.billingCycle) | currency }} / {{ g.billingCycle === 'MONTHLY' ? 'month' : 'year' }} ·
            {{ g.status === 'TRIAL' ? 'Trial ends' : 'Renews' }} {{ g.renewsAt | date: 'longDate' }}
          </div>
        </div>
        <div class="flex flex-wrap gap-2">
          <p-button [label]="g.billingCycle === 'MONTHLY' ? 'Switch to yearly (save ~17%)' : 'Switch to monthly'" [outlined]="true" (onClick)="switchCycle()" />
          @if (g.status === 'TRIAL') { <p-button label="Activate now" (onClick)="activate()" /> }
        </div>
      </div>

      <h2 class="font-semibold text-lg mt-8 mb-4">Change plan</h2>
      <div class="grid md:grid-cols-3 gap-5">
        @for (p of plans(); track p.id) {
          <div class="card flex flex-col" [class.!border-primary]="p.id === g.saasPlanId" [class.ring-2]="p.id === g.saasPlanId" [class.ring-primary]="p.id === g.saasPlanId">
            <div class="flex justify-between"><h3 class="text-lg font-bold">{{ p.name }}</h3>
              @if (p.id === g.saasPlanId) { <p-tag value="Current" /> }</div>
            <div class="text-3xl font-extrabold mt-3">{{ price(p, g.billingCycle) | currency: 'USD' : 'symbol' : '1.0-0' }}
              <span class="text-sm font-normal muted">/{{ g.billingCycle === 'MONTHLY' ? 'mo' : 'yr' }}</span></div>
            <ul class="mt-4 space-y-1.5 text-sm flex-1">
              @for (f of p.features; track f) { <li class="flex gap-2"><fa-icon icon="check" class="text-primary" />{{ f }}</li> }
            </ul>
            <p-button class="mt-5" styleClass="w-full" [disabled]="p.id === g.saasPlanId"
              [label]="p.id === g.saasPlanId ? 'Current plan' : (price(p, 'MONTHLY') > price(current(), 'MONTHLY') ? 'Upgrade' : 'Downgrade')"
              (onClick)="change(p)" />
          </div>
        }
      </div>

      <h2 class="font-semibold text-lg mt-8 mb-4">Invoices</h2>
      <div class="card">
        <table class="w-full text-sm">
          <thead><tr class="text-left muted"><th class="py-2">Date</th><th>Description</th><th>Amount</th><th></th></tr></thead>
          <tbody>
            @for (i of invoices(); track i.date) {
              <tr class="border-t border-surface-200 dark:border-surface-800">
                <td class="py-3">{{ i.date | date }}</td><td>{{ i.label }}</td><td>{{ i.amount | currency }}</td>
                <td class="text-right"><p-tag value="Paid" severity="success" /></td>
              </tr>
            } @empty { <tr><td colspan="4" class="py-6 text-center muted">No invoices during trial.</td></tr> }
          </tbody>
        </table>
      </div>
    }
  `,
})
export class AdminBilling {
  private readonly auth = inject(AuthService);
  private readonly store = inject(StoreService);
  private readonly toast = inject(MessageService);
  private readonly confirm = inject(ConfirmationService);
  protected readonly sev = statusSeverity;
  protected readonly gym = this.auth.activeGym;
  protected readonly current = computed(() => this.store.saasPlan(this.gym()?.saasPlanId));
  protected readonly plans = computed(() => this.store.saasPlans().filter((p) => p.active || p.id === this.gym()?.saasPlanId));
  protected readonly invoices = computed(() => {
    const g = this.gym();
    const p = this.current();
    if (!g || !p || g.status === 'TRIAL') return [];
    const step = g.billingCycle === 'MONTHLY' ? 30 : 365;
    return Array.from({ length: 4 }, (_, i) => ({
      date: new Date(new Date(g.renewsAt).getTime() - (i + 1) * step * 86400000).toISOString(),
      label: `${p.name} · ${g.billingCycle.toLowerCase()}`,
      amount: this.price(p, g.billingCycle),
    })).filter((i) => i.date >= g.subscribedAt);
  });

  price(p: SaasPlan | undefined, cycle: BillingCycle) { return p ? (cycle === 'MONTHLY' ? p.monthlyPrice : p.yearlyPrice) : 0; }

  change(p: SaasPlan) {
    const g = this.gym()!;
    const coaches = this.store.coachesOfGym(g.id).length;
    const clients = this.store.clientsOfGym(g.id).length;
    if ((p.maxCoaches !== -1 && coaches > p.maxCoaches) || (p.maxClients !== -1 && clients > p.maxClients)) {
      this.toast.add({ severity: 'error', summary: 'Plan too small', detail: `You have ${coaches} coaches and ${clients} clients.` });
      return;
    }
    this.confirm.confirm({
      header: 'Change plan', message: `Move to ${p.name} for ${this.price(p, g.billingCycle)} USD per ${g.billingCycle === 'MONTHLY' ? 'month' : 'year'}?`,
      accept: () => {
        this.store.updateGym({ ...g, saasPlanId: p.id });
        this.toast.add({ severity: 'success', summary: 'Plan changed', detail: `You're now on ${p.name}.` });
      },
    });
  }

  switchCycle() {
    const g = this.gym()!;
    this.store.updateGym({ ...g, billingCycle: g.billingCycle === 'MONTHLY' ? 'YEARLY' : 'MONTHLY' });
    this.toast.add({ severity: 'success', summary: 'Billing cycle updated' });
  }

  activate() {
    const g = this.gym()!;
    const now = new Date();
    const days = g.billingCycle === 'MONTHLY' ? 30 : 365;
    this.store.updateGym({ ...g, status: 'ACTIVE', renewsAt: new Date(now.getTime() + days * 86400000).toISOString() });
    this.toast.add({ severity: 'success', summary: 'Subscription active', detail: 'Thanks for choosing Liftly!' });
  }
}
