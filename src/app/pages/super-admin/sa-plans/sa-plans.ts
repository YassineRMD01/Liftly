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
import { SaasPlan } from '../../../core/models';
import { StoreService } from '../../../core/store.service';
import { PageHeader } from '../../../shared/page-header/page-header';

const EMPTY: SaasPlan = { id: '', name: '', description: '', monthlyPrice: 0, yearlyPrice: 0, maxCoaches: 5, maxClients: 200, features: [], customTheme: false, highlighted: false, active: true };

@Component({
  selector: 'app-sa-plans',
  imports: [FormsModule, CurrencyPipe, FaIconComponent, Button, Dialog, InputNumber, InputText, Tag, Textarea, ToggleSwitch, PageHeader],
  templateUrl: './sa-plans.html',
  styleUrl: './sa-plans.css',
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
