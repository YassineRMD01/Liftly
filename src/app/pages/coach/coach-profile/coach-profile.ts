import { TranslatePipe, t } from '../../../core/i18n/i18n';
import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MessageService } from 'primeng/api';
import { ButtonDirective, ButtonLabel } from 'primeng/button';
import { InputNumber } from 'primeng/inputnumber';
import { InputText } from 'primeng/inputtext';
import { Textarea } from 'primeng/textarea';
import { SelectButton } from 'primeng/selectbutton';
import { Select } from 'primeng/select';
import { DEFAULT_CURRENCY } from '../../../core/currency';
import { AuthService } from '../../../core/auth.service';
import { CoachProfile, User } from '../../../core/models';
import { StoreService } from '../../../core/store.service';
import { CoachCard } from '../../../shared/coach-card/coach-card';
import { PageHeader } from '../../../shared/page-header/page-header';

@Component({
  selector: 'app-coach-profile',
  imports: [TranslatePipe, FormsModule, ButtonDirective, ButtonLabel, InputNumber, InputText, Textarea, SelectButton, Select, CoachCard, PageHeader],
  templateUrl: './coach-profile.html',
  styleUrl: './coach-profile.css',
})
export class CoachProfilePage {
  private readonly auth = inject(AuthService);
  private readonly store = inject(StoreService);
  private readonly toast = inject(MessageService);
  /** Active currencies (managed by the super-admin). */
  protected readonly currencies = inject(StoreService).currencyOptions;
  protected readonly genders = [{ label: t('Male'), value: 'MALE' }, { label: t('Female'), value: 'FEMALE' }];
  protected user: User = structuredClone(this.auth.user()!);
  protected profile: CoachProfile = structuredClone(
    this.store.coachProfile(this.user.id) ?? { userId: this.user.id, bio: '', specialties: [], yearsExperience: 0, hourlyRate: 0, currency: DEFAULT_CURRENCY },
  );
  protected specialties = this.profile.specialties.join(', ');

  constructor() {
    this.profile.currency ??= DEFAULT_CURRENCY;
  }

  save() {
    this.store.updateUser(this.user);
    this.store.upsertCoachProfile({ ...this.profile, specialties: this.specialties.split(',').map((s) => s.trim()).filter(Boolean) });
    this.toast.add({ severity: 'success', summary: t('Profile saved') });
  }
}
