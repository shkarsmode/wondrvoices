import { JsonPipe, isPlatformBrowser } from '@angular/common';
import { ChangeDetectionStrategy, Component, Inject, OnInit, PLATFORM_ID, WritableSignal, inject, signal } from '@angular/core';
import { Meta, Title } from '@angular/platform-browser';
import { ActivatedRoute } from '@angular/router';
import { VoicesService } from 'src/app/shared/services/voices.service';
import { IVoice } from 'src/app/shared/types/voices';

type SharePlatform = 'twitter' | 'facebook' | 'linkedin';

const SHARE_ENDPOINTS: Record<SharePlatform, string> = {
    twitter: 'https://x.com/intent/tweet',
    facebook: 'https://www.facebook.com/sharer/sharer.php',
    linkedin: 'https://www.linkedin.com/sharing/share-offsite/'
};

@Component({
    selector: 'app-voice',
    standalone: true,
    imports: [JsonPipe],
    templateUrl: './voice.component.html',
    styleUrl: './voice.component.scss',
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class VoiceComponent implements OnInit {
    private route = inject(ActivatedRoute);
    private title = inject(Title);
    private meta = inject(Meta);
    private voicesService = inject(VoicesService);

    public card: WritableSignal<IVoice | null> = signal<IVoice | null>(null);
    public history: typeof history | {} = typeof history !== 'undefined' ? history : {};
    public isCopied = signal<boolean>(false);

    constructor(@Inject(PLATFORM_ID) private platformId: Object) {}

    public async ngOnInit(): Promise<void> {
        const id = this.route.snapshot.paramMap.get('id');
        if (!id) return;

        const card = await this.voicesService.getApprovedVoiceById(+id).toPromise();
        this.card.set(card ?? null);
        this.updateMetaTags();
    }

    private buildCanonicalVoiceUrl(id: number): string {
        const path = `voices/${id}`;
        if (isPlatformBrowser(this.platformId) && typeof window !== 'undefined') {
            // const origin = window.location.origin.replace(/\/+$/, '');
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
        // Try modern API first
        if (isPlatformBrowser(this.platformId) && navigator?.clipboard?.writeText) {
            try {
                await navigator.clipboard.writeText(text);
                return true;
            } catch { /* fallback below */ }
        }
        // Fallback: hidden textarea + execCommand
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
                // text: this.card()?.description ?? this.card()?.location,
                url
            }).catch(() => {});
        }
    }
    // ---------- /Share helpers ----------

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
        this.meta.updateTag({ property: 'og:image', content: url + this.card().img });
        // @ts-ignore
        this.meta.updateTag({ property: 'og:image:alt', content: url + this.card().location});
        // @ts-ignore
        this.meta.updateTag({ property: 'twitter:title', content: this.card().location });
        // this.meta.updateTag({ property: 'twitter:description', content: this.card.description });
        // @ts-ignore
        this.meta.updateTag({ property: 'twitter:image', content: url + this.card().img });
        // @ts-ignore
        this.meta.updateTag({ property: 'twitter:image:src', content: url + this.card().img });
        this.meta.updateTag({ name: 'twitter:card', content: 'summary_large_image' });
    }
}
