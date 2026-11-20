import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { FaIconComponent } from '@fortawesome/angular-fontawesome';
import { ButtonDirective } from 'primeng/button';
import { ConfirmDialog } from 'primeng/confirmdialog';
import { Toast } from 'primeng/toast';
import { TranslatePipe } from './core/i18n/i18n';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, Toast, ConfirmDialog, FaIconComponent, ButtonDirective, TranslatePipe],
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class App {}
