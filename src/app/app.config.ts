import { ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideRouter, withViewTransitions } from '@angular/router';
import { routes } from './app.routes';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(
      routes,
      withViewTransitions({
        skipInitialTransition: true,
        // Browsers abort transitions while the tab is hidden; that is not an app error.
        onViewTransitionCreated: ({ transition }) => {
          transition.ready.catch(() => undefined);
          transition.finished.catch(() => undefined);
        },
      }),
    ),
  ]
};
