import { HttpClient, HttpParams } from '@angular/common/http';
import { Inject, Injectable } from '@angular/core';
import { map, Observable, of, tap } from 'rxjs';
import { CreateVoiceRequest, IVoice, UpdateVoiceRequest, VoicesListResponse, VoiceStatus } from '../types/voices';
import { BASE_PATH_API } from './variables';

export type SuggestAllDto = {
    location: string[];
    creditTo: string[];
    tag: string[]; // what ∪ express
};

export type SuggestField = 'creditTo' | 'location' | 'what' | 'express' | 'all';

type SuggestRow = { kind: 'location' | 'credit_to' | 'tag'; value: string; freq: number };

@Injectable({ providedIn: 'root' })
export class VoicesService {
    private readonly path = 'voices';

    public suggestAllIndex: SuggestAllDto | {} = {};
    public cachedCards: { [key: number]: IVoice } = {};
    public cache: { [key: string]: IVoice[] } = {};

    constructor(
        private http: HttpClient,
        @Inject(BASE_PATH_API) private basePathApi: string
    ) {}

    public getVoices(
        limit: number,
        status?: VoiceStatus,
        extra?: {
            location?: string; description?: string; creditTo?: string;
            tags?: string[]; tab?: string;
            tagsMode?: 'any' | 'all';
            orderBy?: 'createdAt' | 'id'; orderDir?: 'ASC' | 'DESC';
            page?: number
        }
    ): Observable<VoicesListResponse> {
        const stringifiedExtra = JSON.stringify(extra);

        let params = new HttpParams().set('limit', String(limit)).set('page', String(extra?.page));
        if (status) params = params.set('status', status);
        if (extra?.location) params = params.set('location', extra.location);
        if (extra?.description) params = params.set('description', extra.description);
        if (extra?.creditTo) params = params.set('creditTo', extra.creditTo);
        if (extra?.tab) params = params.set('tab', extra.tab);
        if (extra?.tags?.length) params = params.set('tags', extra.tags.join(','));
        if (extra?.tagsMode) params = params.set('tagsMode', extra.tagsMode);
        if (extra?.orderBy) params = params.set('orderBy', extra.orderBy);
        if (extra?.orderDir) params = params.set('orderDir', extra.orderDir);

        const approvedUrl = status === VoiceStatus.Approved ? '/approved' : '';

        if (this.cache[stringifiedExtra]) {
            return of({ items: this.cache[stringifiedExtra], total: this.cache[stringifiedExtra].length });
        }
        return this.http.get<VoicesListResponse>(
            `${this.basePathApi}/${this.path}${approvedUrl}?timestamp=${Date.now()}`,
            { params }
        ).pipe(
            tap(({ items }) => {
                this.cache = { ...this.cache, [stringifiedExtra]: items };
            })
        );
    }

    // ──────────────────────── SUGGESTS (server → normalize → filter on client) ────────────────────────

    /** Old signature kept; now always normalizes payload (rows[] or DTO) and caches DTO. */
    public getSuggestAllIndex(): Observable<SuggestAllDto> {
        if ('location' in this.suggestAllIndex) {
            return of(this.suggestAllIndex as SuggestAllDto);
        }
        return this.http
            .get<SuggestRow[] | SuggestAllDto>(`${this.basePathApi}/voices/suggest-all`)
            .pipe(
                map(payload => this.normalizeSuggestRows(payload)),
                tap(dto => { this.suggestAllIndex = dto; })
            );
    }

    /** New: return filtered per-kind results by word-start, by default 3 per kind (for "all" UI). */
    public getSuggestAllFiltered(query: string, perKindLimit: number = 3): Observable<SuggestAllDto> {
        const q = (query ?? '').trim();
        if (!q) {
            // Empty query: return first N per kind from cached/all index.
            return this.getSuggestAllIndex().pipe(
                map(idx => ({
                    location: idx.location.slice(0, perKindLimit),
                    creditTo: idx.creditTo.slice(0, perKindLimit),
                    tag: idx.tag.slice(0, perKindLimit),
                }))
            );
        }
        return this.getSuggestAllIndex().pipe(
            map(idx => {
                return {
                    location: this.filterStartsAtWord(idx.location, q, perKindLimit),
                    creditTo: this.filterStartsAtWord(idx.creditTo, q, perKindLimit),
                    tag: this.filterStartsAtWord(idx.tag, q, perKindLimit),
                };
            })
        );
    }

    /** New: return filtered list for a specific field (location/creditTo/tag) with limit. */
    public getSuggestionsSpecific(field: 'location' | 'creditTo' | 'tab', q: string, limit: number = 10): Observable<string[]> {
        const qtrim = (q ?? '').trim();
        return this.getSuggestAllIndex().pipe(
            map(idx => {
                const source =
                    field === 'location' ? idx.location :
                    field === 'creditTo' ? idx.creditTo :
                    idx.tag;
                if (!qtrim) return source.slice(0, Math.max(1, limit | 0));
                return this.filterStartsAtWord(source, qtrim, Math.max(1, limit | 0));
            })
        );
    }

    // Kept for backward compatibility if что-то ещё зовёт этот метод с серверной фильтрацией.
    getSuggestions(field: SuggestField, q: string, opts?: { limit?: number }) {
        // Prefer client-side filtering over server calls.
        const apiField = field === 'what' || field === 'express' ? 'tab' : field;
        if (apiField === 'all') {
            return this.getSuggestAllFiltered(q, 3);
        }
        return this.getSuggestionsSpecific(apiField as 'location' | 'creditTo' | 'tab', q, opts?.limit ?? 10);
    }

    // ──────────────────────── other CRUD ────────────────────────

    public getApprovedVoices(
        limit: number,
        extra?: Parameters<typeof this.getVoices>[2]
    ): Observable<VoicesListResponse> {
        return this.getVoices(limit, VoiceStatus.Approved, extra)
            .pipe(tap(cards => {
                this.cachedCards =
                    cards.items.reduce((acc, card) => ({ ...acc, [card.id]: card }), {});
            }));
    }

    public getApprovedVoiceById(id: number): Observable<IVoice> {
        return this.getVoiceById(id, VoiceStatus.Approved);
    }

    public getVoiceById(id: number, status?: VoiceStatus): Observable<IVoice> {
        const approvedUrl = status === VoiceStatus.Approved ? '/approved' : '';
        return this.http.get<IVoice>(`${this.basePathApi}/${this.path}${approvedUrl}/${id}`);
    }

    public createVoice(payload: CreateVoiceRequest): Observable<IVoice> {
        return this.http.post<IVoice>(`${this.basePathApi}/${this.path}`, payload);
    }

    public updateVoiceById(id: number, payload: UpdateVoiceRequest): Observable<{ affected: number }> {
        return this.http.patch<{ affected: number }>(`${this.basePathApi}/${this.path}/${id}`, payload);
    }

    /** Admin: change moderation status only */
    public setVoiceStatus(id: number, status: VoiceStatus): Observable<{ affected: number; id: number; status: VoiceStatus }> {
        return this.http.patch<{ affected: number; id: number; status: VoiceStatus }>(
            `${this.basePathApi}/${this.path}/${id}/status`,
            { status }
        );
    }

    public deleteVoiceById(id: number): Observable<{ affected: number }> {
        return this.http.delete<{ affected: number }>(`${this.basePathApi}/${this.path}/${id}`);
    }

    // ──────────────────────── helpers ────────────────────────

    /** Accepts either DTO or flat rows[] and returns DTO. */
    private normalizeSuggestRows(payload: SuggestRow[] | SuggestAllDto): SuggestAllDto {
        if (!Array.isArray(payload)) {
            return {
                location: payload.location ?? [],
                creditTo: payload.creditTo ?? [],
                tag: payload.tag ?? [],
            };
        }
        const out: SuggestAllDto = { location: [], creditTo: [], tag: [] };
        const seenLoc = new Set<string>();
        const seenCred = new Set<string>();
        const seenTag = new Set<string>();

        for (const r of payload) {
            if (!r?.value) continue;
            const v = r.value;
            if (r.kind === 'location') {
                if (!seenLoc.has(v)) { out.location.push(v); seenLoc.add(v); }
            } else if (r.kind === 'credit_to') {
                if (!seenCred.has(v)) { out.creditTo.push(v); seenCred.add(v); }
            } else {
                if (!seenTag.has(v)) { out.tag.push(v); seenTag.add(v); }
            }
        }
        return out;
    }

    /** True if char is a word separator (space, underscore, dash, slash, dot, brackets, punctuation, quotes incl. Unicode). */
    private isSep(ch: string): boolean {
        // keep it simple but broad; add more if встретишь в данных
        return /[\s/_\-\.\(\)\[\],:;&]|[’'“”"‘]|[–—]/.test(ch);
    }

    /** Strict word-start filtering: only start-of-string or after a separator. Preserves order, caps by limit. */
    private filterStartsAtWord(source: string[], query: string, limit: number): string[] {
        if (!Array.isArray(source) || source.length === 0) return [];
        const q = (query ?? '').toLowerCase();
        if (!q) return [];

        const out: string[] = [];
        for (const original of source) {
            const text = String(original ?? '');
            const s = text.toLowerCase();

            let idx = s.indexOf(q);
            let matched = false;

            while (idx !== -1) {
                const ok = idx === 0 || this.isSep(s[idx - 1]);
                if (ok) { matched = true; break; }
                idx = s.indexOf(q, idx + 1);
            }

            if (matched) {
                out.push(original);
                if (out.length >= limit) break;
            }
        }
        return out;
    }

    /** Build case-insensitive regex for word-start across separators. */
    private buildWordStartRegex(query: string): RegExp {
        const escaped = query.replace(/[\\.^$|?*+()[\]{}]/g, '\\$&');
        return new RegExp(`(?:^|[\\s_\\-\\/\\.])(${escaped})`, 'gi');
    }
}
