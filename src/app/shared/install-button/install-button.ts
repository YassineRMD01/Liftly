import { Component, inject } from '@angular/core';
import { FaIconComponent } from '@fortawesome/angular-fontawesome';
import { Button } from 'primeng/button';
import { Tooltip } from 'primeng/tooltip';
import { TranslatePipe } from '../../core/i18n/i18n';
import { PwaService } from '../../core/pwa.service';

/** Header buttons: install the app (when the browser allows it) and reload for a new version. */
@Component({
  selector: 'app-install-button',
  imports: [TranslatePipe, FaIconComponent, Button, Tooltip],
  templateUrl: './install-button.html',
  styleUrl: './install-button.css',
})
export class InstallButton {
  protected readonly pwa = inject(PwaService);
}
