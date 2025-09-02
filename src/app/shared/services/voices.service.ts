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
        status?: VoiceStatus
    ): Observable<VoicesListResponse> {
        let params = new HttpParams()
            .set('limit', String(limit))
            .set('page', String(page));
        if (status) params = params.set('status', status);

        const approvedUrl = status ===  VoiceStatus.Approved ? '/approved' : '';
        return this.http.get<VoicesListResponse>(
            `${this.basePathApi}/${this.path}${approvedUrl}`,
            { params }
        );
    }
    

    /** Convenience: fetch only approved voices (public feed use-case) */
    public getApprovedVoices(limit: number, page: number): Observable<VoicesListResponse> {
        return this.getVoices(limit, page, VoiceStatus.Approved);
    }

    public getApprovedVoiceById(id: number): Observable<IVoice> {
        return this.getVoiceById(id, VoiceStatus.Approved);
    }

    public getVoiceById(id: number, status?: VoiceStatus): Observable<IVoice> {
        const approvedUrl = status ===  VoiceStatus.Approved ? '/approved' : '';
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
