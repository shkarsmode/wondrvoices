import { Component, inject } from '@angular/core';
import { Meta, Title } from '@angular/platform-browser';

@Component({
    selector: 'app-about-us',
    standalone: true,
    imports: [],
    templateUrl: './about-us.component.html',
    styleUrl: './about-us.component.scss'
})
export class AboutUsComponent {
    private title = inject(Title);
    private meta = inject(Meta);

    constructor() {
        this.title.setTitle('About Us | Wondrvoices');
        this.meta.addTags([
            {
                name: 'description',
                content:
                    'Learn more about WondrVoices — a heartfelt platform where art, kindness, and voices bring comfort to patients fighting serious illnesses.'
            },
            { name: 'author', content: 'WondrVoices Team' },
            { name: 'robots', content: 'index, follow' },
            { property: 'og:title', content: 'About Us | WondrVoices' },
            {
                property: 'og:description',
                content:
                    'Discover the mission behind WondrVoices — how we connect people through creativity and hope for those in need.'
            },
            { property: 'og:type', content: 'website' },
            { property: 'og:url', content: 'https://wondrvoices.com/about' },
            // {
            //     property: 'og:image',
            //     content: 'https://wondrvoices.com/assets/og-preview.jpg'
            // },
            { name: 'twitter:card', content: 'summary_large_image' },
            { name: 'twitter:title', content: 'About Us | WondrVoices' },
            {
                name: 'twitter:description',
                content:
                    'Get to know the heart of WondrVoices — where art and compassion meet to uplift people through tough times.'
            },
            // {
            //     name: 'twitter:image',
            //     content: 'https://wondrvoices.com/assets/og-preview.jpg'
            // }
        ]);
    }

}
