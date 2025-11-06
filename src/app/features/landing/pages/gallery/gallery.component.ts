import { AsyncPipe, DatePipe, DecimalPipe, isPlatformBrowser } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, ElementRef, HostListener, inject, OnInit, PLATFORM_ID, signal, ViewChild, WritableSignal } from '@angular/core';
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

type SharePlatform = 'twitter' | 'facebook' | 'linkedin';

const SHARE_ENDPOINTS: Record<SharePlatform, string> = {
    twitter: 'https://x.com/intent/tweet',
    facebook: 'https://www.facebook.com/sharer/sharer.php',
    linkedin: 'https://www.linkedin.com/sharing/share-offsite/'
};


@Component({
    selector: 'app-gallery',
    imports: [RouterModule, AutocompleteInputComponent, DecimalPipe, DatePipe, AsyncPipe],
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
    public voicesService = inject(VoicesService);
    private meta = inject(Meta);
    private router = inject(Router);
    private route = inject(ActivatedRoute);

    public totalCount = signal<number>(0);
    public brandLogoUrl = signal<string | null>(null);
    public venueDisplayName = signal<string | null>(null);

    private readonly venueLogos: Record<string, string> = {
        // normalized key
        'sarasota art museum': 'assets/img/sarasota1.webp',
        'clay center of st. petersburg': 'https://6788f567b4309c4670f2.cdn6.editmysite.com/uploads/b/6788f567b4309c4670f2b7c145c4fb914c292f426dae61fa6fa451ad1b125f8e/logo_CC_retang_1738098796.png?width=2400&optimize=medium',
        'blue raven full moon market': 'assets/img/blue-raven.webp',
        'bo diddley plaza': 'assets/img/bo.webp',
        'wonderworks gulfport': 'assets/img/wonderworks.webp',
        'the dog bar': 'assets/img/dog-bar.webp',
        'pinellas technical college': 'assets/img/ptc.webp',
        'hill city tap house': 'assets/img/hill-city.webp',
        'gulfport food forest': 'assets/img/food-forest.webp',
        'gulfport farmers market': 'assets/img/farmers-market.webp',
        'gulfport art walk': 'assets/img/art-walk.webp',
        'daystar life': 'assets/img/daystar.webp',
        'davita st petersburg south dialysis': 'assets/img/davita.webp',
        'cohatch': 'assets/img/cohatch.webp',
        'brooksville farmers market': 'assets/img/brooksville.webp',
    };
    
    // Track latest updatedAt among current items
    public lastUpdated = signal<Date | null>(null);

    // Mini header stickiness
    public isMiniHeaderVisible = signal<boolean>(false);
    

    public cards = signal<IVoice[]>([]);

    public pageSize = 50;
    public page = signal(1);
    public isFetchingMore = signal(false);
    public hasMore = signal(true);
    private observer?: IntersectionObserver;

    isShareOptionsOpen = signal(false);
    @ViewChild('sharePopover', { read: ElementRef })
    private sharePopoverRef?: ElementRef<HTMLElement>;

    public isLoading: WritableSignal<boolean> = signal(false);

    @ViewChild('sentinel', { static: true }) sentinelRef?: ElementRef<HTMLElement>;

    // ---- Query params → Filters + tab ----
    private queryParams = signal(this.route.snapshot.queryParamMap);
    platformId = inject(PLATFORM_ID);

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

        const description = 'Explore heartfelt cards, creative art, and inspiring words from people who care. Every message is a reminder that you’re never alone on your journey.';
        const title = 'Gallery | Wondrvoices';

        this.title.setTitle(title);
        this.meta.updateTag({ name: 'description', content: description });
        this.meta.updateTag({ property: 'og:title', content: title });
        this.meta.updateTag({ property: 'og:description', content: description });
        this.meta.updateTag({ property: 'twitter:title', content: title });
        this.meta.updateTag({ property: 'twitter:description', content: description });
        this.meta.updateTag({ name: 'twitter:card', content: 'summary_large_image' });

        // init venue visuals from query
        const credit = this.filters().creditTo || null;
        this.venueDisplayName.set(credit);

        this.brandLogoUrl.set(this.venueLogos[this.normalizeVenueKey(credit)] || null);

        if (typeof window !== 'undefined') {
            this.loadPage(1, true);
        }

        this.route.queryParamMap.subscribe(() => {
            if (!this.isLoading()) {
                // update venue visuals when query changes
                const updatedCredit = this.filters().creditTo || null;
                this.venueDisplayName.set(updatedCredit);
                this.afterVenueContextChanged();
                this.brandLogoUrl.set(this.venueLogos[this.normalizeVenueKey(updatedCredit)] || null);

                this.page.set(1);
                this.hasMore.set(true);
                this.cards.set([]);
                this.loadPage(1, true);
            }
        });

        this.afterVenueContextChanged();
    }

    private updateVenueMeta(fallbackFirstImage?: string | null): void {
        const venue = this.venueDisplayName() || this.filters().creditTo || 'Gallery';
        const total = this.totalCount();
        const image = this.brandLogoUrl() || fallbackFirstImage || null;
    
        const metaTitle = `${venue} • ${total > 0 ? total + ' cards • ' : ''}Wondrvoices`;
        const metaDesc = `Explore cards from ${venue}. Curated messages and art from our community.`;
    
        this.title.setTitle(metaTitle);
        this.meta.updateTag({ property: 'og:title', content: metaTitle });
        this.meta.updateTag({ property: 'twitter:title', content: metaTitle });
        this.meta.updateTag({ name: 'description', content: metaDesc });
        this.meta.updateTag({ property: 'og:description', content: metaDesc });
        this.meta.updateTag({ property: 'twitter:description', content: metaDesc });
    
        const fallback = 'https://play-lh.googleusercontent.com/ieK2B2z7PLxd1UQJ6flvxYRiX8hXPs_8Xs3yPdL4YqIVo5puOZOFUb-4y3AqeT3LyF3RMalHT5mPKdnoYctsfA=w2560-h1440-rw';
        const finalImage = image || fallback;
    
        this.meta.updateTag({ property: 'og:image', content: finalImage });
        this.meta.updateTag({ property: 'og:image:secure_url', content: finalImage });
        this.meta.updateTag({ property: 'og:image:alt', content: `${venue} cover` });
        this.meta.updateTag({ name: 'twitter:image', content: finalImage });
    }
    
    @HostListener('window:scroll')
    onWindowScroll(): void {
        if (!this.hasAnyFilter()) {
            this.isMiniHeaderVisible.set(false);
            return;
        }
        const y = (typeof window !== 'undefined') ? window.scrollY : 0;
        this.isMiniHeaderVisible.set(y > 250);
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

    toggleShareOptions(): void {
        this.isShareOptionsOpen.update((state) => !state);
    }

    onShareTriggerKeydown(event: KeyboardEvent): void {
        if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            this.toggleShareOptions();
        }
        if (event.key === 'Escape' && this.isShareOptionsOpen()) {
            this.isShareOptionsOpen.set(false);
        }
    }

    @HostListener('document:click', ['$event'])
    onDocumentClick(event: MouseEvent): void {
        const chips = document.querySelector('.autocomplete-chips') as HTMLDivElement;
        const autocomplete = document.querySelector('w-autocomplete > div') as HTMLDivElement;

        if (
            chips &&
            !chips.contains(event.target as HTMLDivElement) && 
            autocomplete &&
            !autocomplete.contains(event.target as HTMLDivElement)

        ) {
            this.onAutocompleteBlur();
        }

        if (!this.isShareOptionsOpen()) return;

        const popover = this.sharePopoverRef?.nativeElement;
        const target = event.target as Node | null;
        const clickedInside = popover?.contains(target as Node) ||
            (event.composedPath && event.composedPath().some((n) =>
                (n as HTMLElement)?.classList?.contains('share-trigger')));

        if (!clickedInside) {
            this.isShareOptionsOpen.set(false);
        }
    }

    // Close on Escape when focus is within popover
    @HostListener('document:keydown', ['$event'])
    onEscapeClose(event: KeyboardEvent): void {
        if (event.key === 'Escape' && this.isShareOptionsOpen()) {
            this.isShareOptionsOpen.set(false);
        }
    }

    public shareNative(): void {
        if (!isPlatformBrowser(this.platformId)) return;
        const url = window.location.href;
        if ('share' in navigator) {
            navigator.share({
                url
            }).catch(() => { });
        }
    }


    // Reuse your existing copy logic, but keep popover UX tight
    copyFromPopover(): void {
        this.copyLink(); // your existing method
        // Keep popover open briefly so user sees "Copied" state; auto-close feels snappier:
        setTimeout(() => this.isShareOptionsOpen.set(false), 700);
    }

    public isCopied = signal<boolean>(false);
    public async copyLink(): Promise<void> {
        const url = window.location.href;
        const copied = await this.tryCopy(url);
        this.isCopied.set(copied);
        setTimeout(() => this.isCopied.set(false), 1800);
    }

    public buildShareLink(platform: SharePlatform): string {
        switch (platform) {
            case 'twitter': {
                const params = new URLSearchParams({ url: window.location.href, via: 'Wondrlnk' });
                return `${SHARE_ENDPOINTS.twitter}?${params.toString()}`;
            }
            case 'facebook': {
                const params = new URLSearchParams({ u: window.location.href, });
                return `${SHARE_ENDPOINTS.facebook}?${params.toString()}`;
            }
            case 'linkedin': {
                const params = new URLSearchParams({ url: window.location.href, });
                return `${SHARE_ENDPOINTS.linkedin}?${params.toString()}`;
            }
            default:
                return window.location.href;
        }
    }
    
    private async tryCopy(text: string): Promise<boolean> {
        if (isPlatformBrowser(this.platformId) && navigator?.clipboard?.writeText) {
            try {
                await navigator.clipboard.writeText(text);
                return true;
            } catch { /* fallback below */ }
        }
        try {
            const textarea = document.createElement('textarea');
            textarea.value = text;
            textarea.setAttribute('readonly', '');
            textarea.style.position = 'fixed';
            textarea.style.opacity = '0';
            textarea.style.pointerEvents = 'none';
            document.body.appendChild(textarea);
            textarea.select();
            const ok = document.execCommand('copy');
            document.body.removeChild(textarea);
            return ok;
        } catch {
            return false;
        }
    }


    private buildCanonicalVoiceUrl(id: number): string {
        const path = `voices/${id}`;
        if (isPlatformBrowser(this.platformId) && typeof window !== 'undefined') {
            const origin = 'https://www.wondrvoices.com';
            return `${origin}/${path}`;
        }
        return `https://www.wondrvoices.com/${path}`;
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
        if (this.isSearchActive() && !this.hasAnyFilter()) 
            setTimeout(() => this.toggleSearch(), 150);
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
                    return of({ items: [] as IVoice[], total: 0 });
                })
            )
            .subscribe(({ items, total }) => {
                const newItems = Array.isArray(items) ? items : [];
                const firstImage = newItems?.[0]?.img || this.cards()?.[0]?.img || null;

                if (newItems.length) {
                    const isoDates = newItems
                        .map(v => v.createdAt)
                        .filter(Boolean)
                        .map(s => new Date(s as any).getTime());
                    const maxTs = Math.max(...isoDates);
                    if (Number.isFinite(maxTs)) this.lastUpdated.set(new Date(maxTs));
                }

                
                if (initial) {
                    this.cards.set(newItems);
                    // setTimeout(() => this.isMiniHeaderVisible.set(true), 200);
                } else {
                    const map = new Map<number, IVoice>();
                    for (const c of this.cards()) map.set(c.id, c);
                    for (const n of newItems) map.set(n.id, n);
                    this.cards.set(Array.from(map.values()));
                }
    
                // total comes from API (see screenshot #2)
                this.totalCount.set(typeof total === 'number' ? total : this.totalCount());
    
                // refresh meta after we know total and have an image fallback
                if (initial) {
                    this.updateVenueMeta(firstImage);
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
        this.clearAllFilters();
        
        tab = this.deslugify(tab);
        this.activeTab.set(tab);

        this.router.navigate([], {
            queryParams: { tab: this.slugify(tab) },
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
        console.log(filter);
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

    private normalizeVenueKey(value?: string | null): string {
        return (value || '').trim().toLowerCase();
    }

    private afterVenueContextChanged(): void {
        // show skeleton until data arrives
        this.isMiniHeaderVisible.set(false);
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