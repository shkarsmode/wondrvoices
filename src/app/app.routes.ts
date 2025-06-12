import { Routes } from '@angular/router';
import { LandingPageComponent } from './features/landing/landing-page/landing-page.component';
import { GalleryComponent } from './features/landing/pages/gallery/gallery.component';
import { MainComponent } from './features/landing/pages/main/main.component';

export const routes: Routes = [
    {
        path: '', component: LandingPageComponent, children: [
            { path: '', component: MainComponent },
            { path: 'gallery', component: GalleryComponent },
        ]
    },
];