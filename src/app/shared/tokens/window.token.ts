// window.token.ts
import { isPlatformBrowser } from '@angular/common';
import { inject, InjectionToken, PLATFORM_ID } from '@angular/core';

export const WINDOW = new InjectionToken<Window | null>('WINDOW', {
    factory: () => (isPlatformBrowser(inject(PLATFORM_ID)) ? window : null),
});
