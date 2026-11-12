import { Component, computed, inject } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { FaIconComponent } from '@fortawesome/angular-fontawesome';
import { Button } from 'primeng/button';
import { AuthService, HOME_BY_ROLE } from '../../core/auth.service';
import { TranslatePipe } from '../../core/i18n/i18n';
import { StoreService } from '../../core/store.service';
import { AppearanceSwitcher } from '../appearance-switcher/appearance-switcher';
import { GymLogo } from '../gym-logo/gym-logo';
import { LanguageSwitcher } from '../language-switcher/language-switcher';

/** Top bar of the public pages outside the landing page (gym directory, gym pages). */
@Component({
  selector: 'app-public-header',
  imports: [TranslatePipe, RouterLink, RouterLinkActive, FaIconComponent, Button, AppearanceSwitcher, GymLogo, LanguageSwitcher],
  templateUrl: './public-header.html',
  styleUrl: './public-header.css',
})
export class PublicHeader {
  protected readonly store = inject(StoreService);
  protected readonly auth = inject(AuthService);
  protected readonly home = computed(() => HOME_BY_ROLE[this.auth.role() ?? 'CLIENT']);
}
