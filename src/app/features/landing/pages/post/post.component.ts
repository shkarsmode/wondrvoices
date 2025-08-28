
import { DatePipe, Location, NgIf } from '@angular/common';
import { ChangeDetectionStrategy, Component, ElementRef, ViewChild, computed, signal } from '@angular/core';
import { Meta, Title } from '@angular/platform-browser';
import { ActivatedRoute, Router } from '@angular/router';
import { first } from 'rxjs';
import { PostsService } from '../../../../shared/services/posts.service';
import { IPost } from '../../../../shared/types/IPost';

const shareLinks = {
    twitter: "https://x.com/intent/tweet?url=",
    facebook: "https://www.facebook.com/sharer/sharer.php?u=",
    linkedin: "https://www.linkedin.com/sharing/share-offsite/?url="
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
    private readonly copyLink = 'https://www.wondrvoices.com/blogs/';

    @ViewChild('wrap', { static: true }) wrap!: ElementRef<HTMLDivElement>;

    // Signals
    public post = signal<IPost | null>(null);
    public isCopied = signal(false);
    public postId = signal<number | null>(null);

    // Share links as computed signals
    public twitterShareLink = computed(() => {
        const post = this.post();
        const id = this.postId();
        if (!post || !id) return '';
        return `${shareLinks.twitter}${this.copyLink}${id}&text=${post.header}&via=Wondrlnk`;
    });
    public facebookShareLink = computed(() => {
        const post = this.post();
        const id = this.postId();
        if (!post || !id) return '';
        return `${shareLinks.facebook}${this.copyLink}${id}&text=${post.header}&via=Wondrlnk`;
    });
    public linkedinShareLink = computed(() => {
        const post = this.post();
        const id = this.postId();
        if (!post || !id) return '';
        return `${shareLinks.linkedin}${this.copyLink}${id}&text=${post.header}&via=Wondrlnk`;
    });

    constructor(
        private route: ActivatedRoute,
        private router: Router,
        private postsService: PostsService,
        private location: Location,
        private meta: Meta,
        private title: Title
    ) { }

    public ngOnInit(): void {
        console.log('[PostComponent]: init');
        this.listenPostIdFromRoute();
    }

    private listenPostIdFromRoute(): void {
        this.route.params.subscribe((params) => {
            const id = +params['id'];
            console.log('listenPostIdFromRoute', id);
            this.postId.set(id);
            this.fetchPost(id);
        });
    }

    
    private fetchPost(id: number) {
        this.postsService.getPostById(id)
            .pipe(first())
            .subscribe({
                next: (post) => {
                    this.post.set(post);
                    this.updateMetaTags(post);
                    this.setBackgroundImage();
                },
                error: (_) => this.router.navigate(['/not-found'])
            });
    }

    private setBackgroundImage(): void {
        // if (this.wrap && this.post()) {
        //     this.wrap.nativeElement.style.backgroundImage = `url('${this.post()!.mainPicture}')`;
        // }
    }

    public async copyCurrentPost() {
        this.isCopied.set(true);
        // Clipboard logic can be added here if needed
        await new Promise((resolve) => setTimeout(resolve, 2000));
        this.isCopied.set(false);
    }

    public goBack = () => this.location.back();

    private updateMetaTags(post: IPost): void {
        this.title.setTitle(post.header);
        this.meta.updateTag({ name: 'description', content: post.subHeader });
        this.meta.updateTag({ property: 'og:title', content: post.header });
        this.meta.updateTag({ property: 'og:description', content: post.subHeader });
        this.meta.updateTag({ property: 'og:image', content: post.mainPicture });
        this.meta.updateTag({ property: 'og:image:alt', content: post.header });
        this.meta.updateTag({ property: 'og:url', content: `${this.copyLink}${post.id}` });
        this.meta.updateTag({ property: 'twitter:title', content: post.header });
        this.meta.updateTag({ property: 'twitter:description', content: post.subHeader });
        this.meta.updateTag({ property: 'twitter:image', content: post.mainPicture });
        this.meta.updateTag({ property: 'twitter:image:src', content: post.mainPicture });
        this.meta.updateTag({ name: 'twitter:card', content: 'summary_large_image' });
    }

    public loadEnd() {
        console.log('main picture load end');
    }

    public onError() {
        let postImage = document.querySelector('post-main-picture') as HTMLElement;
        // if(postImage) { postImage.style.display = }
        console.log('picture load error');
    }
}
