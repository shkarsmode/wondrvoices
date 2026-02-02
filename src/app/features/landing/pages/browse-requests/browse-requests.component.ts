import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, HostListener, OnInit, computed, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { LikesService } from '../../../../shared/services/likes.service';
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
    FilterCategory = FilterCategory;
    requests = signal<ISupportRequest[]>([]);
    loading = signal(false);
    viewMode = signal<'grid' | 'map'>('grid');
    selectedFilter = signal<FilterCategory>(FilterCategory.All);
    liked = signal<Set<string>>(new Set());
    selectedSort = signal<'newest' | 'oldest' | 'most-support' | 'least-support'>('newest');
    selectedZone = signal<string>('all');
    
    zoneDropdownOpen = false;
    sortDropdownOpen = false;

    sortOptions = [
        { id: 'newest', label: 'Newest First' },
        { id: 'oldest', label: 'Oldest First' },
        { id: 'most-support', label: 'Most Support' },
        { id: 'least-support', label: 'Least Support' }
    ];

    comfortZones = [
        { id: 'all', label: 'All Themes', icon: 'favorite' },
        { id: 'humor', label: 'Humor', icon: 'sentiment_satisfied' },
        { id: 'prayers', label: 'Prayers', icon: 'volunteer_activism' },
        { id: 'nature', label: 'Nature', icon: 'park' },
        { id: 'poems', label: 'Poems', icon: 'edit_note' },
        { id: 'art', label: 'Art', icon: 'palette' },
        { id: 'encouragement', label: 'Encouragement', icon: 'thumb_up' },
        { id: 'hope', label: 'Hope', icon: 'auto_awesome' },
        { id: 'mindfulness', label: 'Mindfulness', icon: 'self_improvement' },
        { id: 'other', label: 'Other', icon: 'chat_bubble' }
    ];

    filters = [
        { id: FilterCategory.All, label: 'All Situations', icon: 'filter_list' },
        { id: FilterCategory.Cancer, label: 'Cancer (Adult)', icon: 'person' },
        { id: FilterCategory.YoungAdult, label: 'Young Adult (18-39)', icon: 'directions_run' },
        { id: FilterCategory.ParentWithKids, label: 'Parent with Kids', icon: 'family_restroom' },
        { id: FilterCategory.PediatricCancer, label: 'Pediatric Cancer', icon: 'child_care' },
        { id: FilterCategory.CancerReturned, label: 'Cancer Returned', icon: 'autorenew' },
        { id: FilterCategory.EndOfLife, label: 'End-of-Life', icon: 'favorite' },
        { id: FilterCategory.RareDisease, label: 'Rare Disease', icon: 'favorite' },
        { id: FilterCategory.Caregiver, label: "I'm a Caregiver", icon: 'volunteer_activism' },
        { id: FilterCategory.Grieving, label: 'Grieving', icon: 'favorite' }
    ];

    sortedRequests = computed(() => {
        const list = [...this.requests()];

        switch (this.selectedSort()) {
            case 'newest':
                return list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
            case 'oldest':
                return list.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
            case 'most-support':
                return list.sort((a, b) => (b.hearts || 0) - (a.hearts || 0));
            case 'least-support':
                return list.sort((a, b) => (a.hearts || 0) - (b.hearts || 0));
            default:
                return list;
        }
    });

    constructor(private requestsService: RequestsService, private likesService: LikesService) {}

    ngOnInit(): void {
        this.liked.set(new Set(this.likesService.getAllLikes()));
        this.loadRequests();
    }

    loadRequests(): void {
        this.loading.set(true);
        this.requestsService.getBrowseRequests({ 
            category: this.selectedFilter(),
            comfortZone: this.selectedZone(),
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

    setSort(sort: 'newest' | 'oldest' | 'most-support' | 'least-support'): void {
        this.selectedSort.set(sort);
    }

    @HostListener('document:click', ['$event'])
    onDocumentClick(event: MouseEvent): void {
        const target = event.target as HTMLElement;
        if (!target.closest('.dropdown')) {
            this.zoneDropdownOpen = false;
            this.sortDropdownOpen = false;
        }
    }

    toggleZoneDropdown(): void {
        this.zoneDropdownOpen = !this.zoneDropdownOpen;
        this.sortDropdownOpen = false;
    }

    toggleSortDropdown(): void {
        this.sortDropdownOpen = !this.sortDropdownOpen;
        this.zoneDropdownOpen = false;
    }

    selectZone(zoneId: string): void {
        this.selectedZone.set(zoneId);
        this.zoneDropdownOpen = false;
        this.loadRequests();
    }

    selectSort(sortId: string): void {
        this.selectedSort.set(sortId as any);
        this.sortDropdownOpen = false;
    }

    getSelectedZoneLabel(): string {
        const zone = this.comfortZones.find(z => z.id === this.selectedZone());
        return zone?.label || 'All Themes';
    }

    getSelectedSortLabel(): string {
        const sort = this.sortOptions.find(s => s.id === this.selectedSort());
        return sort?.label || 'Newest First';
    }

    getDiagnosisIcon(diagnosis: string): string {
        if (diagnosis?.toLowerCase().includes('cancer') || diagnosis?.toLowerCase().includes('pediatric')) {
            return 'child_care';
        }
        return 'medical_services';
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

    isLiked(requestId: string): boolean {
        return this.liked().has(requestId);
    }

    getHeartCount(request: ISupportRequest): number {
        const baseHearts = request.hearts || 0;
        return this.isLiked(request.id) ? baseHearts + 1 : baseHearts;
    }

    toggleFavorite(event: Event, request: ISupportRequest): void {
        event.preventDefault();
        event.stopPropagation();

        this.likesService.toggleLike(request.id);
        this.liked.set(new Set(this.likesService.getAllLikes()));

        // Trigger change detection for the updated stats
        this.requests.update(items => items.map(item => item.id === request.id ? { ...item } : item));
    }
}
