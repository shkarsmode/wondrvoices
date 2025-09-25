import { Component, OnInit } from '@angular/core';
import { RouterOutlet } from '@angular/router';
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

    public ngOnInit(): void { }

}
