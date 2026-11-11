import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MessageService } from 'primeng/api';
import { Button } from 'primeng/button';
import { InputNumber } from 'primeng/inputnumber';
import { InputText } from 'primeng/inputtext';
import { Textarea } from 'primeng/textarea';
import { SelectButton } from 'primeng/selectbutton';
import { AuthService } from '../../core/auth.service';
import { CoachProfile, User } from '../../core/models';
import { StoreService } from '../../core/store.service';
import { CoachCard, PageHeader } from '../../shared/ui';

@Component({
  selector: 'app-coach-profile',
  imports: [FormsModule, Button, InputNumber, InputText, Textarea, SelectButton, CoachCard, PageHeader],
  template: `
    <app-page-header title="My profile" subtitle="This is what gym admins and members see.">
      <p-button label="Save" (onClick)="save()" />
    </app-page-header>
    <div class="grid lg:grid-cols-3 gap-6">
      <div class="lg:col-span-2 card space-y-4">
        <div class="grid sm:grid-cols-2 gap-4">
          <div class="field"><label>First name</label><input pInputText [(ngModel)]="user.firstName" /></div>
          <div class="field"><label>Last name</label><input pInputText [(ngModel)]="user.lastName" /></div>
          <div class="field"><label>Email</label><input pInputText [(ngModel)]="user.email" /></div>
          <div class="field"><label>Phone</label><input pInputText [(ngModel)]="user.phone" /></div>
          <div class="field sm:col-span-2"><label>Gender</label><p-selectbutton [options]="genders" optionLabel="label" optionValue="value" [(ngModel)]="user.gender" /></div>
          <div class="field sm:col-span-2"><label>Bio</label><textarea pTextarea rows="4" [(ngModel)]="profile.bio"></textarea></div>
          <div class="field sm:col-span-2"><label>Specialties (comma separated)</label><input pInputText [(ngModel)]="specialties" placeholder="Boxing, HIIT, Nutrition" /></div>
          <div class="field"><label>Years of experience</label><p-inputnumber [(ngModel)]="profile.yearsExperience" [min]="0" [showButtons]="true" /></div>
          <div class="field"><label>Hourly rate</label><p-inputnumber [(ngModel)]="profile.hourlyRate" mode="currency" currency="USD" [min]="0" /></div>
        </div>
      </div>
      <div>
        <div class="text-sm font-semibold mb-2">Public card</div>
        <app-coach-card [coachId]="user.id" />
      </div>
    </div>
  `,
})
export class CoachProfilePage {
  private readonly auth = inject(AuthService);
  private readonly store = inject(StoreService);
  private readonly toast = inject(MessageService);
  protected readonly genders = [{ label: 'Male', value: 'MALE' }, { label: 'Female', value: 'FEMALE' }];
  protected user: User = structuredClone(this.auth.user()!);
  protected profile: CoachProfile = structuredClone(
    this.store.coachProfile(this.user.id) ?? { userId: this.user.id, bio: '', specialties: [], yearsExperience: 0, hourlyRate: 0 },
  );
  protected specialties = this.profile.specialties.join(', ');

  save() {
    this.store.updateUser(this.user);
    this.store.upsertCoachProfile({ ...this.profile, specialties: this.specialties.split(',').map((s) => s.trim()).filter(Boolean) });
    this.toast.add({ severity: 'success', summary: 'Profile saved' });
  }
}
