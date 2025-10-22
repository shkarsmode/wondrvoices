import { ApplicationConfig, provideZonelessChangeDetection } from '@angular/core';
import { provideRouter, withEnabledBlockingInitialNavigation, withInMemoryScrolling, withViewTransitions } from '@angular/router';

import { provideHttpClient } from '@angular/common/http';
import { provideClientHydration } from '@angular/platform-browser';
import { BrowserAnimationsModule, provideAnimations } from '@angular/platform-browser/animations';
import { environment } from '../environments/environment.development';
import { routes } from './app.routes';
import { AUTH_PATH_API, BASE_PATH_API } from './shared/services/variables';

export const appConfig: ApplicationConfig = {
    providers: [
        provideZonelessChangeDetection(),
        provideRouter(routes, withEnabledBlockingInitialNavigation(), withViewTransitions(), withInMemoryScrolling({
            scrollPositionRestoration: 'enabled',
            anchorScrolling: 'enabled',
            // scrollOffset: [0, 0],
        }),),
        provideClientHydration(),
        provideHttpClient(),
        { provide: AUTH_PATH_API, useValue: environment.authPathApi },
        { provide: BASE_PATH_API, useValue: environment.basePathApi },
        BrowserAnimationsModule,
        provideAnimations()
    ],
};
