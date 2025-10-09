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
import { VoicesService } from 'src/app/shared/services/voices.service';
import { IVoice } from 'src/app/shared/types/voices';

// ❗ Типы подтянем через import type, чтобы не тянуть рантайм-модуль на сервере
import type * as Leaflet from 'leaflet';

@Component({
    selector: 'app-map',
    standalone: true,
    imports: [CommonModule],
    templateUrl: './map.component.html',
    styleUrls: ['./map.component.scss'],
})
export class MapComponent implements AfterViewInit {
    private voicesSvc = inject(VoicesService);
    private router = inject(Router);
    private destroyRef = inject(DestroyRef);

    // === Signals ===
    voices = signal<IVoice[]>([]);
    queryCity = signal<string | null>(null);
    queryCredit = signal<string | null>(null);
    mapReady = signal(false);

    distinctCities = computed(() => {
        const set = new Set<string>();
        for (const v of this.voices()) {
            const c = [v.location].filter(Boolean).join(', ');
            if (c) set.add(c);
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

    public effect = effect(() => { this.voices(); this.refreshLayers()});

    // ✅ Держим один экземпляр Leaflet, загруженный динамически
    private L!: typeof Leaflet;

    private map?: Leaflet.Map;
    private baseLayer?: Leaflet.TileLayer;
    private clusters?: any; // тип из @types/leaflet.markercluster тянется на рантайме, поэтому any

    mapEl = viewChild.required<ElementRef<HTMLDivElement>>('map');

    async ngAfterViewInit() {
        if (typeof window === 'undefined') return;

        // 1) Один экземпляр Leaflet
        const leafletModule = await import('leaflet');
        this.L = resolveLeafletNamespace(leafletModule);
        (window as any).L = this.L;

        // 2) Важно: UMD-версия плагина, чтобы он пропатчил window.L
        // @ts-ignore
        await import('leaflet.markercluster/dist/leaflet.markercluster.js');

        // 3) Диагностика (можно удалить после проверки)
        console.log('L === window.L', this.L === (window as any).L);
        console.log('has markerClusterGroup', typeof (this.L as any).markerClusterGroup);

        // 4) Дальше обычный поток
        this.initMap();
        await this.loadVoices();
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
        this.voicesSvc
            .getApprovedVoices(250, { page: 0 })
            .pipe(first())
            .subscribe(({ items }) => this.voices.set(items));
    }

    private refreshLayers() {
        if (!this.map || !this.clusters || typeof window === 'undefined') return;

        this.clusters.clearLayers();

        const current = this.filtered();
        let withCoords = 0;

        for (const v of current) {
            if (v.lat == null || v.lng == null) continue;
            withCoords++;

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

        console.log('voices total:', current.length, 'with coords:', withCoords);

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

    @HostListener('document:click', ['$event'])
    protected onDocClick = (e: MouseEvent) => {
        const target = e.target as HTMLElement;
        const link = target.closest('.vp-link') as HTMLAnchorElement | null;
        if (!link) return;

        const id = link.dataset['voiceId'];
        if (!id) return;

        e.preventDefault();
        e.stopPropagation();

        this.router.navigate(['/voices', id]);
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
    }

    // === Helpers ===
    private makeDotIcon(kind: 'city' | 'voice'): Leaflet.DivIcon {
        const bg = kind === 'city' ? '#3b82f6' : '#22c55e';
        const border = kind === 'city' ? '#1d4ed8' : '#15803d';
        const html = `<div class="lv-dot" style="--bg:${bg};--bd:${border}"></div>`;
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