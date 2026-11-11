import { Component, computed, inject, signal } from '@angular/core';
import { MoneyPipe } from '../../../core/currency';
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
import { AuthService } from '../../../core/auth.service';
import { MembershipPlan } from '../../../core/models';
import { StoreService } from '../../../core/store.service';
import { PageHeader } from '../../../shared/page-header/page-header';

@Component({
  selector: 'app-admin-memberships',
  imports: [MoneyPipe, FormsModule, FaIconComponent, Button, Dialog, InputNumber, InputText, Tag, Textarea, ToggleSwitch, PageHeader],
  templateUrl: './admin-memberships.html',
  styleUrl: './admin-memberships.css',
})
export class AdminMemberships {
  private readonly auth = inject(AuthService);
  private readonly store = inject(StoreService);
  private readonly toast = inject(MessageService);
  private readonly confirm = inject(ConfirmationService);
  protected visible = false;
  protected readonly cur = computed(() => this.auth.activeGym()?.currency ?? 'USD');
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
