import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Router, RouterModule } from '@angular/router';
import { voices } from '../../../../shared/data/voices';

export interface VoiceCard {
    id: number;
    image: string;
    category: string;
    title: string;
    description: string;
    author: string;
    date: string;
    avatar: string;
}


@Component({
    selector: 'app-gallery',
    standalone: true,
    imports: [RouterModule],
    templateUrl: './gallery.component.html',
    styleUrl: './gallery.component.scss',
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class GalleryComponent {
    public tabs = ['All', 'Art by kids', 'Voices', 'Videos'];
    public activeTab = signal<string>('All');

    private allCards: VoiceCard[] = voices;

    public cards = signal<VoiceCard[]>(this.allCards);

    private router: Router = inject(Router);

    public filteredCards = computed(() => {
        const tab = this.activeTab();
        if (tab === 'All') return this.cards();
        return this.cards().filter(card => card.category === tab.toUpperCase());
    });

    public selectTab(tab: string) {
        this.activeTab.set('');
        setTimeout(() => {
            this.activeTab.set(tab);
        });
    }

    public openVoicePage(id: number): void {
        this.router.navigateByUrl('voices/' + id);
    }
}
