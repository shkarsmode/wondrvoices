import { JsonPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, ElementRef, inject, OnInit, signal, ViewChild, WritableSignal } from '@angular/core';
import { Meta, Title } from '@angular/platform-browser';
import { Router, RouterModule } from '@angular/router';
import { catchError, first, of } from 'rxjs';
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

    public pageSize = 24;
    public page = signal(1);
    public isFetchingMore = signal(false);
    public hasMore = signal(true);
    private observer?: IntersectionObserver;

    public filteredCards = computed(() => {
        const tab = this.activeTab();
        if (tab === 'All') return this.cards();

        const tags = HIGH_LEVEL_TAGS_MAP[this.slugify(tab)]
        let helperFn = (tag: string) => 
            tags.map(tag => tag.toLowerCase()).includes(tag.toLowerCase());

        if (!tags) {
            helperFn = (tag: string) => tag.toLowerCase() === tab.toLowerCase();
        }
        
        return this.cards().filter(
            card => card.what?.some(helperFn) || card.express?.some(helperFn)
        );
    });

    public isLoading: WritableSignal<boolean> = signal(true);

    @ViewChild('sentinel', { static: true }) sentinelRef?: ElementRef<HTMLElement>;


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
            this.loadPage(1, true);
        }
    }

    public ngAfterViewInit(): void {
        if (typeof window === 'undefined') return;

        this.observer = new IntersectionObserver(
            entries => {
                const entry = entries[0];

                if (!entry?.isIntersecting) return;

                if (this.hasMore() && !this.isFetchingMore() && !this.isLoading()) {
                    this.loadPage(this.page() + 1, false);
                }
            },
            {
                root: null,
                rootMargin: '400px 0px',
                threshold: 0,
            },
        );
    }

    private loadPage(nextPage: number, initial: boolean): void {
        if (initial) this.isLoading.set(true);
        else this.isFetchingMore.set(true);

        this.voicesService
            .getApprovedVoices(this.pageSize, nextPage)
            .pipe(
                first(),
                catchError((err) => {
                    console.error('getApprovedVoices error', err);
                    if (err?.status === 404 || err?.status === 204) {
                        this.hasMore.set(false);
                    }
                    return of({ items: [] as IVoice[] });
                }),
            )
            .subscribe(({ items }) => {
                const newItems = Array.isArray(items) ? items : [];

                if (initial) {
                    this.cards.set(newItems);
                } else {
                    const map = new Map<number, IVoice>();
                    for (const c of this.cards()) map.set(c.id, c);
                    for (const n of newItems) map.set(n.id, n);
                    this.cards.set(Array.from(map.values()));
                }

                this.page.set(nextPage);
                this.hasMore.set(newItems.length >= this.pageSize);
                this.isLoading.set(false);
                this.isFetchingMore.set(false);

                if (initial) {
                    setTimeout(() => {
                        const el = document.querySelector('.sentinel')
                        if (el) this.observer?.observe(el);
                    }, 1000);


                    const cardsTags = Array.from(
                        new Set(
                            this.cards().flatMap(({ what, express }) => [...(what || []), ...(express || [])]),
                        ),
                    ).map(tag => this.deslugify(tag.toLowerCase()));

                    this.tabs = Object.keys(HIGH_LEVEL_TAGS_MAP)
                        .filter(highLevelTag => {
                            const tags = HIGH_LEVEL_TAGS_MAP[highLevelTag];
                            return (
                                tags.some(tag => cardsTags.includes(this.deslugify(tag.toLowerCase()))) ||
                                tags.length === 0
                            );
                        })
                        .map(this.deslugify);
                }
            });
    }

    public selectTab(tab: string) {
        tab = this.deslugify(tab);
        if (!this.tabs.includes(tab)) {
            this.tabs = this.tabs.slice(0, 6);
            this.tabs.push(tab);
        }
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

    public ngOnDestroy(): void {
        this.observer?.disconnect();
    }
}

const HIGH_LEVEL_TAGS_MAP: { [key: string]: string[] } = {
    all: [],
    art: ["drawing", "painting", "kids_art", "art"],
    words: ["letter", "poem", "quote", "memory"],
    kids: ["kids", "kids_art", "love", "peace", "joy"],
    photo: ["photo"],
    
    // spirit: ["prayer", "wish", "faith", "gratitude"],
    // heart_positivity: ["love", "peace", "hope", "joy", "friendship", "connection", "encouragement", "compassion"],
    // recovery: ["strength", "resilience", "healing", "support"],
    // comfort_memory: ["comfort", "grief", "memory", "thought"],
    // nature_other: ["nature", "pet", "other"],
};