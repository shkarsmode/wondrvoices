// src/app/features/map/map.component.ts
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
import { first } from 'rxjs';
import { RequestsService } from 'src/app/shared/services/requests.service';
import { VoicesService } from 'src/app/shared/services/voices.service';
import { ISupportRequest } from 'src/app/shared/types/request-support.types';
import { IVoice } from 'src/app/shared/types/voices';

// ❗ Типы подтянем через import type, чтобы не тянуть рантайм-модуль на сервере
import type * as Leaflet from 'leaflet';

@Component({
    selector: 'app-map',
    imports: [CommonModule],
    templateUrl: './map.component.html',
    styleUrls: ['./map.component.scss']
})
export class MapComponent implements AfterViewInit {
    private voicesSvc = inject(VoicesService);
    private requestsSvc = inject(RequestsService);
    private router = inject(Router);
    private destroyRef = inject(DestroyRef);

    // === Signals ===
    voices = signal<IVoice[]>([]);
    journeys = signal<ISupportRequest[]>([]);
    queryCity = signal<string | null>(null);
    queryCredit = signal<string | null>(null);
    queryLayer = signal<'all' | 'voices' | 'journeys'>('all');
    mapReady = signal(false);

    distinctCities = computed(() => {
        const set = new Set<string>();
        for (const v of this.voices()) {
            const c = [v.location].filter(Boolean).join(', ');
            if (c) set.add(c);
        }
        for (const j of this.journeys()) {
            if (j.location) set.add(j.location);
        }
        return Array.from(set).sort((a, b) => a.localeCompare(b));
    });

    distinctCredits = computed(() => {
        const set = new Set<string>();
        for (const v of this.voices()) {
            if (v.creditTo) set.add(v.creditTo);
        }
        return Array.from(set).sort((a, b) => a.localeCompare(b));
    });

    filtered = computed(() => {
        const byCity = this.queryCity();
        const byCred = this.queryCredit();
        return this.voices().filter((v) => {
            const cityLabel = [v.location].filter(Boolean).join(', ');
            const okCity = !byCity || cityLabel === byCity;
            const okCred = !byCred || v.creditTo === byCred;
            return okCity && okCred;
        });
    });

    filteredJourneys = computed(() => {
        const byCity = this.queryCity();
        return this.journeys().filter((j) => {
            const okCity = !byCity || j.location === byCity;
            return okCity;
        });
    });

    totalCount = computed(() => {
        const layer = this.queryLayer();
        if (layer === 'voices') return this.filtered().length;
        if (layer === 'journeys') return this.filteredJourneys().length;
        return this.filtered().length + this.filteredJourneys().length;
    });

    public effect = effect(() => { this.voices(); this.journeys(); this.queryLayer(); this.refreshLayers() });

    private L!: typeof Leaflet;

    private map?: Leaflet.Map;
    private baseLayer?: Leaflet.TileLayer;
    private clusters?: any;

    mapEl = viewChild.required<ElementRef<HTMLDivElement>>('map');

    async ngAfterViewInit() {
        if (typeof window === 'undefined') return;

        const leafletModule = await import('leaflet');
        this.L = resolveLeafletNamespace(leafletModule);
        (window as any).L = this.L;

        // @ts-ignore
        await import('leaflet.markercluster/dist/leaflet.markercluster.js');


        this.initMap();
        await Promise.all([this.loadVoices(), this.loadJourneys()]);
        this.mapReady.set(true);
        this.refreshLayers();
        this.invalidateSoon();

        window.addEventListener('resize', () => this.map?.invalidateSize());
    }

    private initMap() {
        this.map = this.L.map(this.mapEl().nativeElement, {
            preferCanvas: true,
            zoomControl: true,
        }).setView([50.4501, 30.5234], 6);

        this.baseLayer = this.L.tileLayer(
            'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png',
            { maxZoom: 19, attribution: '&copy; OpenStreetMap &copy; CARTO' }
        ).addTo(this.map);

        this.clusters = (this.L as any).markerClusterGroup({
            showCoverageOnHover: false,
            maxClusterRadius: 45,
            spiderfyOnEveryZoom: false,
            zoomToBoundsOnClick: true,
            disableClusteringAtZoom: 20,
        });

        this.map.addLayer(this.clusters);
    }

    private async loadVoices() {
        if (typeof window === 'undefined') {
            return;
        }
    
        const limit = 100;
        let page = 1;
        const allVoices: IVoice[] = [];
    
        console.log('[Map] loading voices...');
    
        while (true) {
            const response = await this.voicesSvc
                .getApprovedVoices(limit, { page })
                .pipe(first())
                .toPromise();

            const items = response?.items;
            if (!items) {
                break;
            }
    
            console.log('[Map] page', page, 'items:', items.length);
    
            if (!items.length) {
                break;
            }
    
            allVoices.push(...items);
    
            // если вернулось меньше limit — значит это последняя страница
            if (items.length < limit) {
                break;
            }
    
            page++;
        }
    
        console.log('[Map] total voices loaded:', allVoices.length);
    
        this.voices.set(allVoices);
    }

    private async loadJourneys() {
        if (typeof window === 'undefined') return;

        const limit = 100;
        let page = 1;
        const allJourneys: ISupportRequest[] = [];

        console.log('[Map] loading journeys...');

        while (true) {
            const response = await this.requestsSvc
                .getBrowseRequests({ limit, page })
                .pipe(first())
                .toPromise();

            const items = response?.items;
            if (!items || !items.length) break;

            console.log('[Map] journeys page', page, 'items:', items.length);
            allJourneys.push(...items);

            if (items.length < limit) break;
            page++;
        }

        console.log('[Map] total journeys loaded:', allJourneys.length);
        this.journeys.set(allJourneys);
    }

    private refreshLayers() {
        if (!this.map || !this.clusters || typeof window === 'undefined') return;

        this.clusters.clearLayers();

        const layer = this.queryLayer();
        let totalWithCoords = 0;

        // Add voice markers
        if (layer === 'all' || layer === 'voices') {
            const current = this.filtered();

            for (const v of current) {
                if (v.lat == null || v.lng == null) continue;
                totalWithCoords++;

                const m = this.L
                    .marker([Number(v.lat), Number(v.lng)], { icon: this.makeDotIcon('voice') })
                    .bindPopup(this.renderVoicePopup(v), {
                        maxWidth: 320,
                        minWidth: 240,
                        className: 'voice-popup',
                    });

                m.on('popupopen', (ev: Leaflet.LeafletEvent) => {
                    const popup = (ev as any).popup as Leaflet.Popup;
                    const el = popup.getElement();
                    if (!el) return;
                    el.querySelectorAll('img').forEach((img: HTMLImageElement) => {
                        if (img.complete) return;
                        img.addEventListener('load', () => popup.update(), { once: true });
                        img.addEventListener('error', () => { img.style.display = 'none'; popup.update(); }, { once: true });
                    });
                });

                this.clusters.addLayer(m);
            }
        }

        // Add journey markers
        if (layer === 'all' || layer === 'journeys') {
            const currentJourneys = this.filteredJourneys();

            for (const j of currentJourneys) {
                if (j.lat == null || j.lng == null) continue;
                totalWithCoords++;

                const m = this.L
                    .marker([Number(j.lat), Number(j.lng)], { icon: this.makeDotIcon('journey') })
                    .bindPopup(this.renderJourneyPopup(j), {
                        maxWidth: 320,
                        minWidth: 240,
                        className: 'journey-popup',
                    });

                this.clusters.addLayer(m);
            }
        }

        console.log('map markers:', totalWithCoords, '(layer:', layer, ')');

        const b = this.clusters.getBounds();
        if (b.isValid()) {
            this.map.fitBounds(b.pad(0.2), { animate: true });
        }

        this.invalidateSoon();
    }

    private invalidateSoon() {
        queueMicrotask(() => this.map?.invalidateSize());
        requestAnimationFrame(() => this.map?.invalidateSize());
        setTimeout(() => this.map?.invalidateSize(), 0);
    }

    private renderVoicePopup(v: IVoice): string {
        const loc = [v.location].filter(Boolean).join(', ');
        const who = v.creditTo ? `<div><small>Credit to: ${this.escapeHtml(v.creditTo)}</small></div>` : '';

        const msg = v.note
            ? `<div class="msg">${this.escapeHtml(v.note)}</div>`
            : '';

        const img = v.img
            ? `<div class="vp-img">
                    <img src="${this.escapeHtml(v.img)}" alt="" width="250" height="250" loading="lazy" style="view-transition-name: img-voice-${v.id};"/>
               </div>`
            : '';

        return `
            <div class="voice-popup">
                <div><strong class="vp-link" data-voice-id="${v.id}">Voice #${v.id}</strong></div>
                ${loc ? `<div>${this.escapeHtml(loc)}</div>` : ''}
                ${who}
                ${msg}
                ${img}
                <button class="vp-link" data-voice-id="${v.id}">Show</button>
            </div>
        `;
    }

    private renderJourneyPopup(j: ISupportRequest): string {
        const name = j.isAnonymous ? 'Anonymous' : (j.firstName || 'Someone');
        const loc = j.location ? `<div>${this.escapeHtml(j.location)}</div>` : '';
        const diagnosis = j.diagnosis ? `<div><small>${this.escapeHtml(j.diagnosis)}</small></div>` : '';
        const stage = j.journeyStage ? `<div><small>${this.escapeHtml(j.journeyStage)}</small></div>` : '';
        const hearts = j.hearts ? `<span>❤️ ${j.hearts}</span>` : '';
        const comments = j.comments ? `<span>💬 ${j.comments}</span>` : '';
        const meta = (hearts || comments) ? `<div class="jp-meta">${hearts} ${comments}</div>` : '';

        return `
            <div class="journey-popup">
                <div><strong class="jp-link" data-journey-id="${j.id}">${this.escapeHtml(name)}'s Journey</strong></div>
                ${loc}
                ${diagnosis}
                ${stage}
                ${meta}
                <button class="jp-link" data-journey-id="${j.id}">View Journey</button>
            </div>
        `;
    }

    @HostListener('document:click', ['$event'])
    protected onDocClick = (e: MouseEvent) => {
        const target = e.target as HTMLElement;

        // Handle voice popup links
        const voiceLink = target.closest('.vp-link') as HTMLElement | null;
        if (voiceLink) {
            const id = voiceLink.dataset['voiceId'];
            if (id) {
                e.preventDefault();
                e.stopPropagation();
                this.router.navigate(['/voices', id]);
                return;
            }
        }

        // Handle journey popup links
        const journeyLink = target.closest('.jp-link') as HTMLElement | null;
        if (journeyLink) {
            const id = journeyLink.dataset['journeyId'];
            if (id) {
                e.preventDefault();
                e.stopPropagation();
                this.router.navigate(['/request', id]);
                return;
            }
        }
    };

    setCity(c: string | null) {
        this.queryCity.set(c);
    }

    setCredit(c: string | null) {
        this.queryCredit.set(c);
    }

    clearFilters() {
        this.queryCity.set(null);
        this.queryCredit.set(null);
        this.queryLayer.set('all');
    }

    setLayer(layer: 'all' | 'voices' | 'journeys') {
        this.queryLayer.set(layer);
    }

    // === Helpers ===
    private makeDotIcon(kind: 'city' | 'voice' | 'journey'): Leaflet.DivIcon {
        const colors: Record<string, { bg: string; bd: string }> = {
            city: { bg: '#3b82f6', bd: '#1d4ed8' },
            voice: { bg: '#22c55e', bd: '#15803d' },
            journey: { bg: '#8b5cf6', bd: '#6d28d9' },
        };
        const c = colors[kind] || colors['voice'];
        const html = `<div class="lv-dot" style="--bg:${c.bg};--bd:${c.bd}"></div>`;
        return this.L.divIcon({
            className: 'lv-dot-wrap',
            html,
            iconSize: [18, 18],
            iconAnchor: [9, 9],
            popupAnchor: [0, -10],
        });
    }

    private escapeHtml(s: string): string {
        return s.replace(/[&<>"]+/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));
    }
}

function resolveLeafletNamespace(mod: unknown): any {
    const m = mod as any;
    return m?.default ?? m; // some builds export under default
}