import { Routes } from '@angular/router';
import { LandingPageComponent } from './features/landing/landing-page/landing-page.component';
import { GalleryComponent } from './features/landing/pages/gallery/gallery.component';
import { MainComponent } from './features/landing/pages/main/main.component';

export const routes: Routes = [
    {
        path: '', component: LandingPageComponent, children: [
            { path: '', component: MainComponent },
            { path: 'gallery', component: GalleryComponent },
            { 
                path: 'voices/:id', 
                loadComponent: () => import('./features/landing/pages/voice/voice.component')
                    .then(m => m.VoiceComponent) 
            },
            {
                path: 'form',
                loadComponent: () => import('./features/landing/pages/form/form.component')
                    .then(m => m.FormComponent)
            },
            {
                path: 'about-us',
                loadComponent: () => import('./features/landing/pages/about-us/about-us.component')
                    .then(m => m.AboutUsComponent)
            },
        ]
    },
];