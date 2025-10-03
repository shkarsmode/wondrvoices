import { JsonPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, ElementRef, inject, OnInit, signal, ViewChild, WritableSignal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Meta, Title } from '@angular/platform-browser';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { catchError, first, of } from 'rxjs';
import { VoicesService } from 'src/app/shared/services/voices.service';
import { IVoice } from 'src/app/shared/types/voices';
import { AutocompleteInputComponent } from '../../components/autocomplete-input/autocomplete-input.component';

type Filters = {
    location?: string;
    description?: string;
    creditTo?: string;
    tags?: string[];
    tab?: string;
    tagsMode?: 'any' | 'all';
};

@Component({
    selector: 'app-gallery',
    standalone: true,
    imports: [RouterModule, JsonPipe, AutocompleteInputComponent],
    templateUrl: './gallery.component.html',
    styleUrl: './gallery.component.scss',
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class GalleryComponent implements OnInit {
    public tabs: string[] = [];
    public activeTab = signal<string>('All');
    public tabCounts = signal<Record<string, number>>({});
    public isSearchActive = signal<boolean>(false);

    readonly activeImageId = signal<number | null>(null);
    readonly computedViewImg = (id: number) => `img-voice-${id}`;
    readonly computedViewTitle = (id: number) => `img-title-${id}`;
    readonly computedViewTag = (id: number) => `img-tag-${id}`;

    private title = inject(Title);
    private voicesService = inject(VoicesService);
    private meta = inject(Meta);
    private router = inject(Router);
    private route = inject(ActivatedRoute);

    public cards = signal<IVoice[]>([]);

    public pageSize = 50;
    public page = signal(1);
    public isFetchingMore = signal(false);
    public hasMore = signal(true);
    private observer?: IntersectionObserver;

    public isLoading: WritableSignal<boolean> = signal(false);

    @ViewChild('sentinel', { static: true }) sentinelRef?: ElementRef<HTMLElement>;

    // ---- Query params → Filters + tab ----
    private queryParams = signal(this.route.snapshot.queryParamMap);
    constructor() {
        this.route.queryParamMap.pipe(takeUntilDestroyed()).subscribe((m) => this.queryParams.set(m));
    }

    public filters = computed<Filters>(() => {
        const m = this.queryParams();
        const location = m.get('location') ?? undefined;
        const description = m.get('description') ?? undefined;
        const creditTo = m.get('creditTo') ?? undefined;
        const tagsCsv = m.get('tags') ?? '';
        const tags = tagsCsv ? tagsCsv.split(',').map(s => s.trim()).filter(Boolean) : undefined;
        const tab = this.deslugify(m.get('tab') ?? '') || undefined;
        const tagsMode = (m.get('tagsMode') as 'any' | 'all') || 'any';

        if (tab) setTimeout(() => this.activeTab.set(tab));

        return { location, description, creditTo, tags, tab, tagsMode };
    });

    public hasAnyFilter = computed(() => {
        const f = this.filters();
        f.tab = f.tab === 'All' ? undefined : f.tab;
        return Boolean(f.location || f.description || f.creditTo || (f.tags && f.tags.length) || f.tab);
    });

    public ngOnInit(): void {
        this.tabs = Object.keys(HIGH_LEVEL_TAGS_MAP).map(this.deslugify);

        const description = 'Explore heartfelt cards, creative art, and inspiring words from people who care. Every message is a reminder that you’re never alone on your journey.'
        const title = 'Messages and moments that lift us up';

        this.title.setTitle('Gallery | Wondrvoices');
        this.meta.updateTag({ name: 'description', content: description });
        this.meta.updateTag({ property: 'og:title', content: title });
        this.meta.updateTag({ property: 'og:description', content: description });
        this.meta.updateTag({ property: 'twitter:title', content: title });
        this.meta.updateTag({ property: 'twitter:description', content: description });
        this.meta.updateTag({ name: 'twitter:card', content: 'summary_large_image' });

        if (typeof window !== 'undefined') {
            this.loadPage(1, true);
        }

        this.route.queryParamMap.subscribe(() => {
            if (!this.isLoading()) {
                this.page.set(1);
                this.hasMore.set(true);
                this.cards.set([]);
                this.loadPage(1, true);
            }
        });
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


    public toggleSearch(state?: boolean): void {
        if (state !== undefined) {
            this.isSearchActive.set(state);
            return;
        }
        this.isSearchActive.set(!this.isSearchActive());
    }

    public onAutocompleteClick(): void {
        if (!this.isSearchActive()) this.toggleSearch();
    }

    public onAutocompleteBlur(): void {
        if (this.isSearchActive() && !this.hasAnyFilter()) this.toggleSearch();
    }

    private loadPage(nextPage: number, initial: boolean): void {
        const f = this.filters();

        if (initial) this.isLoading.set(true);
        else this.isFetchingMore.set(true);

        this.voicesService
            .getApprovedVoices(this.pageSize, {
                location: f.location,
                description: f.description,
                creditTo: f.creditTo,
                tags: f.tags,
                tab: f.tab ? this.slugify(f.tab) : undefined,
                tagsMode: f.tagsMode ?? 'any',
                orderBy: 'createdAt',
                orderDir: 'DESC',
                page: nextPage
            })
            .pipe(
                first(),
                catchError((err) => {
                    console.error('getApprovedVoices error', err);
                    if (err?.status === 404 || err?.status === 204) this.hasMore.set(false);
                    return of({ items: [] as IVoice[] });
                })
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

                if (initial && typeof window !== 'undefined') {
                    setTimeout(() => {
                        const el = document.querySelector('.sentinel');
                        if (el) this.observer?.observe(el);
                    }, 200);
                }
            });
    }

    public selectTab(tab: string) {
        tab = this.deslugify(tab);
        this.activeTab.set(tab);

        this.router.navigate([], {
            relativeTo: this.route,
            queryParams: { tab: this.slugify(tab) },
            queryParamsHandling: 'merge',
            replaceUrl: true,
        });
    }

    public mouseEnterCard(id: number): void {
        this.activeImageId.set(id);
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

    // ---- chips actions ----
    public removeFilter(key: keyof Filters): void {
        const qp = { ...this.route.snapshot.queryParams };
        delete qp[key as string];
        this.router.navigate([], { relativeTo: this.route, queryParams: qp, replaceUrl: true });
    }

    public setQueryPatch(patch: Record<string, string | undefined>) {
        const qp = { ...this.route.snapshot.queryParams, ...patch };
        Object.keys(qp).forEach(k => qp[k] === undefined && delete qp[k]);
        this.router.navigate([], { relativeTo: this.route, queryParams: qp, replaceUrl: true });
    }

    public toggleTagsMode() {
        const current = this.filters().tagsMode ?? 'any';
        const next: 'any' | 'all' = current === 'any' ? 'all' : 'any';
        this.setQueryPatch({ tagsMode: next });
    }

    public addTag(tag: string) {
        tag = this.slugify(tag);
        const list = new Set(this.filters().tags ?? []);
        list.add(tag);
        this.setQueryPatch({ tags: Array.from(list).join(',') });
    }

    private timeoutId?: NodeJS.Timeout;

    public applyTextFilter(
        filter: { key: 'location' | 'creditTo' | 'tab', value: string }
    ) {
        const qp = { [filter.key]: filter.value };

        if (this.timeoutId) {
            clearTimeout(this.timeoutId);
        } else {
            // Leading call
            this.setQueryPatch(qp);
        }

        this.timeoutId = setTimeout(() => {
            // Trailing call
            this.setQueryPatch(qp);
            this.timeoutId = undefined;
        }, 500); // Adjust the delay as needed
    }

    public clearAllFilters(): void {
        const qp = { ...this.route.snapshot.queryParams };
        delete qp['location']; delete qp['description']; delete qp['creditTo'];
        delete qp['tabs']; delete qp['tagsMode']; delete qp['tab'];
        this.router.navigate([], { relativeTo: this.route, queryParams: qp, replaceUrl: true });
        this.toggleSearch(false);
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
};