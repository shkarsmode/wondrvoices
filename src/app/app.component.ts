import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { ScrollToService } from './shared/services/scroll-to.service';
import { ToastContainerComponent } from './shared/toast/toast-container.component';

@Component({
    selector: 'app-root',
    standalone: true,
    imports: [RouterOutlet, ToastContainerComponent],
    template: '<app-toast-container position="bottom-right" /> <router-outlet></router-outlet>',
    providers: [ScrollToService]
})
export class AppComponent {
    title = 'wondrvoices';

}
