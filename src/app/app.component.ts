import { Component, inject, OnInit } from '@angular/core';
import { Router, RouterOutlet } from '@angular/router';
import { ScrollToService } from './shared/services/scroll-to.service';

@Component({
    selector: 'app-root',
    standalone: true,
    imports: [RouterOutlet],
    template: '<router-outlet></router-outlet>',
    providers: [ScrollToService]
})
export class AppComponent implements OnInit {
    title = 'wondrvoices';
    private readonly scrollToService: ScrollToService = inject(ScrollToService);
    private readonly router: Router = inject(Router);

    public ngOnInit(): void {
        this.listenRoutesTransition();
    }

    private async listenRoutesTransition(): Promise<void> {
        // @ts-ignore
        // this.router.events.subscribe(async (event: any) => {
        //     if (event instanceof NavigationEnd) {
        //         // await new Promise(resolve => setTimeout(resolve, 50));
        //         this.scrollToService.scrollToTop();
        //     }
        // });
    }
}
