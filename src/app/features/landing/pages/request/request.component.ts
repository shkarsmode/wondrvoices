import { CommonModule } from '@angular/common';
import { AfterViewChecked, ChangeDetectionStrategy, Component, ElementRef, NgZone, OnInit, signal, ViewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { LikesService } from '../../../../shared/services/likes.service';
import { RequestsService } from '../../../../shared/services/requests.service';
import { CreateSupportMessageDto, IRequestDetail, ISupportMessage } from '../../../../shared/types/request-support.types';

declare const google: any;

// Leaflet type imports for SSR safety
type LeafletType = typeof import('leaflet');

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
    mailModalMode = signal<'text' | 'image'>('text');
    successModalOpen = signal(false);
    lightboxImageUrl = signal<string | null>(null);

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
    @ViewChild('nameInput') nameInputRef!: ElementRef<HTMLInputElement>;
    @ViewChild('supportMap') supportMapRef!: ElementRef<HTMLDivElement>;
    private orgAutocomplete: any;
    private cityAutocomplete: any;
    private placesInitialized = false;

    // Leaflet map for support locations
    private L: any;
    private supportMap: any;
    private supportMapInitialized = false;

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

    getMessageCount(detail: IRequestDetail): number {
        // Use supportCount from API if available, fall back to messages array length, fall back to comments
        return detail.supportCount ?? detail.comments ?? detail.messages?.length ?? 0;
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
    openMailModal(mode: 'text' | 'image' = 'text'): void {
        this.mailModalMode.set(mode);
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

        // Initialize support map when messages section is visible
        if (!this.supportMapInitialized && this.supportMapRef?.nativeElement && this.request()?.messages?.length) {
            this.supportMapInitialized = true; // set early to prevent re-entry
            // Delay map init to ensure the DOM element has dimensions
            setTimeout(() => this.initSupportMap(), 200);
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
            fields: ['name', 'formatted_address', 'address_components']
        });
        this.orgAutocomplete.addListener('place_changed', () => {
            this.ngZone.run(() => {
                const place = this.orgAutocomplete.getPlace();
                if (place?.name) {
                    this.senderOrganization = place.name;
                }
                // Auto-populate city from the organization's address
                if (place?.address_components) {
                    const cityComponent = place.address_components.find(
                        (c: any) => c.types.includes('locality')
                    );
                    const stateComponent = place.address_components.find(
                        (c: any) => c.types.includes('administrative_area_level_1')
                    );
                    if (cityComponent) {
                        const cityName = cityComponent.long_name;
                        const stateShort = stateComponent?.short_name;
                        this.senderCity = stateShort ? `${cityName}, ${stateShort}` : cityName;
                        if (cityInput) {
                            cityInput.value = this.senderCity;
                        }
                    } else if (place.formatted_address) {
                        this.senderCity = place.formatted_address;
                        if (cityInput) {
                            cityInput.value = this.senderCity;
                        }
                    }
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

        // Email is optional - no validation needed

        // City is required
        if (!this.senderCity.trim()) {
            alert('Please provide your city');
            return;
        }

        // For image mode, require an image
        if (this.mailModalMode() === 'image' && !mediaUrl) {
            alert('Please upload an image of your creation');
            return;
        }

        // For text mode, require a message
        if (this.mailModalMode() === 'text' && !message && !mediaUrl) {
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
            email: this.senderEmail.trim() || undefined,
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

    // Location parsing helpers for better formatting
    getLocationCity(location: string): string {
        if (!location) return '';
        // Location format: "City, State, Country - Venue Name"
        const parts = location.split(' - ');
        return parts[0]?.trim() || location;
    }

    getLocationVenue(location: string): string {
        if (!location) return '';
        const parts = location.split(' - ');
        return parts.length > 1 ? parts.slice(1).join(' - ').trim() : '';
    }

    // Image lightbox
    openImageLightbox(imageUrl: string): void {
        this.lightboxImageUrl.set(imageUrl);
    }

    closeLightbox(): void {
        this.lightboxImageUrl.set(null);
    }

    // Animated support map
    private async initSupportMap(): Promise<void> {
        if (typeof window === 'undefined') return;
        
        const mapEl = this.supportMapRef?.nativeElement;
        if (!mapEl || mapEl.offsetHeight === 0) {
            // Element not visible yet — retry
            setTimeout(() => {
                this.supportMapInitialized = false; // allow re-trigger
            }, 500);
            return;
        }

        try {
            const leafletModule = await import('leaflet');
            this.L = (leafletModule as any).default ?? leafletModule;
            (window as any).L = this.L;

            // Create the map
            this.supportMap = this.L.map(mapEl, {
                preferCanvas: true,
                zoomControl: true,
                scrollWheelZoom: false,
            }).setView([30, 0], 2);

            this.L.tileLayer(
                'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png',
                { maxZoom: 19, attribution: '&copy; OpenStreetMap &copy; CARTO' }
            ).addTo(this.supportMap);

            // Force a size recalculation after the tile layer is added
            setTimeout(() => this.supportMap?.invalidateSize(), 0);
            setTimeout(() => this.supportMap?.invalidateSize(), 300);

            // Get request location and messages
            const req = this.request();
            if (!req) return;

            const markers: Array<{ lat: number; lng: number; label: string; isOrigin: boolean }> = [];

            // Add the request origin (recipient location)
            if (req.lat && req.lng) {
                markers.push({ lat: req.lat, lng: req.lng, label: req.location || 'Recipient', isOrigin: true });
            }

            // Add message locations from mapMarkers if available
            if (req.mapMarkers?.length) {
                for (const m of req.mapMarkers) {
                    markers.push({ lat: m.lat, lng: m.lng, label: m.from || m.label || 'Supporter', isOrigin: false });
                }
            }

            // Animate markers appearing with arcs
            const originMarker = markers.find(m => m.isOrigin);
            const supportMarkers = markers.filter(m => !m.isOrigin);

            // Add origin marker with a special icon
            if (originMarker) {
                const originIcon = this.L.divIcon({
                    className: 'support-map-origin',
                    html: `<div class="origin-marker"><span>${req.messages?.length || 0}</span></div>`,
                    iconSize: [44, 44],
                    iconAnchor: [22, 22],
                });
                this.L.marker([originMarker.lat, originMarker.lng], { icon: originIcon })
                    .addTo(this.supportMap);
            }

            // Animate support markers appearing one by one
            for (let i = 0; i < supportMarkers.length; i++) {
                const sm = supportMarkers[i];
                await new Promise(resolve => setTimeout(resolve, 300));
                
                const supportIcon = this.L.divIcon({
                    className: 'support-map-dot',
                    html: `<div class="support-dot"></div>`,
                    iconSize: [16, 16],
                    iconAnchor: [8, 8],
                });

                this.L.marker([sm.lat, sm.lng], { icon: supportIcon })
                    .addTo(this.supportMap);

                // Draw an animated arc from supporter to origin
                if (originMarker) {
                    this.drawArc(
                        [sm.lat, sm.lng],
                        [originMarker.lat, originMarker.lng]
                    );
                }
            }

            // Fit bounds
            if (markers.length > 0) {
                const bounds = this.L.latLngBounds(markers.map(m => [m.lat, m.lng]));
                if (bounds.isValid()) {
                    this.supportMap.fitBounds(bounds.pad(0.3), { animate: true });
                }
            }

            // Fix map sizing (multiple retries for reliability)
            setTimeout(() => this.supportMap?.invalidateSize(), 100);
            setTimeout(() => this.supportMap?.invalidateSize(), 500);
            setTimeout(() => this.supportMap?.invalidateSize(), 1000);
        } catch (e) {
            console.error('Failed to initialize support map:', e);
            this.supportMapInitialized = false; // allow retry on error
        }
    }

    private drawArc(from: [number, number], to: [number, number]): void {
        if (!this.L || !this.supportMap) return;

        const latlngs: [number, number][] = [];
        const steps = 30;
        
        for (let i = 0; i <= steps; i++) {
            const t = i / steps;
            const lat = from[0] + (to[0] - from[0]) * t;
            const lng = from[1] + (to[1] - from[1]) * t;
            // Add a curve offset
            const offset = Math.sin(t * Math.PI) * 15;
            latlngs.push([lat + offset, lng]);
        }

        const polyline = this.L.polyline(latlngs, {
            color: '#c9a0dc',
            weight: 2,
            opacity: 0.6,
            dashArray: '6 4',
            className: 'animated-arc',
        }).addTo(this.supportMap);
    }
}
