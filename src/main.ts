import { loadLanguage } from './app/core/i18n/i18n';

// The language is loaded first, so labels translated when modules load (menus, enums…) are already in it.
loadLanguage()
  .catch((err) => console.error('Could not load the language', err))
  .then(async () => {
    const [{ bootstrapApplication }, { appConfig }, { App }] = await Promise.all([
      import('@angular/platform-browser'),
      import('./app/app.config'),
      import('./app/app'),
    ]);
    return bootstrapApplication(App, appConfig);
  })
  .catch((err) => console.error(err));
