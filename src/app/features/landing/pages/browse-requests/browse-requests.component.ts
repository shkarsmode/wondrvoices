import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, OnInit, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { RequestsService } from '../../../../shared/services/requests.service';
import { FilterCategory, ISupportRequest } from '../../../../shared/types/request-support.types';

@Component({
    selector: 'app-browse-requests',
    standalone: true,
    imports: [CommonModule, RouterLink],
    templateUrl: './browse-requests.component.html',
    styleUrl: './browse-requests.component.scss',
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class BrowseRequestsComponent implements OnInit {
    requests = signal<ISupportRequest[]>([]);
    loading = signal(false);
    viewMode = signal<'grid' | 'map'>('grid');
    selectedFilter = signal<FilterCategory>(FilterCategory.All);

    filters = [
        { id: FilterCategory.All, label: 'All', icon: 'star' },
        { id: FilterCategory.Humor, label: 'Humor', icon: 'sentiment_satisfied' },
        { id: FilterCategory.Prayers, label: 'Prayers', icon: 'volunteer_activism' },
        { id: FilterCategory.Nature, label: 'Nature', icon: 'park' },
        { id: FilterCategory.Poems, label: 'Poems', icon: 'edit_note' },
        { id: FilterCategory.Art, label: 'Art', icon: 'palette' },
        { id: FilterCategory.Encouragement, label: 'Encouragement', icon: 'thumb_up' },
        { id: FilterCategory.Hope, label: 'Hope', icon: 'auto_awesome' },
        { id: FilterCategory.Mindfulness, label: 'Min', icon: 'self_improvement' }
    ];

    constructor(private requestsService: RequestsService) {}

    ngOnInit(): void {
        this.loadRequests();
    }

    loadRequests(): void {
        this.loading.set(true);
        this.requestsService.getBrowseRequests({ 
            category: this.selectedFilter() 
        }).subscribe({
            next: (response) => {
                this.requests.set(response.items);
                this.loading.set(false);
            },
            error: () => {
                this.loading.set(false);
            }
        });
    }

    setViewMode(mode: 'grid' | 'map'): void {
        this.viewMode.set(mode);
    }

    setFilter(filter: FilterCategory): void {
        this.selectedFilter.set(filter);
        this.loadRequests();
    }

    getDisplayName(request: ISupportRequest): string {
        return request.isAnonymous ? 'Anonymous' : request.firstName || 'Anonymous';
    }

    getTimeAgo(date: Date): string {
        const now = new Date();
        const diffInDays = Math.floor((now.getTime() - new Date(date).getTime()) / (1000 * 60 * 60 * 24));
        
        if (diffInDays === 0) return 'Today';
        if (diffInDays === 1) return '1 day ago';
        if (diffInDays < 7) return `${diffInDays} days ago`;
        if (diffInDays < 14) return '1 week ago';
        return `${Math.floor(diffInDays / 7)} weeks ago`;
    }

    getComfortZoneIcon(zone: string): string {
        const icons: Record<string, string> = {
            'encouragement': 'thumb_up',
            'prayers': 'volunteer_activism',
            'hope': 'auto_awesome',
            'poems': 'edit_note',
            'nature': 'park',
            'mindfulness': 'self_improvement',
            'art': 'palette',
            'humor': 'sentiment_satisfied',
            'other': 'forum'
        };
        return icons[zone] || 'forum';
    }

    getComfortZoneLabel(zone: string): string {
        const labels: Record<string, string> = {
            'encouragement': 'Encouragement',
            'prayers': 'Prayers',
            'hope': 'Hope',
            'poems': 'Poems',
            'nature': 'Nature',
            'mindfulness': 'Mindfulness',
            'art': 'Art',
            'humor': 'Humor',
            'other': 'Other'
        };
        return labels[zone] || zone;
    }
}
