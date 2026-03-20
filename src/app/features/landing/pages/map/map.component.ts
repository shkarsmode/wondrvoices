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
    private clusters?: any;

    readonly mapEl = viewChild.required<ElementRef<HTMLDivElement>>('map');

    async ngAfterViewInit(): Promise<void> {
        if (typeof window === 'undefined') {
            return;
        }

        const leafletModule = await import('leaflet');
        this.L = resolveLeafletNamespace(leafletModule);
        (window as any).L = this.L;
        await import('leaflet.markercluster');

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
        }).setView([32, -32], 2);

        this.L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            maxZoom: 18,
            attribution: '&copy; OpenStreetMap contributors'
        }).addTo(this.map);
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
        if (!this.map) {
            return;
        }

        const isJourneyLayer = this.activeLayer() === 'journeys';
        const items = isJourneyLayer ? this.journeyMarkers() : this.supportMarkers();
        const markerKind = isJourneyLayer ? 'journey' : 'support';
        const bounds = this.L.latLngBounds([]);

        if (this.clusters) {
            this.map.removeLayer(this.clusters);
        }

        this.clusters = (this.L as any).markerClusterGroup({
            showCoverageOnHover: false,
            maxClusterRadius: 46,
            spiderfyOnMaxZoom: true,
            zoomToBoundsOnClick: true,
            // disableClusteringAtZoom: 7,
            iconCreateFunction: (cluster: any) => this.makeClusterIcon(markerKind, cluster.getChildCount())
        });

        items.forEach((item) => {
            const lat = Number(item.lat);
            const lng = Number(item.lng);

            if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
                return;
            }

            const position: [number, number] = [lat, lng];
            const marker = this.L.marker(position, {
                icon: this.makeMarkerIcon(markerKind)
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

            this.clusters.addLayer(marker);
            bounds.extend(position);
        });

        this.map.addLayer(this.clusters);

        if (items.length > 0 && bounds.isValid()) {
            this.map.fitBounds(bounds.pad(0.26), { animate: true, maxZoom: 4 });
        } else {
            this.map.setView([32, -32], 2);
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
            className: 'marker-single-custom',
            html: `
                <div class="${kind === 'journey' ? 'single-marker-request' : 'single-marker-submission'}">
                    ${kind === 'journey' ? journeyIcon : supportIcon}
                </div>
            `,
            iconSize: [36, 36],
            iconAnchor: [18, 18],
            popupAnchor: [0, -18]
        });
    }

    private makeClusterIcon(kind: 'journey' | 'support', count: number): Leaflet.DivIcon {
        const sizeClass = count < 10 ? 'cluster-small' : count < 100 ? 'cluster-medium' : 'cluster-large';
        const themeClass = kind === 'journey' ? 'cluster-icon-request' : 'cluster-icon-submission';

        return this.L.divIcon({
            className: 'marker-cluster-custom',
            html: `<div class="${themeClass} ${sizeClass}"><span>${count}</span></div>`,
            iconSize: [50, 50],
            iconAnchor: [25, 25]
        });
    }

    private renderJourneyPopup(journey: ISupportRequest): string {
        const name = journey.isAnonymous ? 'Anonymous' : (journey.firstName || 'Someone');
        const summary = this.escapeHtml(journey.diagnosis || 'A journey in need of support.');
        const notes = journey.supportCount ?? journey.comments ?? 0;

        return `
            <div style="padding: 8px; min-width: 200px;">
                <div style="display: flex; align-items: center; gap: 6px; margin-bottom: 6px;">
                    <span style="background: #428cd7; color: white; padding: 2px 8px; border-radius: 12px; font-size: 10px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.04em;">
                        Journey
                    </span>
                </div>
                <strong style="color: #cf866e; font-size: 14px;">
                    ${this.escapeHtml(name)}
                </strong><br>
                <span style="color: #666; font-size: 12px;">&#128205; ${this.escapeHtml(journey.location)}</span><br>
                <span style="font-size: 13px; margin-top: 4px; display: block;">
                    ${summary}
                </span><br>
                <span style="color: #59c08c; font-size: 12px;">
                    &#9989; ${notes} note${notes === 1 ? '' : 's'} received
                </span><br>
                <button data-journey-id="${this.escapeHtml(journey.id)}" style="color: #cf866e; font-size: 13px; font-weight: 600; text-decoration: none; display: inline-block; margin-top: 6px; border: 0; background: transparent; padding: 0; cursor: pointer;">
                    View Journey &rarr;
                </button>
            </div>
        `;
    }

    private renderSupportPopup(card: IVoice): string {
        const title = this.escapeHtml(this.getSupportTitle(card));
        const location = this.escapeHtml(card.location || 'WondrVoices community');
        const secondary = card.creditTo?.trim()
            ? `Shared by: ${this.escapeHtml(card.creditTo.trim())}`
            : 'Shared through our public gallery';

        return `
            <div style="padding: 8px; min-width: 200px;">
                <div style="display: flex; align-items: center; gap: 6px; margin-bottom: 6px;">
                    <span style="background: #59c08c; color: white; padding: 2px 8px; border-radius: 12px; font-size: 10px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.04em;">
                        Support Sent
                    </span>
                </div>
                <strong style="color: #59c08c; font-size: 14px;">
                    From ${title}
                </strong><br>
                <span style="color: #666; font-size: 12px;">&#128205; ${location}</span><br>
                <span style="font-size: 12px; color: #888; margin-top: 4px; display: block;">
                    ${secondary}
                </span><br>
                <button data-voice-id="${card.id}" style="color: #59c08c; font-size: 12px; text-decoration: none; border: 0; background: transparent; padding: 0; cursor: pointer;">
                    View Card &rarr;
                </button>
            </div>
        `;
    }

    private getSupportTitle(card: IVoice): string {
        return card.firstName?.trim() || card.creditTo?.trim() || 'Community Support';
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
