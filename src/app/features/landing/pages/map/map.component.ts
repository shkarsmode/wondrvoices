// src/app/features/map/map.component.ts
import { CommonModule } from '@angular/common';
import {
    AfterViewInit,
    Component,
    DestroyRef,
    ElementRef,
    computed,
    effect,
    inject,
    signal,
    viewChild,
} from '@angular/core';
import * as L from 'leaflet';
import { first } from 'rxjs';
import { VoicesService } from 'src/app/shared/services/voices.service';
import { IVoice } from 'src/app/shared/types/voices';

// подключаем кластеризацию (обязательно после leaflet)
import 'leaflet.markercluster';

@Component({
    selector: 'app-map',
    standalone: true,
    imports: [CommonModule],
    templateUrl: './map.component.html',
    styleUrls: ['./map.component.scss'],
})
export class MapComponent implements AfterViewInit {
    private voicesSvc = inject(VoicesService);
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

    // триггерим перерисовку слоёв, когда меняются фильтры/данные
    public effect = effect(() => this.refreshLayers());

    // === Leaflet state ===
    private map?: L.Map;
    private baseLayer?: L.TileLayer;

    // Кластерный слой (заменяет voicesLayer)
    private clusters: L.MarkerClusterGroup = L.markerClusterGroup({
        showCoverageOnHover: false,
        maxClusterRadius: 45,
        spiderfyOnEveryZoom: false,
        zoomToBoundsOnClick: true,
        disableClusteringAtZoom: 16,
    });

    // контейнер карты
    mapEl = viewChild.required<ElementRef<HTMLDivElement>>('map');

    async ngAfterViewInit() {
        if (typeof window === 'undefined') return;

        this.initMap();
        await this.loadVoices();
        this.mapReady.set(true);
        this.refreshLayers();
        this.invalidateSoon();

        window.addEventListener('resize', () => this.map?.invalidateSize());
    }

    private initMap() {
        this.map = L.map(this.mapEl().nativeElement, {
            preferCanvas: true,
            zoomControl: true,
        }).setView([50.4501, 30.5234], 6); // старт — Киев (неважно, всё равно fitBounds)

        this.baseLayer = L.tileLayer(
            'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png',
            {
                maxZoom: 19,
                attribution:
                    '&copy; OpenStreetMap &copy; CARTO',
            }
        ).addTo(this.map);

        // подключаем кластерный слой
        this.map.addLayer(this.clusters);
    }

    private async loadVoices() {
        this.voicesSvc
            .getApprovedVoices(250, { page: 0 })
            .pipe(first())
            .subscribe(({ items }) => this.voices.set(items));
    }

    private refreshLayers() {
        if (!this.map || typeof window === 'undefined') return;

        // очищаем кластеры и наполняем заново
        this.clusters.clearLayers();

        const current = this.filtered();

        for (const v of current) {
            if (v.lat == null || v.lng == null) continue;

            const m = L.marker([v.lat, v.lng], { icon: makeDotIcon('voice') }).bindPopup(
                this.renderVoicePopup(v),
                { maxWidth: 320, minWidth: 240, className: 'voice-popup' },
            );

            // Поправка размеров после загрузки изображений в попапе
            m.on('popupopen', (ev: L.LeafletEvent) => {
                const popup = (ev as any).popup as L.Popup;
                const el = popup.getElement();
                if (!el) return;

                el.querySelectorAll('img').forEach((img: HTMLImageElement) => {
                    if (img.complete) return;
                    img.addEventListener('load', () => popup.update(), { once: true });
                    img.addEventListener(
                        'error',
                        () => {
                            img.style.display = 'none';
                            popup.update();
                        },
                        { once: true },
                    );
                });
            });

            this.clusters.addLayer(m);
        }

        // зум/центр по границам всех кластеров
        const b = this.clusters.getBounds();
        if (b.isValid()) {
            this.map.fitBounds(b.pad(0.2), { animate: true });
        }

        this.invalidateSoon();
    }

    private invalidateSoon() {
        // несколько тиков, чтобы убрать артефакты раскладки
        queueMicrotask(() => this.map?.invalidateSize());
        requestAnimationFrame(() => this.map?.invalidateSize());
        setTimeout(() => this.map?.invalidateSize(), 0);
    }

    private renderVoicePopup(v: IVoice): string {
        const loc = [v.location].filter(Boolean).join(', ');
        const who = v.creditTo ? `<div><small>Credit to: ${escapeHtml(v.creditTo)}</small></div>` : '';

        const msg = v.note
            ? `
            <div class="msg">
                ${escapeHtml(v.note)}
            </div>`
            : '';

        const img = v.img
            ? `
            <div class="vp-img">
                <img src="${escapeHtml(v.img)}" alt="" width="250" height="250" loading="lazy"/>
            </div>`
            : '';

        return `
            <div class="voice-popup">
                <div><strong>Voice #${v.id}</strong></div>
                ${loc ? `<div>${escapeHtml(loc)}</div>` : ''}
                ${who}
                ${msg}
                ${img}
            </div>
        `;
    }

    // === UI handlers ===
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
}

// === Helpers (no external assets) ===
function makeDotIcon(kind: 'city' | 'voice'): L.DivIcon {
    const bg = kind === 'city' ? '#3b82f6' : '#22c55e'; // blue vs green
    const border = kind === 'city' ? '#1d4ed8' : '#15803d';
    const html = `<div class="lv-dot" style="--bg:${bg};--bd:${border}"></div>`;
    return L.divIcon({
        className: 'lv-dot-wrap',
        html,
        iconSize: [18, 18],
        iconAnchor: [9, 9],
        popupAnchor: [0, -10],
    });
}

function escapeHtml(s: string): string {
    return s.replace(/[&<>"]+/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));
}
