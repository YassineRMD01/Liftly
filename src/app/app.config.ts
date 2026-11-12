import { ApplicationConfig, LOCALE_ID, inject, isDevMode, provideAppInitializer, provideBrowserGlobalErrorListeners } from '@angular/core';
import { registerLocaleData } from '@angular/common';
import localeFr from '@angular/common/locales/fr';
import localeEs from '@angular/common/locales/es';
import localeArMa from '@angular/common/locales/ar-MA';
import { provideRouter, withComponentInputBinding, withInMemoryScrolling } from '@angular/router';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { providePrimeNG } from 'primeng/config';
import { ConfirmationService, MessageService } from 'primeng/api';
import { definePreset } from '@primeuix/themes';
import Aura from '@primeuix/themes/aura';
import { FaIconLibrary } from '@fortawesome/angular-fontawesome';
import { provideServiceWorker } from '@angular/service-worker';
import { routes } from './app.routes';
import { PRIMEUI_LICENSE_KEY } from './core/app-settings';
import { APP_ICONS } from './core/icons';
import { ThemeService, buildPalette, DEFAULT_PRIMARY } from './core/theme.service';
import { CURRENT_LANG, CURRENT_LANGUAGE, applyDocumentLanguage } from './core/i18n/i18n';
import { PRIMENG_TRANSLATIONS } from './core/i18n/primeng-locale';

registerLocaleData(localeFr, 'fr-FR');
registerLocaleData(localeEs, 'es-ES');
registerLocaleData(localeArMa, 'ar-MA');

const GymPreset = definePreset(Aura, {
  semantic: { primary: buildPalette(DEFAULT_PRIMARY) },
});

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes, withComponentInputBinding(), withInMemoryScrolling({ scrollPositionRestoration: 'top' })),
    provideAnimationsAsync(),
    { provide: LOCALE_ID, useValue: CURRENT_LANGUAGE.locale },
    providePrimeNG({
      ripple: true,
      ...(PRIMENG_TRANSLATIONS[CURRENT_LANG] ? { translation: PRIMENG_TRANSLATIONS[CURRENT_LANG] } : {}),
      ...(PRIMEUI_LICENSE_KEY ? { license: PRIMEUI_LICENSE_KEY } : {}),
      theme: {
        preset: GymPreset,
        options: {
          darkModeSelector: '.app-dark',
          cssLayer: { name: 'primeng', order: 'theme, base, primeng, components, utilities' },
        },
      },
    }),
    // offline cache + installable app (production builds only)
    provideServiceWorker('ngsw-worker.js', { enabled: !isDevMode(), registrationStrategy: 'registerWhenStable:30000' }),
    MessageService,
    ConfirmationService,
    provideAppInitializer(() => {
      inject(FaIconLibrary).addIcons(...APP_ICONS);
      inject(ThemeService); // start applying the gym theme
      applyDocumentLanguage(); // <html lang dir>
    }),
  ],
};
