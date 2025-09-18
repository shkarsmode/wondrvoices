import { JsonPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, ElementRef, inject, OnInit, signal, ViewChild, WritableSignal } from '@angular/core';
import { Meta, Title } from '@angular/platform-browser';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { catchError, first, of } from 'rxjs';
import { VoicesService } from 'src/app/shared/services/voices.service';
import { IVoice } from 'src/app/shared/types/voices';

type Filters = {
    title?: string;
    description?: string;
    creditTo?: string;
    tags?: string[]; // CSV → array
};

@Component({
    selector: 'app-gallery',
    standalone: true,
    imports: [RouterModule, JsonPipe],
    templateUrl: './gallery.component.html',
    styleUrl: './gallery.component.scss',
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class GalleryComponent implements OnInit {
    public tabs: string[] = [];
    public activeTab = signal<string>('All');

    private title = inject(Title);
    private voicesService = inject(VoicesService);
    private meta = inject(Meta);
    private router = inject(Router);
    private route = inject(ActivatedRoute);

    public cards = signal<IVoice[]>([]);

    public pageSize = 24;
    public page = signal(1);
    public isFetchingMore = signal(false);
    public hasMore = signal(true);
    private observer?: IntersectionObserver;

    public isLoading: WritableSignal<boolean> = signal(true);

    @ViewChild('sentinel', { static: true }) sentinelRef?: ElementRef<HTMLElement>;

    // ---- Query params → Filters + tab ----
    private queryParams = signal(this.route.snapshot.queryParamMap);
    constructor() {
        // Подпишемся один раз на изменения query params
        this.route.queryParamMap.subscribe((m) => this.queryParams.set(m));
    }

    public filters = computed<Filters>(() => {
        const m = this.queryParams();
        const title = m.get('title') ?? undefined;
        const description = m.get('description') ?? undefined;
        const creditTo = m.get('creditTo') ?? undefined;
        // const tabs = m.get('tab') ?? '';
        // const tags = tabs
        //     ? tabs.split(',').map(s => s.trim()).filter(Boolean)
        //     : undefined;

        const tab = this.deslugify(m.get('tab') ?? '');
        if (tab) {
            if (!this.tabs.includes(tab)) {
                setTimeout(() => {
                    this.tabs.push(tab);
                });
            }
            setTimeout(() => {
                this.activeTab.set(tab);
            });
        }

        return { title, description, creditTo };
    });

    public hasAnyFilter = computed(() => {
        const f = this.filters();
        return Boolean(f.title || f.description || f.creditTo || (f.tags && f.tags.length));
    });

    public filteredCards = computed(() => {
        const tab = this.activeTab();
        const f = this.filters();
        const all = this.cards();

        // 1) фильтр по табу
        const tagsFromTab = HIGH_LEVEL_TAGS_MAP[this.slugify(tab)];
        let matchByTab = (t: string) => true;
        if (tab !== 'All') {
            if (tagsFromTab && tagsFromTab.length) {
                const set = new Set(tagsFromTab.map(x => x.toLowerCase()));
                matchByTab = (t: string) => set.has(String(t).toLowerCase());
            } else {
                matchByTab = (t: string) => String(t).toLowerCase() === tab.toLowerCase();
            }
        }

        const byTab = tab === 'All'
            ? all
            : all.filter(c =>
                (c.what?.some(matchByTab) || c.express?.some(matchByTab) || (c.category && matchByTab(c.category)))
            );

        return byTab.filter(c => {
            if (f.title) {
                const needle = f.title.toLowerCase();
                if (!String(c.location ?? '').toLowerCase().includes(needle)) return false;
            }
            if (f.description) {
                const needle = f.description.toLowerCase();
                if (!String(c.note ?? '').toLowerCase().includes(needle)) return false;
            }
            if (f.creditTo) {
                const needle = f.creditTo.toLowerCase();
                if (!String(c.creditTo ?? '').toLowerCase().includes(needle)) return false;
            }
            return true;
        });
    });

    public ngOnInit(): void {
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
                            this.cards().flatMap(({ category, what, express }) => [
                                ...(category ? [category] : []),
                                ...(what || []),
                                ...(express || []),
                            ]),
                        ),
                    ).map(tag => this.deslugify(String(tag).toLowerCase()));

                    this.tabs = Object.keys(HIGH_LEVEL_TAGS_MAP)
                        .filter(highLevelTag => {
                            const tags = HIGH_LEVEL_TAGS_MAP[highLevelTag];
                            return (
                                tags.some(tag => cardsTags.includes(this.deslugify(tag.toLowerCase()))) ||
                                tags.length === 0
                            );
                        })
                        .map(this.deslugify);

                    const tabFromUrl = this.route.snapshot.queryParamMap.get('tab');
                    if (tabFromUrl) {
                        this.activeTab.set(this.deslugify(tabFromUrl));
                        if (!this.tabs.includes(tabFromUrl)) {
                            setTimeout(() => {
                                this.tabs.push(this.activeTab());
                                console.log(this.tabs)
                            });
                        }
                    } else {
                        this.activeTab.set('All');
                    }
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

        // синхронизируем в URL
        this.router.navigate([], {
            relativeTo: this.route,
            queryParams: { tab },
            queryParamsHandling: 'merge',
            replaceUrl: true,
        });
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

    public removeTag(tag: string): void {
        const qp = new URLSearchParams(this.route.snapshot.queryParamMap as any);
        const csv = qp.get('tags') ?? '';
        const list = csv ? csv.split(',').map(s => s.trim()).filter(Boolean) : [];
        const next = list.filter(t => t !== tag);
        if (next.length) qp.set('tags', next.join(','));
        else qp.delete('tags');

        this.router.navigate([], {
            relativeTo: this.route,
            queryParams: Object.fromEntries(qp.entries()),
            replaceUrl: true,
        });
    }

    public clearAllFilters(): void {
        const qp = { ...this.route.snapshot.queryParams };
        delete qp['title'];
        delete qp['description'];
        delete qp['creditTo'];
        delete qp['tags'];
        this.router.navigate([], { relativeTo: this.route, queryParams: qp, replaceUrl: true });
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
