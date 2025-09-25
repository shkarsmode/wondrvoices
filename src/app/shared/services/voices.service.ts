import { HttpClient, HttpParams } from '@angular/common/http';
import { Inject, Injectable } from '@angular/core';
import { Observable, of, tap } from 'rxjs';
import { CreateVoiceRequest, IVoice, UpdateVoiceRequest, VoicesListResponse, VoiceStatus } from '../types/voices';
import { BASE_PATH_API } from './variables';

@Injectable({
    providedIn: 'root'
})
export class VoicesService {

    private readonly path = 'voices';

    public cachedCards: { [key: number]: IVoice } = {};
    public cache: { [key: string]: IVoice[] } = {};

    constructor(
        private http: HttpClient,
        @Inject(BASE_PATH_API) private basePathApi: string
    ) { }

    /** Admin list with optional status filter */
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
    ) {
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
            return of({ items: this.cache[stringifiedExtra] });
        }
        return this.http.get<VoicesListResponse>(
            `${this.basePathApi}/${this.path}${approvedUrl}?timestamp=${Date.now()}`,
            { params }
        )
            .pipe(
                tap(({ items }) => {
                    this.cache = {
                        ...this.cache,
                        [stringifiedExtra]: items
                    };
                })
            )
    }

    getSuggestions(
        field: 'creditTo'|'location'|'what'|'express',
        q: string,
        opts?: { limit?: number; status?: 'approved'|'pending'|'rejected'|'all' }
    ) {
        let params = new HttpParams()
            .set('field', field)
            .set('limit', String(opts?.limit ?? 10));
        if (q?.trim()) params = params.set('q', q.trim());
        if (opts?.status) params = params.set('status', opts.status);
        return this.http.get<string[]>(`${this.basePathApi}/voices/suggest`, { params });
    }

    public getApprovedVoices(limit: number, extra?: Parameters<typeof this.getVoices>[2]) {
        return this.getVoices(limit, VoiceStatus.Approved, extra)
            .pipe(tap(cards => {
                this.cachedCards = 
                    cards.items.reduce((acc, card) => ({ ...acc, [card.id]: card }), {});
            }))
    }

    public getApprovedVoiceById(id: number): Observable<IVoice> {
        return this.getVoiceById(id, VoiceStatus.Approved);
    }

    public getVoiceById(id: number, status?: VoiceStatus): Observable<IVoice> {
        const approvedUrl = status === VoiceStatus.Approved ? '/approved' : '';
        return this.http.get<IVoice>(
            `${this.basePathApi}/${this.path}${approvedUrl}/${id}`
        );
    }

    /** Public create: now expects JSON body with `img` URL (not multipart) */
    public createVoice(payload: CreateVoiceRequest): Observable<IVoice> {
        return this.http.post<IVoice>(
            `${this.basePathApi}/${this.path}`,
            payload
        );
    }

    /** Admin update (partial fields; not for status) */
    public updateVoiceById(id: number, payload: UpdateVoiceRequest): Observable<{ affected: number }> {
        return this.http.patch<{ affected: number }>(
            `${this.basePathApi}/${this.path}/${id}`,
            payload
        );
    }

    /** Admin: change moderation status only */
    public setVoiceStatus(id: number, status: VoiceStatus): Observable<{ affected: number; id: number; status: VoiceStatus }> {
        return this.http.patch<{ affected: number; id: number; status: VoiceStatus }>(
            `${this.basePathApi}/${this.path}/${id}/status`,
            { status }
        );
    }

    /** Admin: delete voice */
    public deleteVoiceById(id: number): Observable<{ affected: number }> {
        return this.http.delete<{ affected: number }>(
            `${this.basePathApi}/${this.path}/${id}`
        );
    }
}
