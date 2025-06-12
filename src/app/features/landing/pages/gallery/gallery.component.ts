import { Component, computed, signal } from '@angular/core';

interface VoiceCard {
    image: string;
    category: string;
    title: string;
    description: string;
    author: string;
    date: string;
    avatar: string;
}


@Component({
    selector: 'app-gallery',
    standalone: true,
    imports: [],
    templateUrl: './gallery.component.html',
    styleUrl: './gallery.component.scss'
})
export class GalleryComponent {
    public tabs = ['All', 'Art by kids', 'Voices', 'Videos'];
    public activeTab = signal<string>('All');

    private allCards: VoiceCard[] = [
        {
            image: 'assets/voices/1.jpg',
            category: 'ART',
            title: 'Bright colors, brighter spirits',
            description: 'A joyful drawing sent to bring a smile and a little extra hope to someone’s day.',
            author: 'Alex Rivera',
            date: 'Apr 12',
            avatar: 'https://emedia1.nhs.wales/HEIW2/cache/file/F4C33EF0-69EE-4445-94018B01ADCF6FD4.png'
        },
        {
            image: 'assets/voices/2.jpg',
            category: 'ART',
            title: 'Sunshine on paper',
            description: 'A child’s painting, full of warmth and encouragement, sent with love to someone in need.',
            author: 'Taylor Brooks',
            date: 'Mar 28',
            avatar: 'https://emedia1.nhs.wales/HEIW2/cache/file/F4C33EF0-69EE-4445-94018B01ADCF6FD4.png'
        },
        {
            image: 'assets/voices/3.jpg',
            category: 'ART BY KIDS',
            title: 'Community Health Fuctury',
            description: 'Something inspiring and colorful about community support and wellness.',
            author: 'David M.',
            date: 'Apr 5',
            avatar: 'https://emedia1.nhs.wales/HEIW2/cache/file/F4C33EF0-69EE-4445-94018B01ADCF6FD4.png'
        },
        {
            image: 'assets/voices/4.jpg',
            category: 'VOICES',
            title: 'Community Health Fuctury',
            description: 'Something inspiring and colorful about community support and wellness.',
            author: 'Lena M.',
            date: 'Mar 20',
            avatar: 'https://emedia1.nhs.wales/HEIW2/cache/file/F4C33EF0-69EE-4445-94018B01ADCF6FD4.png'
        },
        {
            image: 'assets/voices/5.jpg',
            category: 'VOICES',
            title: 'Community Health Fuctury',
            description: 'Something inspiring and colorful about community support and wellness.',
            author: 'Lena M.',
            date: 'Mar 20',
            avatar: 'https://emedia1.nhs.wales/HEIW2/cache/file/F4C33EF0-69EE-4445-94018B01ADCF6FD4.png'
        },
        {
            image: 'assets/voices/6.jpg',
            category: 'ART BY KIDS',
            title: 'Community Health Fuctury',
            description: 'Something inspiring and colorful about community support and wellness.',
            author: 'David M.',
            date: 'Apr 5',
            avatar: 'https://emedia1.nhs.wales/HEIW2/cache/file/F4C33EF0-69EE-4445-94018B01ADCF6FD4.png'
        },
        {
            image: 'assets/voices/7.jpg',
            category: 'ART',
            title: 'Bright colors, brighter spirits',
            description: 'A joyful drawing sent to bring a smile and a little extra hope to someone’s day.',
            author: 'Alex Rivera',
            date: 'Apr 12',
            avatar: 'https://emedia1.nhs.wales/HEIW2/cache/file/F4C33EF0-69EE-4445-94018B01ADCF6FD4.png'
        },
        {
            image: 'assets/voices/8.jpg',
            category: 'VIDEOS',
            title: 'Community Health Fuctury',
            description: 'Something inspiring and colorful about community support and wellness.',
            author: 'David M.',
            date: 'Apr 5',
            avatar: 'https://emedia1.nhs.wales/HEIW2/cache/file/F4C33EF0-69EE-4445-94018B01ADCF6FD4.png'
        },
    ];

    public cards = signal<VoiceCard[]>(this.allCards);

    public filteredCards = computed(() => {
        const tab = this.activeTab();
        if (tab === 'All') return this.cards();
        return this.cards().filter(card => card.category === tab.toUpperCase());
    });

    public selectTab(tab: string) {
        this.activeTab.set('');
        setTimeout(() => {
            this.activeTab.set(tab);
        });
    }
}
