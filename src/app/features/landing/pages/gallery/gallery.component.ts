import { JsonPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, OnInit, signal, WritableSignal } from '@angular/core';
import { Meta, Title } from '@angular/platform-browser';
import { Router, RouterModule } from '@angular/router';
import { first } from 'rxjs';
import { VoicesService } from 'src/app/shared/services/voices.service';
import { IVoice } from 'src/app/shared/types/voices';



@Component({
    selector: 'app-gallery',
    standalone: true,
    imports: [RouterModule, JsonPipe],
    templateUrl: './gallery.component.html',
    styleUrl: './gallery.component.scss',
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class GalleryComponent implements OnInit {
    // public tabs = Object.keys(HIGH_LEVEL_TAGS_MAP).map(this.deslugify);
    public tabs: string[] = [];
    public activeTab = signal<string>('All');

    private title = inject(Title);
    private voicesService = inject(VoicesService);
    private meta = inject(Meta);

    public cards = signal<IVoice[]>([]);

    private router: Router = inject(Router);

    public filteredCards = computed(() => {
        const tab = this.activeTab();
        if (tab === 'All') return this.cards();

        const includedTags = HIGH_LEVEL_TAGS_MAP[this.slugify(tab)].map(tag => tag.toLowerCase());
        return this.cards().filter(
            card => card.what?.some(tag => includedTags.includes(tag.toLowerCase())) || 
            card.express?.some(tag => includedTags.includes(tag.toLowerCase()))
        );
    });

    public isLoading: WritableSignal<boolean> = signal(true);


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

        if (typeof window !== 'undefined') {
            this.getApprovedVoices();
        }
    }

    private getApprovedVoices(): void {
        this.voicesService.getApprovedVoices(100, 1)
            .pipe(first())
            .subscribe(({ items }) => {
                this.cards.set(items);
                this.isLoading.set(false);

                const cardsTags = Array.from(new Set(this.cards().flatMap(
                    ({ what, express }) => [...(what || []), ...(express || [])]
                ))).map(tag => this.deslugify(tag.toLowerCase()));

                this.tabs = Object.keys(HIGH_LEVEL_TAGS_MAP).filter(highLevelTag => {
                    const tags = HIGH_LEVEL_TAGS_MAP[highLevelTag];
                    return tags.some(
                        tag =>
                            cardsTags.includes(this.deslugify(tag.toLowerCase()))
                    ) || tags.length === 0
                }).map(this.deslugify);
            });
    }

    public selectTab(tab: string) {
        this.activeTab.set(tab);
    }

    public openVoicePage(id: number): void {
        this.router.navigateByUrl('voices/' + id);
    }

    public deslugify(slug: string): string {
        return String(slug)
            .split("_")
            .filter(Boolean)
            .map(word => word.charAt(0).toUpperCase() + word.slice(1))
            .join(" ");
    }

    public slugify(label: string): string {
        return String(label)
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, "_")
            .replace(/^_+|_+$/g, "");
    }
}

const HIGH_LEVEL_TAGS_MAP: { [key: string]: string[] } = {
    all:              [],
    visual:           ["drawing", "painting", "photo", "kids_art"],
    writing:          ["letter", "poem", "quote"],
    spirit:           ["prayer", "wish", "faith", "gratitude"],
    heart_positivity: ["love", "peace", "hope", "joy", "friendship", "connection", "encouragement", "compassion"],
    recovery:         ["strength", "resilience", "healing", "support"],
    comfort_memory:   ["comfort", "grief", "memory", "thought"],
    nature_other:     ["nature", "pet", "other"],
};