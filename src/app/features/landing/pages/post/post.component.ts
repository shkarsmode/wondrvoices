import { DatePipe, Location, NgIf, isPlatformBrowser } from '@angular/common';
import { ChangeDetectionStrategy, Component, ElementRef, Inject, PLATFORM_ID, ViewChild, computed, signal } from '@angular/core';
import { Meta, Title } from '@angular/platform-browser';
import { ActivatedRoute, Router } from '@angular/router';
import { first } from 'rxjs';
import { PostsService } from '../../../../shared/services/posts.service';
import { IPost } from '../../../../shared/types/IPost';

type SharePlatform = 'twitter' | 'facebook' | 'linkedin';

const SHARE_ENDPOINTS: Record<SharePlatform, string> = {
    twitter: 'https://x.com/intent/tweet',
    facebook: 'https://www.facebook.com/sharer/sharer.php',
    linkedin: 'https://www.linkedin.com/sharing/share-offsite/'
};

@Component({
    selector: 'app-post',
    templateUrl: './post.component.html',
    styleUrls: ['./post.component.scss'],
    imports: [DatePipe, NgIf],
    standalone: true,
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class PostComponent {
    // Если домен когда-то поменяется — достаточно скорректировать только этот basePath.
    private readonly canonicalBasePath: string = '/blogs/';

    @ViewChild('wrap', { static: true }) public wrap!: ElementRef<HTMLDivElement>;

    public post = signal<IPost | null>(null);
    public isCopied = signal<boolean>(false);
    public postId = signal<number | null>(null);

    public twitterShareLink = computed(() => this.postId() && this.post() ?
        this.buildShareLink('twitter', this.postId()!) : '');

    public facebookShareLink = computed(() => this.postId() ?
        this.buildShareLink('facebook', this.postId()!) : '');

    public linkedinShareLink = computed(() => this.postId() ?
        this.buildShareLink('linkedin', this.postId()!) : '');

    constructor(
        private route: ActivatedRoute,
        private router: Router,
        private postsService: PostsService,
        private location: Location,
        private meta: Meta,
        private title: Title,
        @Inject(PLATFORM_ID) private platformId: Object
    ) { }

    public ngOnInit(): void {
        this.listenPostIdFromRoute();
    }

    private listenPostIdFromRoute(): void {
        this.route.params.subscribe((params) => {
            const id = Number(params['id']);
            if (Number.isFinite(id)) {
                this.postId.set(id);
                this.fetchPost(id);
            } else {
                this.router.navigate(['/not-found']);
            }
        });
    }

    private fetchPost(id: number): void {
        this.postsService
            .getPostById(id)
            .pipe(first())
            .subscribe({
                next: (post) => {
                    this.post.set(post);
                    this.updateMetaTags(post);
                    this.setBackgroundImage();
                },
                error: () => this.router.navigate(['/not-found'])
            });
    }

    private setBackgroundImage(): void {
        // Optionally enable if нужен фон из mainPicture
        // const p = this.post();
        // if (this.wrap && p?.mainPicture) {
        //     this.wrap.nativeElement.style.backgroundImage = `url('${p.mainPicture}')`;
        // }
    }

    public async copyCurrentPost(): Promise<void> {
        const id = this.postId();
        if (!id) return;
        const url = this.buildCanonicalUrl(id);

        const copied = (await this.tryNavigatorClipboard(url));
        this.isCopied.set(copied);

        setTimeout(() => this.isCopied.set(false), 2000);
    }

    public goBack = (): void => this.location.back();

    public shareNative(): void {
        const post = this.post();
        const id = this.postId();
        if (!post || !id) return;

        if (isPlatformBrowser(this.platformId) && 'share' in navigator) {
            const url = this.buildCanonicalUrl(id);
            navigator.share({
                title: post.header,
                text: post.subHeader ?? post.header,
                url
            }).catch(() => {
                // Игнорируем отмену; без логов
            });
        }
    }

    private async tryNavigatorClipboard(text: string): Promise<boolean> {
        if (isPlatformBrowser(this.platformId) && navigator.clipboard?.writeText) {
            try {
                await navigator.clipboard.writeText(text);
                return true;
            } catch {
                return false;
            }
        }
        return false;
    }

    private buildCanonicalUrl(id: number): string {
        if (isPlatformBrowser(this.platformId)) {
            // const origin = window.location.origin.replace(/\/+$/, '');
            const origin = 'https://www.wondrvoices.com';
            const path = `${this.canonicalBasePath.replace(/^\/+/, '')}${id}`;
            return `${origin}/${path}`;
        }
        return `${this.canonicalBasePath}${id}`;
    }

    private buildShareLink(
        platform: 'twitter' | 'facebook' | 'linkedin', 
        id: number
    ): string {
        const url = this.buildCanonicalUrl(id);
        const title = this.post()?.header;

        switch (platform) {
            case 'twitter':
                return `${SHARE_ENDPOINTS.twitter}?${new URLSearchParams({
                    url,
                    text: title ?? '',
                    via: 'Wondrlnk'
                })}`;
            case 'facebook':
                return `${SHARE_ENDPOINTS.facebook}?${new URLSearchParams({ u: url, text: title ?? '', })}`;
            case 'linkedin':
                return `${SHARE_ENDPOINTS.linkedin}?${new URLSearchParams({ url, text: title ?? '', })}`;
            default:
                return url;
        }
    }

    private updateMetaTags(post: IPost): void {
        const id = this.postId();
        const canonicalUrl = id ? this.buildCanonicalUrl(id) : undefined;

        this.title.setTitle(post.header);
        this.meta.updateTag({ name: 'description', content: post.subHeader });

        this.meta.updateTag({ property: 'og:type', content: 'article' });
        this.meta.updateTag({ property: 'og:title', content: post.header });
        this.meta.updateTag({ property: 'og:description', content: post.subHeader });
        if (post.mainPicture) {
            this.meta.updateTag({ property: 'og:image', content: post.mainPicture });
            this.meta.updateTag({ property: 'og:image:alt', content: post.header });
        }
        if (canonicalUrl) {
            this.meta.updateTag({ property: 'og:url', content: canonicalUrl });
        }

        this.meta.updateTag({ name: 'twitter:card', content: 'summary_large_image' });
        this.meta.updateTag({ name: 'twitter:title', content: post.header });
        this.meta.updateTag({ name: 'twitter:description', content: post.subHeader });
        if (post.mainPicture) {
            this.meta.updateTag({ name: 'twitter:image', content: post.mainPicture });
        }
    }

    public loadEnd(): void {
        console.log('[PostComponent] main picture load end');
    }

    public onError(): void {
        console.log('[PostComponent] main picture load error');
    }
}
