import { HttpClient, HttpParams } from '@angular/common/http';
import { Inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { CreateVoiceRequest, IVoice, UpdateVoiceRequest, VoicesListResponse, VoiceStatus } from '../types/voices';
import { BASE_PATH_API } from './variables';

@Injectable({
    providedIn: 'root'
})
export class VoicesService {

    private readonly path = 'voices';

    constructor(
        private http: HttpClient,
        @Inject(BASE_PATH_API) private basePathApi: string
    ) { }

    /** Admin list with optional status filter */
    public getVoices(
        limit: number,
        page: number,
        status?: VoiceStatus,
        extra?: {
            title?: string; description?: string; creditTo?: string;
            tags?: string[]; tab?: string;
            tagsMode?: 'any' | 'all';
            orderBy?: 'createdAt' | 'id'; orderDir?: 'ASC' | 'DESC';
        }
    ) {
        let params = new HttpParams().set('limit', String(limit)).set('page', String(page));
        if (status) params = params.set('status', status);
        if (extra?.title) params = params.set('title', extra.title);
        if (extra?.description) params = params.set('description', extra.description);
        if (extra?.creditTo) params = params.set('creditTo', extra.creditTo);
        if (extra?.tab) params = params.set('tab', extra.tab);
        if (extra?.tags?.length) params = params.set('tags', extra.tags.join(','));
        if (extra?.tagsMode) params = params.set('tagsMode', extra.tagsMode);
        if (extra?.orderBy) params = params.set('orderBy', extra.orderBy);
        if (extra?.orderDir) params = params.set('orderDir', extra.orderDir);

        const approvedUrl = status === VoiceStatus.Approved ? '/approved' : '';
        return this.http.get<VoicesListResponse>(
            `${this.basePathApi}/${this.path}${approvedUrl}?timestamp=${Date.now()}`,
            { params }
        );
    }

    public getApprovedVoices(limit: number, page: number, extra?: Parameters<typeof this.getVoices>[3]) {
        return this.getVoices(limit, page, VoiceStatus.Approved, extra);
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
