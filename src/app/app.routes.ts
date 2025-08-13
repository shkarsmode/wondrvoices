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
                path: 'submit',
                loadComponent: () => import('./features/landing/pages/form/form.component')
                    .then(m => m.FormComponent)
            },
            {
                path: 'about-us',
                loadComponent: () => import('./features/landing/pages/about-us/about-us.component')
                    .then(m => m.AboutUsComponent)
            },
            {
                path: 'get-involved',
                loadComponent: () => import('./features/landing/pages/get-involved/get-involved.component')
                    .then(m => m.GetInvolvedComponent)
            },
            {
                path: 'spots',
                loadComponent: () => import('./features/landing/pages/spots/spots.component')
                    .then(m => m.SpotsComponent)
            },
            {
                path: 'blog',
                loadComponent: () => import('./features/landing/pages/blog/blog.component')
                    .then(m => m.BlogComponent)
            },
            {
                path: 'blogs/:id', 
                loadComponent: () => import('./features/landing/pages/post/post.component')
                    .then(m => m.PostComponent) 
            },
            {
                path: 'terms',
                loadComponent: () => import('./features/landing/pages/terms/terms.component')
                    .then(m => m.TermsComponent)
            },
            {
                path: 'privacy',
                loadComponent: () => import('./features/landing/pages/privacy/privacy.component')
                    .then(m => m.PrivacyComponent)
            }
        ]
    },
];