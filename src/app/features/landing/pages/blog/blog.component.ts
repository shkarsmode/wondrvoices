import {
    ChangeDetectionStrategy,
    ChangeDetectorRef,
    Component,
    computed,
    inject,
    OnInit,
    signal
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { take, timeout } from 'rxjs';
import { PostsService } from '../../../../shared/services/posts.service';
import { IPost } from '../../../../shared/types/IPost';

@Component({
    selector: 'app-blog',
    templateUrl: './blog.component.html',
    styleUrls: ['./blog.component.scss'],
    standalone: true,
    imports: [RouterLink],
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class BlogComponent implements OnInit {
    private readonly postsService = inject(PostsService);
    private readonly changeDetectionRef = inject(ChangeDetectorRef);

    public readonly limit = 100;

    public readonly page = signal(0);
    public readonly allPostsCount = signal<number | null>(null);
    public readonly posts = signal<IPost[]>([]);
    public readonly filteredPosts = computed(() => {
        if (this.activeTab() === 'All') return this.posts();
        return this.posts().filter(post => post.tag === this.activeTab());
    });
    public readonly isLoading = signal(true);
    public readonly activeTab = signal<string>('All');

    public readonly tabs = ['All', 'Health', 'Art', 'Superhero Stories'] as const;

    public readonly pagesCount = computed(() => {
        const total = this.allPostsCount();
        return total ? Math.ceil(total / this.limit) : 0;
    });

    public ngOnInit(): void {
        if (typeof window !== 'undefined') {
            this.fetchPosts();
        }
    }

    public selectTab(tab: string): void {
        this.activeTab.set('');
        setTimeout(() => this.activeTab.set(tab));
    }

    public onPageChange(page: number): void {
        this.page.set(page);
    }

    public onButtonMoreClick(): void {
        this.page.update(p => p + 1);
        this.fetchPosts(true);
    }

    public forward(): void {
        if (this.page() + 1 >= this.pagesCount()) return;
        this.page.update(p => p + 1);
    }

    public back(): void {
        if (this.page() === 0) return;
        this.page.update(p => p - 1);
    }

    private fetchPosts(append: boolean = false): void {
        this.isLoading.set(true);
        this.changeDetectionRef.detectChanges();
        const currentPage = this.page();


        this.postsService.getPosts(this.limit, currentPage)
            .pipe(take(1), timeout(5000))
            .subscribe(response => {
                this.posts.set(
                    append ? [...this.posts(), ...response.posts] : response.posts
                );
                this.allPostsCount.set(response.allPostsCount);

                setTimeout(() => {
                    this.isLoading.set(false);
                    this.changeDetectionRef.detectChanges();
                }, 1500);
            });

    }
}
