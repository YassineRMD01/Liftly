import { Component, inject, signal } from '@angular/core';
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
import { SaasPlan } from '../../core/models';
import { StoreService } from '../../core/store.service';
import { PageHeader } from '../../shared/ui';

const EMPTY: SaasPlan = { id: '', name: '', description: '', monthlyPrice: 0, yearlyPrice: 0, maxCoaches: 5, maxClients: 200, features: [], customTheme: false, highlighted: false, active: true };

@Component({
  selector: 'app-sa-plans',
  imports: [FormsModule, CurrencyPipe, FaIconComponent, Button, Dialog, InputNumber, InputText, Tag, Textarea, ToggleSwitch, PageHeader],
  template: `
    <app-page-header title="Pricing plans" subtitle="What gym owners pay to use Liftly.">
      <p-button label="New plan" (onClick)="edit()"><ng-template #icon><fa-icon icon="plus" /></ng-template></p-button>
    </app-page-header>

    <div class="grid md:grid-cols-2 xl:grid-cols-3 gap-5">
      @for (p of store.saasPlans(); track p.id) {
        <div class="card flex flex-col" [class.opacity-60]="!p.active">
          <div class="flex items-start justify-between gap-2">
            <div>
              <h3 class="text-lg font-bold">{{ p.name }}</h3>
              <p class="text-sm muted">{{ p.description }}</p>
            </div>
            <div class="flex gap-1">
              @if (p.highlighted) { <p-tag value="Popular" /> }
              @if (!p.active) { <p-tag value="Hidden" severity="secondary" /> }
            </div>
          </div>
          <div class="mt-4 text-3xl font-extrabold">{{ p.monthlyPrice | currency }}<span class="text-sm font-normal muted">/mo</span></div>
          <div class="text-sm muted">{{ p.yearlyPrice | currency }}/yr</div>
          <ul class="mt-4 space-y-1.5 text-sm flex-1">
            <li>{{ p.maxCoaches === -1 ? 'Unlimited' : p.maxCoaches }} coaches · {{ p.maxClients === -1 ? 'Unlimited' : p.maxClients }} clients</li>
            <li>Custom theme: <b>{{ p.customTheme ? 'Yes' : 'No' }}</b></li>
            @for (f of p.features; track f) { <li class="flex gap-2"><fa-icon icon="check" class="text-primary" />{{ f }}</li> }
          </ul>
          <div class="text-xs muted mt-3">{{ gymCount(p.id) }} gyms on this plan</div>
          <div class="flex gap-2 mt-4">
            <p-button label="Edit" [outlined]="true" size="small" (onClick)="edit(p)" />
            <p-button label="Delete" severity="danger" [text]="true" size="small" (onClick)="remove(p)" />
          </div>
        </div>
      }
    </div>

    <p-dialog [header]="draft().id ? 'Edit plan' : 'New plan'" [(visible)]="visible" [modal]="true" [style]="{ width: '40rem' }" [breakpoints]="{ '640px': '95vw' }">
      <div class="grid sm:grid-cols-2 gap-4">
        <div class="field sm:col-span-2"><label>Name</label><input pInputText [(ngModel)]="draft().name" /></div>
        <div class="field sm:col-span-2"><label>Description</label><textarea pTextarea rows="2" [(ngModel)]="draft().description"></textarea></div>
        <div class="field"><label>Monthly price</label><p-inputnumber [(ngModel)]="draft().monthlyPrice" mode="currency" currency="USD" /></div>
        <div class="field"><label>Yearly price</label><p-inputnumber [(ngModel)]="draft().yearlyPrice" mode="currency" currency="USD" /></div>
        <div class="field"><label>Max coaches (-1 = ∞)</label><p-inputnumber [(ngModel)]="draft().maxCoaches" [min]="-1" /></div>
        <div class="field"><label>Max clients (-1 = ∞)</label><p-inputnumber [(ngModel)]="draft().maxClients" [min]="-1" /></div>
        <div class="field sm:col-span-2"><label>Features (one per line)</label><textarea pTextarea rows="4" [(ngModel)]="featuresText"></textarea></div>
        <label class="flex items-center gap-3"><p-toggleswitch [(ngModel)]="draft().customTheme" /> Custom theme allowed</label>
        <label class="flex items-center gap-3"><p-toggleswitch [(ngModel)]="draft().highlighted" /> Highlight as popular</label>
        <label class="flex items-center gap-3"><p-toggleswitch [(ngModel)]="draft().active" /> Visible on pricing page</label>
      </div>
      <ng-template #footer>
        <p-button label="Cancel" [text]="true" severity="secondary" (onClick)="visible = false" />
        <p-button label="Save" (onClick)="save()" [disabled]="!draft().name" />
      </ng-template>
    </p-dialog>
  `,
})
export class SaPlans {
  protected readonly store = inject(StoreService);
  private readonly toast = inject(MessageService);
  private readonly confirm = inject(ConfirmationService);
  protected visible = false;
  protected readonly draft = signal<SaasPlan>({ ...EMPTY });
  protected featuresText = '';

  gymCount(id: string) { return this.store.gyms().filter((g) => g.saasPlanId === id).length; }

  edit(p: SaasPlan = EMPTY) {
    this.draft.set(structuredClone(p));
    this.featuresText = p.features.join('\n');
    this.visible = true;
  }

  save() {
    this.store.saveSaasPlan({ ...this.draft(), features: this.featuresText.split('\n').map((f) => f.trim()).filter(Boolean) });
    this.visible = false;
    this.toast.add({ severity: 'success', summary: 'Plan saved' });
  }

  remove(p: SaasPlan) {
    if (this.gymCount(p.id)) {
      this.toast.add({ severity: 'warn', summary: 'Plan in use', detail: 'Move gyms to another plan or hide it instead.' });
      return;
    }
    this.confirm.confirm({
      header: 'Delete plan', message: `Delete the "${p.name}" plan?`, acceptButtonStyleClass: 'p-button-danger',
      accept: () => { this.store.deleteSaasPlan(p.id); this.toast.add({ severity: 'success', summary: 'Plan deleted' }); },
    });
  }
}
