import { isPlatformBrowser } from '@angular/common';
import { ChangeDetectionStrategy, Component, Inject, OnInit, PLATFORM_ID, WritableSignal, inject, signal } from '@angular/core';
import { Meta, Title } from '@angular/platform-browser';
import { ActivatedRoute, Router } from '@angular/router';
import { VoicesService } from 'src/app/shared/services/voices.service';
import { IVoice } from 'src/app/shared/types/voices';

type SharePlatform = 'twitter' | 'facebook' | 'linkedin';
type FilterKey = 'tab' | 'location' | 'description' | 'creditTo';

const SHARE_ENDPOINTS: Record<SharePlatform, string> = {
    twitter: 'https://x.com/intent/tweet',
    facebook: 'https://www.facebook.com/sharer/sharer.php',
    linkedin: 'https://www.linkedin.com/sharing/share-offsite/'
};

@Component({
    selector: 'app-voice',
    imports: [],
    templateUrl: './voice.component.html',
    styleUrl: './voice.component.scss',
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class VoiceComponent implements OnInit {
    private route = inject(ActivatedRoute);
    private title = inject(Title);
    private meta = inject(Meta);
    private voicesService = inject(VoicesService);
    private router = inject(Router);

    public card: WritableSignal<IVoice | null> = signal<IVoice | null>(null);
    public history: typeof history | any = typeof history !== 'undefined' ? history : { back: () => {} };
    public isCopied = signal<boolean>(false);

    constructor(@Inject(PLATFORM_ID) private platformId: Object) {}

    public async ngOnInit(): Promise<void> {
        const id = this.route.snapshot.paramMap.get('id');
        if (!id) return;
        this.card.set(this.voicesService.cachedCards[+id]);

        if (!this.card()) {
            const card = await this.voicesService.getApprovedVoiceById(+id).toPromise();
            this.card.set(card ?? null);
        }
        this.updateMetaTags();
    }

    /** Клик по полю → собираем query-параметры и уходим на /gallery */
    public goToGalleryWithFilter(key: FilterKey, rawValue?: string | null, ev?: Event): void {
        ev?.stopPropagation();
        const value = (rawValue ?? '').trim();
        const queryParams: Record<string, string> = { tab: 'All' };

        if (value) {
            if (key === 'tab') queryParams['tab'] = value;
            if (key === 'location') queryParams['location'] = value;
            if (key === 'description') queryParams['description'] = value;
            if (key === 'creditTo') queryParams['creditTo'] = value;
        }

        void this.router.navigate(['/gallery'], {
            queryParams,
            // если нужно накапливать фильтры при повторных переходах — можно включить:
            // queryParamsHandling: 'merge',
        });
    }

    private buildCanonicalVoiceUrl(id: number): string {
        const path = `voices/${id}`;
        if (isPlatformBrowser(this.platformId) && typeof window !== 'undefined') {
            const origin = 'https://www.wondrvoices.com';
            return `${origin}/${path}`;
        }
        return `https://www.wondrvoices.com/${path}`;
    }

    public buildShareLink(platform: SharePlatform): string {
        const id = this.card()!.id;
        const url = this.buildCanonicalVoiceUrl(id);
        const title = this.card()?.location;

        switch (platform) {
            case 'twitter': {
                const params = new URLSearchParams({ url, text: title ?? '', via: 'Wondrlnk' });
                return `${SHARE_ENDPOINTS.twitter}?${params.toString()}`;
            }
            case 'facebook': {
                const params = new URLSearchParams({ u: url,  text: title ?? '',});
                return `${SHARE_ENDPOINTS.facebook}?${params.toString()}`;
            }
            case 'linkedin': {
                const params = new URLSearchParams({ url,  text: title ?? '',});
                return `${SHARE_ENDPOINTS.linkedin}?${params.toString()}`;
            }
            default:
                return url;
        }
    }

    public async copyVoiceLink(): Promise<void> {
        const url = this.buildCanonicalVoiceUrl(this.card()!.id);
        const copied = await this.tryCopy(url);
        this.isCopied.set(copied);
        setTimeout(() => this.isCopied.set(false), 1800);
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

    public shareNative(): void {
        if (!isPlatformBrowser(this.platformId) || !this.card()) return;
        const url = this.buildCanonicalVoiceUrl(this.card()!.id);
        if ('share' in navigator) {
            navigator.share({
                title: this.card()?.location ?? 'WondrVoices',
                url
            }).catch(() => {});
        }
    }

    private updateMetaTags(): void {
        if (!this.card()) return;

        const url = 'https://www.wondrvoices.com/';
        if (!this.card()?.location) return;
        
        // @ts-ignore
        this.title.setTitle(this.card().location);
        // this.meta.updateTag({ name: 'description', content: this.card.description });
        // @ts-ignore
        this.meta.updateTag({ property: 'og:title', content: this.card().location });
        // this.meta.updateTag({ property: 'og:description', content: this.card.description });
        // @ts-ignore
        this.meta.updateTag({ property: 'og:image', content: this.card().img });
        // @ts-ignore
        this.meta.updateTag({ property: 'og:image:alt', content: this.card().location});
        // @ts-ignore
        this.meta.updateTag({ property: 'twitter:title', content: this.card().location });
        this.meta.updateTag({ property: 'twitter:description', content: 'Heartfelt cards and creative art that lift spirits and show you’re not alone — part of the global WondrVoices community.' });
        // @ts-ignore
        this.meta.updateTag({ property: 'twitter:image', content: this.card().img });
        // @ts-ignore
        this.meta.updateTag({ property: 'twitter:image:src', content: this.card().img });
        this.meta.updateTag({ name: 'twitter:card', content: 'summary_large_image' });
        this.meta.updateTag({ property: 'og:url', content: this.buildCanonicalVoiceUrl(this.card()!.id) });
    }
}
