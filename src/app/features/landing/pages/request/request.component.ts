import { CommonModule } from '@angular/common';
import { AfterViewChecked, ChangeDetectionStrategy, Component, ElementRef, NgZone, OnInit, signal, ViewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { LikesService } from '../../../../shared/services/likes.service';
import { RequestsService } from '../../../../shared/services/requests.service';
import { CreateSupportMessageDto, IRequestDetail, ISupportMessage } from '../../../../shared/types/request-support.types';

declare const google: any;

@Component({
    selector: 'app-request-page',
    standalone: true,
    imports: [CommonModule, RouterLink, FormsModule],
    templateUrl: './request.component.html',
    styleUrl: './request.component.scss',
    changeDetection: ChangeDetectionStrategy.OnPush
})

export class RequestComponent implements OnInit, AfterViewChecked {
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

    // Google Places autocomplete
    @ViewChild('orgInput') orgInputRef!: ElementRef<HTMLInputElement>;
    @ViewChild('cityInput') cityInputRef!: ElementRef<HTMLInputElement>;
    private orgAutocomplete: any;
    private cityAutocomplete: any;
    private placesInitialized = false;

    constructor(
        private route: ActivatedRoute,
        private requestsService: RequestsService,
        private likesService: LikesService,
        private ngZone: NgZone
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

    // Google Places autocomplete initialization
    ngAfterViewChecked(): void {
        if (this.mailModalOpen() && !this.placesInitialized) {
            this.initGooglePlacesAutocomplete();

        }
        if (!this.mailModalOpen()) {
            this.placesInitialized = false;
            this.orgAutocomplete = null;
            this.cityAutocomplete = null;
        }
    }

    private initGooglePlacesAutocomplete(): void {
        console.log('Attempting to initialize Google Places Autocomplete', google);
        if (typeof google === 'undefined' || !google?.maps?.places) return;

        console.log('Initializing Google Places Autocomplete', this.orgInputRef, this.cityInputRef);

        const orgInput = this.orgInputRef?.nativeElement;
        const cityInput = this.cityInputRef?.nativeElement;

        if (!orgInput || !cityInput) return;
        this.placesInitialized = true;

        // Organization autocomplete (establishments)
        this.orgAutocomplete = new google.maps.places.Autocomplete(orgInput, {
            types: ['establishment'],
            fields: ['name', 'formatted_address']
        });
        this.orgAutocomplete.addListener('place_changed', () => {
            this.ngZone.run(() => {
                const place = this.orgAutocomplete.getPlace();
                if (place?.name) {
                    this.senderOrganization = place.name;
                }
            });
        });

        // City autocomplete (cities)
        this.cityAutocomplete = new google.maps.places.Autocomplete(cityInput, {
            types: ['(cities)'],
            fields: ['formatted_address', 'name']
        });
        this.cityAutocomplete.addListener('place_changed', () => {
            this.ngZone.run(() => {
                const place = this.cityAutocomplete.getPlace();
                if (place?.formatted_address) {
                    this.senderCity = place.formatted_address;
                } else if (place?.name) {
                    this.senderCity = place.name;
                }
            });
        });
    }

    // Organization input handler (for manual typing)
    onOrganizationInput(event: Event): void {
        // Google Places handles the dropdown automatically
    }

    showOrganizationDropdown(): void {
        // Google Places handles this
    }

    hideOrganizationDropdownDelayed(): void {
        // Google Places handles this
    }

    selectOrganization(org: string): void {
        this.senderOrganization = org;
    }

    // City input handler (for manual typing)
    onCityInput(event: Event): void {
        // Google Places handles the dropdown automatically
    }

    showCityDropdown(): void {
        // Google Places handles this
    }

    hideCityDropdownDelayed(): void {
        // Google Places handles this
    }

    selectCity(city: string): void {
        this.senderCity = city;
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

    scrollToMessages(): void {
        const el = document.querySelector('.messages-feed');
        if (el) {
            el.scrollIntoView({ behavior: 'smooth', block: 'start' });
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
