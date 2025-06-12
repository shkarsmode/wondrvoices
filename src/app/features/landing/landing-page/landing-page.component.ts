import { Component, DestroyRef, HostListener, inject, OnInit } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { filter } from 'rxjs';

@Component({
    selector: 'app-landing-page',
    standalone: true,
    imports: [RouterOutlet, RouterLink, RouterLinkActive],
    templateUrl: './landing-page.component.html',
    styleUrl: './landing-page.component.scss'
})
export class LandingPageComponent implements OnInit {
    private readonly router: Router = inject(Router);
    private readonly destroyRef: DestroyRef = inject(DestroyRef);
    

    public ngOnInit(): void {
        if (typeof window === 'undefined') return;
    
        this.onWindowScroll();
        this.addRippleEffectForButtons();
        this.initRouteListenerToUpdateThumb();
    }

    @HostListener('window:scroll', [])
    public onWindowScroll() {
        const scrollTop = window.scrollY;
        const docHeight = document.body.scrollHeight - window.innerHeight;
        const scrollPercent = docHeight === 0 ? 0 :scrollTop / docHeight;

        const thumb = document.querySelector('.custom-scrollbar-thumb') as HTMLElement;
        if (thumb) {
            thumb.style.width = `${scrollPercent * 100}%`;
        }
    }

    private initRouteListenerToUpdateThumb(): void {
        this.router.events
            .pipe(
                filter(event => event instanceof NavigationEnd),
                takeUntilDestroyed(this.destroyRef)
            )
            .subscribe(() => {
                setTimeout(() => this.onWindowScroll());
            });
    }

    private addRippleEffectForButtons(): void {
        document.addEventListener('click', function (e) {
            const target = e.target as HTMLElement;

            if (target.classList.contains('button') && !(target as any).disabled) {
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
        });
    }
}
