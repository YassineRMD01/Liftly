import { Component, computed, inject, signal } from '@angular/core';
import { CurrencyPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ConfirmationService, MessageService } from 'primeng/api';
import { FaIconComponent } from '@fortawesome/angular-fontawesome';
import { Button } from 'primeng/button';
import { Dialog } from 'primeng/dialog';
import { InputNumber } from 'primeng/inputnumber';
import { InputText } from 'primeng/inputtext';
import { Tag } from 'primeng/tag';
import { Textarea } from 'primeng/textarea';
import { ToggleSwitch } from 'primeng/toggleswitch';
import { AuthService } from '../../core/auth.service';
import { MembershipPlan } from '../../core/models';
import { StoreService } from '../../core/store.service';
import { PageHeader } from '../../shared/ui';

@Component({
  selector: 'app-admin-memberships',
  imports: [FormsModule, CurrencyPipe, FaIconComponent, Button, Dialog, InputNumber, InputText, Tag, Textarea, ToggleSwitch, PageHeader],
  template: `
    <app-page-header title="Membership plans" subtitle="Subscriptions your clients can buy.">
      <p-button label="New plan" (onClick)="edit()"><ng-template #icon><fa-icon icon="plus" /></ng-template></p-button>
    </app-page-header>

    <div class="grid md:grid-cols-2 xl:grid-cols-3 gap-5">
      @for (p of plans(); track p.id) {
        <div class="card flex flex-col" [class.opacity-60]="!p.active">
          <div class="flex justify-between items-start gap-2">
            <h3 class="text-lg font-bold">{{ p.name }}</h3>
            <p-tag [value]="p.active ? 'On sale' : 'Hidden'" [severity]="p.active ? 'success' : 'secondary'" />
          </div>
          <p class="text-sm muted mt-1 flex-1">{{ p.description }}</p>
          <div class="text-3xl font-extrabold mt-4">{{ p.price | currency }}</div>
          <div class="text-sm muted">for {{ p.durationDays }} days</div>
          <div class="flex flex-wrap gap-3 text-sm mt-4">
            <span><fa-icon icon="calendar-check" class="text-primary" /> {{ p.sessionsPerWeek === -1 ? 'Unlimited' : p.sessionsPerWeek + '×/week' }}</span>
            @if (p.includesCoaching) { <span><fa-icon icon="user-tie" class="text-primary" /> Coaching</span> }
            <span><fa-icon icon="users" class="text-primary" /> {{ subscribers(p.id) }} subscribers</span>
          </div>
          <div class="flex gap-2 mt-5">
            <p-button label="Edit" size="small" [outlined]="true" (onClick)="edit(p)" />
            <p-button label="Delete" size="small" severity="danger" [text]="true" (onClick)="remove(p)" />
          </div>
        </div>
      } @empty {
        <div class="card md:col-span-2 xl:col-span-3 text-center py-12">
          <fa-icon icon="id-card" class="text-4xl text-primary" />
          <p class="mt-3 font-semibold">No membership plans yet</p>
          <p class="muted text-sm">Create your first plan so clients can subscribe.</p>
        </div>
      }
    </div>

    <p-dialog [header]="draft().id ? 'Edit plan' : 'New plan'" [(visible)]="visible" [modal]="true" [style]="{ width: '36rem' }" [breakpoints]="{ '640px': '95vw' }">
      <div class="grid sm:grid-cols-2 gap-4">
        <div class="field sm:col-span-2"><label>Name</label><input pInputText [(ngModel)]="draft().name" placeholder="e.g. Monthly unlimited" /></div>
        <div class="field sm:col-span-2"><label>Description</label><textarea pTextarea rows="2" [(ngModel)]="draft().description"></textarea></div>
        <div class="field"><label>Price</label><p-inputnumber [(ngModel)]="draft().price" mode="currency" currency="USD" [min]="0" /></div>
        <div class="field"><label>Duration (days)</label><p-inputnumber [(ngModel)]="draft().durationDays" [min]="1" [showButtons]="true" /></div>
        <div class="field"><label>Sessions / week (-1 = ∞)</label><p-inputnumber [(ngModel)]="draft().sessionsPerWeek" [min]="-1" [showButtons]="true" /></div>
        <div class="flex flex-col gap-3 justify-end">
          <label class="flex items-center gap-3"><p-toggleswitch [(ngModel)]="draft().includesCoaching" /> Includes coaching</label>
          <label class="flex items-center gap-3"><p-toggleswitch [(ngModel)]="draft().active" /> On sale</label>
        </div>
      </div>
      <ng-template #footer>
        <p-button label="Cancel" [text]="true" severity="secondary" (onClick)="visible = false" />
        <p-button label="Save" (onClick)="save()" [disabled]="!draft().name || !draft().durationDays" />
      </ng-template>
    </p-dialog>
  `,
})
export class AdminMemberships {
  private readonly auth = inject(AuthService);
  private readonly store = inject(StoreService);
  private readonly toast = inject(MessageService);
  private readonly confirm = inject(ConfirmationService);
  protected visible = false;
  protected readonly draft = signal<MembershipPlan>(this.empty());
  protected readonly plans = computed(() => (this.auth.activeGym() ? this.store.plansOfGym(this.auth.activeGym()!.id) : []));

  private empty(): MembershipPlan {
    return { id: '', gymId: this.auth.activeGym()?.id ?? '', name: '', description: '', price: 50, durationDays: 30, sessionsPerWeek: -1, includesCoaching: false, active: true };
  }
  subscribers(planId: string) { return this.store.memberships().filter((m) => m.planId === planId && m.status === 'ACTIVE').length; }
  edit(p?: MembershipPlan) { this.draft.set(p ? structuredClone(p) : this.empty()); this.visible = true; }
  save() {
    this.store.saveMembershipPlan(this.draft());
    this.visible = false;
    this.toast.add({ severity: 'success', summary: 'Plan saved', detail: this.draft().name });
  }
  remove(p: MembershipPlan) {
    this.confirm.confirm({
      header: 'Delete plan', message: this.subscribers(p.id) ? `"${p.name}" has active subscribers. Delete anyway? Existing memberships stay valid.` : `Delete "${p.name}"?`,
      acceptButtonStyleClass: 'p-button-danger',
      accept: () => { this.store.deleteMembershipPlan(p.id); this.toast.add({ severity: 'success', summary: 'Plan deleted' }); },
    });
  }
}
