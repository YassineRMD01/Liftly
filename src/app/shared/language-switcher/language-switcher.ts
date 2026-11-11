import { TranslatePipe } from '../../core/i18n/i18n';
import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { FaIconComponent } from '@fortawesome/angular-fontawesome';
import { Select } from 'primeng/select';
import { CURRENT_LANG, LANGUAGES, Lang, setLanguage } from '../../core/i18n/i18n';

/** Language picker (English, Français, Español, العربية). Changing it reloads the app in that language. */
@Component({
  selector: 'app-language-switcher',
  imports: [TranslatePipe, FormsModule, FaIconComponent, Select],
  templateUrl: './language-switcher.html',
  styleUrl: './language-switcher.css',
})
export class LanguageSwitcher {
  protected readonly languages = LANGUAGES;
  protected readonly current = CURRENT_LANG;

  change(lang: Lang) {
    setLanguage(lang);
  }
}
