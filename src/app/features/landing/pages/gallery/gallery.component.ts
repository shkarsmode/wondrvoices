import { ChangeDetectionStrategy, Component, computed, inject, OnInit, signal } from '@angular/core';
import { Meta, Title } from '@angular/platform-browser';
import { Router, RouterModule } from '@angular/router';
import { voices } from '../../../../shared/data/voices';

export interface VoiceCard {
    id: number;
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
    imports: [RouterModule],
    templateUrl: './gallery.component.html',
    styleUrl: './gallery.component.scss',
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class GalleryComponent implements OnInit {
    public tabs = ['All', 'Art by kids', 'Voices', 'Letter'];
    public activeTab = signal<string>('All');

    private title = inject(Title);
    private meta = inject(Meta);

    private allCards: VoiceCard[] = voices.sort(() => Math.random() - 0.5);

    public cards = signal<VoiceCard[]>(this.allCards);

    private router: Router = inject(Router);

    public filteredCards = computed(() => {
        const tab = this.activeTab();
        if (tab === 'All') return this.cards();
        return this.cards().filter(card => card.category === tab.toUpperCase());
    });

    public ngOnInit(): void {
        const description = 'Explore heartfelt cards, creative art, and inspiring words from people who care. Every message is a reminder that you’re never alone on your journey.'

        const title = 'Messages and moments that lift us up';

        this.title.setTitle('Gallery | Wondrvoices');
        this.meta.updateTag({ name: 'description', content: description });
        this.meta.updateTag({ property: 'og:title', content: title });
        this.meta.updateTag({ property: 'og:description', content: description });
        // this.meta.updateTag({ property: 'og:image', content: this.card.image });
        // this.meta.updateTag({ property: 'og:image:alt', content: this.card.image });
        this.meta.updateTag({ property: 'twitter:title', content: title });
        this.meta.updateTag({ property: 'twitter:description', content: description });
        // this.meta.updateTag({ property: 'twitter:image', content: this.card.image });
        this.meta.updateTag({ name: 'twitter:card', content: 'summary_large_image' });
    }

    public selectTab(tab: string) {
        this.activeTab.set('');
        setTimeout(() => {
            this.activeTab.set(tab);
        });
    }

    public openVoicePage(id: number): void {
        this.router.navigateByUrl('voices/' + id);
    }
}
