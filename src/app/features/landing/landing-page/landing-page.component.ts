import { ChangeDetectionStrategy, Component, CUSTOM_ELEMENTS_SCHEMA, DestroyRef, HostListener, inject, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { filter } from 'rxjs';
import { ScrollToService } from '../../../shared/services/scroll-to.service';

@Component({
    selector: 'app-landing-page',
    standalone: true,
    imports: [RouterOutlet, RouterLink, RouterLinkActive],
    templateUrl: './landing-page.component.html',
    styleUrl: './landing-page.component.scss',
    changeDetection: ChangeDetectionStrategy.OnPush,
    schemas: [CUSTOM_ELEMENTS_SCHEMA]
})
export class LandingPageComponent implements OnInit {
    private readonly router: Router = inject(Router);
    private readonly destroyRef: DestroyRef = inject(DestroyRef);
    private readonly scrollToService: ScrollToService = inject(ScrollToService);

    public menuOpened = signal(false);
    public hideHeader = signal(false);

    private lastScrollY = 0;
    private ticking = false;
    private headerEl!: HTMLElement;
    private ro?: ResizeObserver;

    public ngOnInit(): void {
        if (typeof window === 'undefined') return;

        this.headerEl = document.querySelector('.top-bar') as HTMLElement;

        this.measureHeaderHeight();
        this.mountScrollHandler();
        this.initRouteListenerToUpdateThumb();
        this.addRippleEffectForButtons();
    }

    public scrollToTop(): void {
        this.scrollToService.scrollToTop();
    }

    @HostListener('document:click', ['$event'])
    public onDocumentClick(event: Event): void {
        const target = event.target as HTMLElement | null;
        const navBar = document.querySelector('nav');
        if (!target || !navBar) return;

        if (!navBar.contains(target) && this.menuOpened()) {
            this.toggleMenu();
        }
    }

    public toggleMenu(event?: Event): void {
        event?.stopPropagation();
        this.menuOpened.update(isOpen => !isOpen);
    }

    @HostListener('window:scroll')
    public onWindowScroll(): void {
        
    }

    public scrollY = signal(0);
    private mountScrollHandler(): void {
        this.lastScrollY = window.scrollY || 0;

        // Passive listener + rAF for perf
        const onScroll = () => {
            const currentY = window.scrollY || 0;
            this.scrollY.set(currentY);

            if (!this.ticking) {
                this.ticking = true;
                requestAnimationFrame(() => {
                    this.applyHeaderVisibility(currentY, this.lastScrollY);
                    this.updateCustomScrollbarThumb(currentY);
                    this.lastScrollY = currentY;
                    this.ticking = false;
                });
            }
        };

        window.addEventListener('scroll', onScroll, { passive: true });

        this.destroyRef.onDestroy(() => {
            window.removeEventListener('scroll', onScroll);
            this.ro?.disconnect();
        });

        // Initial paint
        this.applyHeaderVisibility(this.lastScrollY, this.lastScrollY);
        this.updateCustomScrollbarThumb(this.lastScrollY);
    }

    private applyHeaderVisibility(currentY: number, prevY: number): void {
        const nearTop = currentY < 80;
        const scrollingDown = currentY > prevY;
        const passedThreshold = currentY > 120;

        // Hides on fast downward scroll, shows when scrolling up or near top
        if (nearTop) {
            this.hideHeader.set(false);
            return;
        }

        if (passedThreshold && scrollingDown) {
            this.hideHeader.set(true);
        } else {
            this.hideHeader.set(false);
        }
    }

    private updateCustomScrollbarThumb(scrollTop: number): void {
        const docHeight = document.body.scrollHeight - window.innerHeight;
        const scrollPercent = docHeight <= 0 ? 0 : scrollTop / docHeight;
        const thumb = document.querySelector('.custom-scrollbar-thumb') as HTMLElement | null;
        if (thumb) {
            thumb.style.width = `${scrollPercent * 100}%`;
        }
    }

    private measureHeaderHeight(): void {
        const root = document.documentElement;
        const setHeightVar = () => {
            const h = this.headerEl?.offsetHeight || 72;
            root.style.setProperty('--header-h', `${h}px`);
        };

        setHeightVar();
        this.ro = new ResizeObserver(() => setHeightVar());
        if (this.headerEl) this.ro.observe(this.headerEl);
    }

    private initRouteListenerToUpdateThumb(): void {
        this.router.events
            .pipe(
                filter(event => event instanceof NavigationEnd),
                takeUntilDestroyed(this.destroyRef)
            )
            .subscribe(() => {
                // Wait routing render and recompute thumb + header height
                setTimeout(() => {
                    this.measureHeaderHeight();
                    this.updateCustomScrollbarThumb(window.scrollY || 0);
                }, 0);
            });
    }

    private addRippleEffectForButtons(): void {
        document.addEventListener('click', (e) => {
            const target = e.target as HTMLElement;

            if (target.classList.contains('button') && !(target as HTMLButtonElement).disabled) {
                const ripple = document.createElement('span');
                ripple.className = 'ripple';

                const rect = target.getBoundingClientRect();
                const size = Math.max(rect.width, rect.height);
                const x = e.clientX - rect.left - size / 2;
                const y = e.clientY - rect.top - size / 2;

                ripple.style.width = ripple.style.height = `${size}px`;
                ripple.style.left = `${x}px`;
                ripple.style.top = `${y}px`;

                target.appendChild(ripple);
                setTimeout(() => ripple.remove(), 600);
            }
        }, { passive: true });
    }
}
