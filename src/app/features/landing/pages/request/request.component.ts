import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { LikesService } from '../../../../shared/services/likes.service';
import { RequestsService } from '../../../../shared/services/requests.service';
import { CreateSupportMessageDto, IRequestDetail, ISupportMessage } from '../../../../shared/types/request-support.types';

@Component({
    selector: 'app-request-page',
    standalone: true,
    imports: [CommonModule, RouterLink, FormsModule],
    templateUrl: './request.component.html',
    styleUrl: './request.component.scss',
    changeDetection: ChangeDetectionStrategy.OnPush
})

export class RequestComponent implements OnInit {
    request = signal<IRequestDetail | undefined>(undefined);
    loading = signal(true);
    liked = signal<Set<string>>(new Set());
    
    // Modal states
    appModalOpen = signal(false);
    mailModalOpen = signal(false);
    successModalOpen = signal(false);

    // Form fields
    messageText = '';
    senderName = '';
    senderEmail = '';
    senderOrganization = '';
    senderCity = '';
    
    // Upload state
    sendingMessage = signal(false);
    uploadingMedia = signal(false);
    uploadedMediaUrl = signal<string | null>(null);

    // Autocomplete states
    organizationDropdownOpen = signal(false);
    cityDropdownOpen = signal(false);
    filteredOrganizations = signal<string[]>([]);
    filteredCities = signal<string[]>([]);

    // Predefined organizations list
    private organizations: string[] = [
        'American Cancer Society',
        'St. Jude Children\'s Research Hospital',
        'Seattle Children\'s Hospital',
        'Ronald McDonald House Charities',
        'Leukemia & Lymphoma Society',
        'Make-A-Wish Foundation',
        'Dana-Farber Cancer Institute',
        'MD Anderson Cancer Center',
        'Memorial Sloan Kettering',
        'Children\'s Hospital of Philadelphia',
        'Boston Children\'s Hospital',
        'Texas Children\'s Hospital',
        'Nationwide Children\'s Hospital',
        'Cincinnati Children\'s Hospital',
        'CHOP Foundation',
        'Stand Up To Cancer',
        'Susan G. Komen',
        'Relay For Life',
        'Alex\'s Lemonade Stand',
        'Be The Match'
    ];

    // Common US cities
    private cities: string[] = [
        'New York, NY',
        'Los Angeles, CA',
        'Chicago, IL',
        'Houston, TX',
        'Phoenix, AZ',
        'Philadelphia, PA',
        'San Antonio, TX',
        'San Diego, CA',
        'Dallas, TX',
        'Austin, TX',
        'San Jose, CA',
        'Fort Worth, TX',
        'Jacksonville, FL',
        'Columbus, OH',
        'Charlotte, NC',
        'Seattle, WA',
        'Denver, CO',
        'Boston, MA',
        'Nashville, TN',
        'Detroit, MI',
        'Portland, OR',
        'Atlanta, GA',
        'Miami, FL',
        'Tampa, FL',
        'St. Petersburg, FL'
    ];

    constructor(
        private route: ActivatedRoute,
        private requestsService: RequestsService,
        private likesService: LikesService
    ) {}

    ngOnInit(): void {
        this.liked.set(new Set(this.likesService.getAllLikes()));
        const id = this.route.snapshot.paramMap.get('id');
        if (!id) return;
        this.requestsService.getRequestById(id).subscribe(detail => {
            this.request.set(detail);
            this.loading.set(false);
        });
    }

    getDisplayName(): string {
        const req = this.request();
        if (!req) return '';
        return req.isAnonymous ? 'Anonymous' : req.firstName || 'Anonymous';
    }

    getTimeAgo(date: Date | string): string {
        const now = new Date();
        const diffInMs = now.getTime() - new Date(date).getTime();
        const diffInHours = Math.floor(diffInMs / (1000 * 60 * 60));
        const diffInDays = Math.floor(diffInMs / (1000 * 60 * 60 * 24));
        
        if (diffInHours < 1) return 'Just now';
        if (diffInHours < 24) return `${diffInHours} hour${diffInHours > 1 ? 's' : ''} ago`;
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

    isLiked(requestId: string): boolean {
        return this.liked().has(requestId);
    }

    getHeartCount(detail: IRequestDetail): number {
        const baseHearts = detail.hearts || 0;
        return this.isLiked(detail.id) ? baseHearts + 1 : baseHearts;
    }

    toggleSendLove(): void {
        const current = this.request();
        if (!current) return;

        this.likesService.toggleLike(current.id);
        this.liked.set(new Set(this.likesService.getAllLikes()));
        this.request.set({ ...current });
    }

    // App Modal
    openAppModal(): void {
        this.appModalOpen.set(true);
    }

    closeAppModal(): void {
        this.appModalOpen.set(false);
    }

    // Mail Modal
    openMailModal(): void {
        this.mailModalOpen.set(true);
    }

    closeMailModal(): void {
        this.mailModalOpen.set(false);
    }

    closeSuccessModal(): void {
        this.successModalOpen.set(false);
    }

    // File upload
    onFileSelected(event: Event): void {
        const input = event.target as HTMLInputElement;
        const file = input.files?.[0];
        if (!file) return;

        this.uploadingMedia.set(true);
        this.requestsService.uploadSupportImage(file).subscribe({
            next: (response) => {
                const url = response?.imageUrl?.secure_url || response?.imageUrl?.url || response?.imageUrl?.secureUrl;
                this.uploadedMediaUrl.set(url || null);
                this.uploadingMedia.set(false);
            },
            error: () => {
                this.uploadingMedia.set(false);
                alert('Failed to upload file');
            }
        });
    }

    removeUploadedImage(): void {
        this.uploadedMediaUrl.set(null);
    }

    // Organization autocomplete
    onOrganizationInput(event: Event): void {
        const value = (event.target as HTMLInputElement).value.toLowerCase();
        if (value.length > 0) {
            this.filteredOrganizations.set(
                this.organizations.filter(org => org.toLowerCase().includes(value))
            );
            this.organizationDropdownOpen.set(true);
        } else {
            this.filteredOrganizations.set([]);
            this.organizationDropdownOpen.set(false);
        }
    }

    showOrganizationDropdown(): void {
        if (this.senderOrganization.length > 0) {
            this.filteredOrganizations.set(
                this.organizations.filter(org => 
                    org.toLowerCase().includes(this.senderOrganization.toLowerCase())
                )
            );
            this.organizationDropdownOpen.set(true);
        }
    }

    hideOrganizationDropdownDelayed(): void {
        setTimeout(() => this.organizationDropdownOpen.set(false), 200);
    }

    selectOrganization(org: string): void {
        this.senderOrganization = org;
        this.organizationDropdownOpen.set(false);
    }

    // City autocomplete
    onCityInput(event: Event): void {
        const value = (event.target as HTMLInputElement).value.toLowerCase();
        if (value.length > 0) {
            this.filteredCities.set(
                this.cities.filter(city => city.toLowerCase().includes(value))
            );
            this.cityDropdownOpen.set(true);
        } else {
            this.filteredCities.set([]);
            this.cityDropdownOpen.set(false);
        }
    }

    showCityDropdown(): void {
        if (this.senderCity.length > 0) {
            this.filteredCities.set(
                this.cities.filter(city => 
                    city.toLowerCase().includes(this.senderCity.toLowerCase())
                )
            );
            this.cityDropdownOpen.set(true);
        }
    }

    hideCityDropdownDelayed(): void {
        setTimeout(() => this.cityDropdownOpen.set(false), 200);
    }

    selectCity(city: string): void {
        this.senderCity = city;
        this.cityDropdownOpen.set(false);
    }

    // Submit support message
    submitSupportMessage(): void {
        const req = this.request();
        if (!req) return;

        const message = this.messageText.trim();
        const mediaUrl = this.uploadedMediaUrl();

        if (!this.senderName.trim()) {
            alert('Please provide your first name');
            return;
        }

        if (!this.senderEmail.trim()) {
            alert('Please provide your email');
            return;
        }

        // City is required if organization is selected
        if (this.senderOrganization.trim() && !this.senderCity.trim()) {
            alert('Please provide your city when selecting an organization');
            return;
        }

        if (!message && !mediaUrl) {
            alert('Please add a message or upload an image');
            return;
        }

        // Build location string from city and organization
        let location = this.senderCity.trim() || 'Unknown Location';
        if (this.senderOrganization.trim()) {
            location = `${location} - ${this.senderOrganization.trim()}`;
        }

        const payload: CreateSupportMessageDto = {
            message: message || undefined,
            type: mediaUrl ? 'image' : 'text',
            mediaUrl: mediaUrl || undefined,
            thumbnailUrl: mediaUrl || undefined,
            fromName: this.senderName.trim(),
            email: this.senderEmail.trim(),
            location: location,
        };

        this.sendingMessage.set(true);
        this.requestsService.createSupportMessage(req.id, payload).subscribe({
            next: () => {
                // Clear the form and show success modal
                this.messageText = '';
                this.senderName = '';
                this.senderEmail = '';
                this.senderOrganization = '';
                this.senderCity = '';
                this.uploadedMediaUrl.set(null);
                this.sendingMessage.set(false);
                this.mailModalOpen.set(false);
                this.successModalOpen.set(true);
            },
            error: () => {
                this.sendingMessage.set(false);
                alert('Failed to send message');
            }
        });
    }

    shareRequest(): void {
        const req = this.request();
        if (!req) return;
        
        const url = window.location.href;
        const text = `Support ${this.getDisplayName()}'s journey on WondrVoices`;
        
        if (navigator.share) {
            navigator.share({ title: text, url }).catch(() => {});
        } else if (navigator?.clipboard?.writeText) {
            navigator.clipboard.writeText(url).then(() => alert('Link copied to clipboard!')).catch(() => {});
        }
    }

    browseMoreRequests(): void {
        this.successModalOpen.set(false);
        window.location.href = '/browse-requests';
    }

    getInitials(message: ISupportMessage): string {
        const name = message.anonymous ? 'Anonymous' : message.fromName || 'User';
        const parts = name.trim().split(/\s+/);
        if (parts.length === 1) {
            return parts[0].slice(0, 2).toUpperCase();
        }
        return `${(parts[0][0] || '').toUpperCase()}${(parts[1][0] || '').toUpperCase()}`;
    }

    getMessageTypeLabel(message: ISupportMessage): string {
        if (message.type === 'image') return 'Artwork';
        if (message.type === 'video') return 'Video';
        return 'Message';
    }
}
