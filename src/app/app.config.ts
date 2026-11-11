import { ApplicationConfig, inject, provideAppInitializer, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideRouter, withComponentInputBinding, withInMemoryScrolling } from '@angular/router';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { providePrimeNG } from 'primeng/config';
import { ConfirmationService, MessageService } from 'primeng/api';
import { definePreset } from '@primeuix/themes';
import Aura from '@primeuix/themes/aura';
import { FaIconLibrary } from '@fortawesome/angular-fontawesome';
import { routes } from './app.routes';
import { PRIMEUI_LICENSE_KEY } from './core/app-settings';
import { APP_ICONS } from './core/icons';
import { ThemeService, buildPalette, DEFAULT_PRIMARY } from './core/theme.service';

const GymPreset = definePreset(Aura, {
  semantic: { primary: buildPalette(DEFAULT_PRIMARY) },
});

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes, withComponentInputBinding(), withInMemoryScrolling({ scrollPositionRestoration: 'top' })),
    provideAnimationsAsync(),
    providePrimeNG({
      ripple: true,
      ...(PRIMEUI_LICENSE_KEY ? { license: PRIMEUI_LICENSE_KEY } : {}),
      theme: {
        preset: GymPreset,
        options: {
          darkModeSelector: '.app-dark',
          cssLayer: { name: 'primeng', order: 'theme, base, primeng, components, utilities' },
        },
      },
    }),
    MessageService,
    ConfirmationService,
    provideAppInitializer(() => {
      inject(FaIconLibrary).addIcons(...APP_ICONS);
      inject(ThemeService); // start applying the gym theme
    }),
  ],
};
