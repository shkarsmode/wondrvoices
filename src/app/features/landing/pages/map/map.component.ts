import { CommonModule } from '@angular/common';
import {
    AfterViewInit,
    Component,
    DestroyRef,
    ElementRef,
    HostListener,
    computed,
    effect,
    inject,
    signal,
    viewChild
} from '@angular/core';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { RequestsService } from 'src/app/shared/services/requests.service';
import { VoicesService } from 'src/app/shared/services/voices.service';
import { ISupportRequest } from 'src/app/shared/types/request-support.types';
import { IVoice } from 'src/app/shared/types/voices';

import type * as Leaflet from 'leaflet';

@Component({
    selector: 'app-map',
    imports: [CommonModule],
    templateUrl: './map.component.html',
    styleUrls: ['./map.component.scss']
})
export class MapComponent implements AfterViewInit {
    private readonly voicesService = inject(VoicesService);
    private readonly requestsService = inject(RequestsService);
    private readonly router = inject(Router);
    private readonly destroyRef = inject(DestroyRef);

    readonly journeys = signal<ISupportRequest[]>([]);
    readonly supportCards = signal<IVoice[]>([]);
    readonly activeLayer = signal<'journeys' | 'support'>('journeys');
    readonly mapReady = signal(false);

    readonly journeyMarkers = computed(() =>
        this.journeys().filter((journey) => journey.lat != null && journey.lng != null)
    );

    readonly supportMarkers = computed(() =>
        this.supportCards().filter((card) => card.lat != null && card.lng != null)
    );

    readonly journeyCount = computed(() => this.journeyMarkers().length);
    readonly supportCount = computed(() => this.supportMarkers().length);

    private readonly markerSync = effect(() => {
        this.activeLayer();
        this.journeyMarkers();
        this.supportMarkers();
        this.refreshMarkers();
    });

    private L!: typeof Leaflet;
    private map?: Leaflet.Map;
    private markersLayer?: Leaflet.LayerGroup;

    readonly mapEl = viewChild.required<ElementRef<HTMLDivElement>>('map');

    async ngAfterViewInit(): Promise<void> {
        if (typeof window === 'undefined') {
            return;
        }

        const leafletModule = await import('leaflet');
        this.L = resolveLeafletNamespace(leafletModule);

        this.initMap();
        await Promise.allSettled([this.loadJourneys(), this.loadSupportCards()]);
        this.mapReady.set(true);
        this.refreshMarkers();
        this.invalidateSoon();

        const onResize = () => this.map?.invalidateSize();
        window.addEventListener('resize', onResize);

        this.destroyRef.onDestroy(() => {
            window.removeEventListener('resize', onResize);
            this.map?.remove();
        });
    }

    @HostListener('document:click', ['$event'])
    onDocumentClick(event: MouseEvent): void {
        const target = event.target as HTMLElement;

        const journeyLink = target.closest('[data-journey-id]') as HTMLElement | null;
        if (journeyLink?.dataset['journeyId']) {
            event.preventDefault();
            event.stopPropagation();
            this.router.navigate(['/request', journeyLink.dataset['journeyId']]);
            return;
        }

        const supportLink = target.closest('[data-voice-id]') as HTMLElement | null;
        if (supportLink?.dataset['voiceId']) {
            event.preventDefault();
            event.stopPropagation();
            this.router.navigate(['/voices', supportLink.dataset['voiceId']]);
        }
    }

    setLayer(layer: 'journeys' | 'support'): void {
        this.activeLayer.set(layer);
    }

    private initMap(): void {
        this.map = this.L.map(this.mapEl().nativeElement, {
            zoomControl: true,
            scrollWheelZoom: false,
            attributionControl: true
        }).setView([28, -22], 2);

        this.L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            maxZoom: 18,
            attribution: '&copy; OpenStreetMap contributors'
        }).addTo(this.map);

        this.markersLayer = this.L.layerGroup().addTo(this.map);
    }

    private async loadJourneys(): Promise<void> {
        const limit = 100;
        let page = 1;
        const loaded: ISupportRequest[] = [];

        while (true) {
            const response = await firstValueFrom(this.requestsService.getBrowseRequests({ limit, page }));
            const items = response?.items ?? [];

            if (!items.length) {
                break;
            }

            loaded.push(...items);

            if (items.length < limit) {
                break;
            }

            page += 1;
        }

        this.journeys.set(loaded);
    }

    private async loadSupportCards(): Promise<void> {
        const limit = 100;
        let page = 1;
        const loaded: IVoice[] = [];

        while (true) {
            const response = await firstValueFrom(this.voicesService.getApprovedVoices(limit, {
                orderBy: 'createdAt',
                orderDir: 'DESC',
                page
            }));
            const items = response?.items ?? [];

            if (!items.length) {
                break;
            }

            loaded.push(...items);

            if (items.length < limit) {
                break;
            }

            page += 1;
        }

        this.supportCards.set(loaded);
    }

    private refreshMarkers(): void {
        if (!this.map || !this.markersLayer) {
            return;
        }

        this.markersLayer.clearLayers();

        const isJourneyLayer = this.activeLayer() === 'journeys';
        const items = isJourneyLayer ? this.journeyMarkers() : this.supportMarkers();
        const bounds = this.L.latLngBounds([]);

        items.forEach((item) => {
            const lat = Number(item.lat);
            const lng = Number(item.lng);

            if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
                return;
            }

            const position: [number, number] = [lat, lng];
            const marker = this.L.marker(position, {
                icon: this.makeMarkerIcon(isJourneyLayer ? 'journey' : 'support')
            }).bindPopup(
                isJourneyLayer
                    ? this.renderJourneyPopup(item as ISupportRequest)
                    : this.renderSupportPopup(item as IVoice),
                {
                    maxWidth: 286,
                    minWidth: 240,
                    className: 'support-map-popup'
                }
            );

            this.markersLayer?.addLayer(marker);
            bounds.extend(position);
        });

        if (items.length > 0 && bounds.isValid()) {
            this.map.fitBounds(bounds.pad(0.26), { animate: true, maxZoom: 4 });
        } else {
            this.map.setView([28, -22], 2);
        }

        this.invalidateSoon();
    }

    private invalidateSoon(): void {
        queueMicrotask(() => this.map?.invalidateSize());
        requestAnimationFrame(() => this.map?.invalidateSize());
        setTimeout(() => this.map?.invalidateSize(), 0);
    }

    private makeMarkerIcon(kind: 'journey' | 'support'): Leaflet.DivIcon {
        const journeyIcon = `
            <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M7 6.5h10a3 3 0 0 1 3 3v4a3 3 0 0 1-3 3h-6.2L7 19.8V16.5A3 3 0 0 1 4 13.5v-4a3 3 0 0 1 3-3Z" fill="currentColor"></path>
            </svg>
        `;
        const supportIcon = `
            <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M5 12.5 18 7l-5.5 13-1.8-5-5-1.8Z" fill="currentColor"></path>
            </svg>
        `;

        return this.L.divIcon({
            className: `support-marker support-marker--${kind}`,
            html: `
                <div class="support-marker__shell">
                    ${kind === 'journey' ? journeyIcon : supportIcon}
                </div>
            `,
            iconSize: [42, 42],
            iconAnchor: [21, 21],
            popupAnchor: [0, -18]
        });
    }

    private renderJourneyPopup(journey: ISupportRequest): string {
        const name = journey.isAnonymous ? 'Anonymous' : (journey.firstName || 'Someone');
        const message = this.escapeHtml(
            this.truncate(journey.additionalNote || journey.diagnosis || 'A journey in need of support.', 104)
        );
        const notes = journey.supportCount ?? journey.comments ?? 0;

        return `
            <div class="map-popup-card">
                <span class="popup-pill popup-pill--journey">Journey</span>
                <h3 class="popup-title">${this.escapeHtml(name)}</h3>
                <div class="popup-location">
                    <span class="popup-location__icon">&#9679;</span>
                    <span>${this.escapeHtml(journey.location)}</span>
                </div>
                <p class="popup-copy">${message}</p>
                <div class="popup-meta">${notes} note${notes === 1 ? '' : 's'} received</div>
                <button class="popup-link popup-link--journey" data-journey-id="${this.escapeHtml(journey.id)}">
                    View Journey
                    <span aria-hidden="true">&rarr;</span>
                </button>
            </div>
        `;
    }

    private renderSupportPopup(card: IVoice): string {
        const title = this.getSupportTitle(card);
        const message = this.escapeHtml(
            this.truncate(card.note || 'A message of hope shared through the WondrVoices feed.', 104)
        );

        return `
            <div class="map-popup-card">
                <span class="popup-pill popup-pill--support">Support</span>
                <h3 class="popup-title">${this.escapeHtml(title)}</h3>
                <div class="popup-location">
                    <span class="popup-location__icon">&#9679;</span>
                    <span>${this.escapeHtml(card.location || 'WondrVoices community')}</span>
                </div>
                <p class="popup-copy">${message}</p>
                <div class="popup-meta">Shared through our public gallery</div>
                <button class="popup-link popup-link--support" data-voice-id="${card.id}">
                    View Card
                    <span aria-hidden="true">&rarr;</span>
                </button>
            </div>
        `;
    }

    private getSupportTitle(card: IVoice): string {
        return card.firstName?.trim() || card.creditTo?.trim() || 'Community Support';
    }

    private truncate(value: string, maxLength: number): string {
        return value.length > maxLength ? `${value.slice(0, maxLength - 1).trimEnd()}...` : value;
    }

    private escapeHtml(value: string): string {
        return value.replace(/[&<>"]/g, (char) => ({
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;'
        }[char] as string));
    }
}

function resolveLeafletNamespace(mod: unknown): any {
    const value = mod as any;
    return value?.default ?? value;
}
