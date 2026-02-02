import { HttpClient, HttpParams } from '@angular/common/http';
import { Inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { CreateSupportRequestDto, IRequestDetail, SupportRequestsResponse, VerifyEmailRequest } from '../types/request-support.types';
import { BASE_PATH_API } from './variables';

@Injectable({
    providedIn: 'root'
})
export class RequestsService {
    private readonly path = 'support-requests';

    constructor(
        private http: HttpClient,
        @Inject(BASE_PATH_API) private basePathApi: string,
    ) {}

    getBrowseRequests(filters?: { category?: string; comfortZone?: string; page?: number; limit?: number }): Observable<SupportRequestsResponse> {
        let params = new HttpParams();
        if (filters?.category) params = params.set('category', filters.category);
        if (filters?.comfortZone) params = params.set('comfortZone', filters.comfortZone);
        if (filters?.page) params = params.set('page', String(filters.page));
        if (filters?.limit) params = params.set('limit', String(filters.limit));

        return this.http.get<SupportRequestsResponse>(`${this.basePathApi}/${this.path}`, { params });
    }

    getRequestById(id: string): Observable<IRequestDetail> {
        return this.http.get<IRequestDetail>(`${this.basePathApi}/${this.path}/${id}`);
    }

    createRequest(request: CreateSupportRequestDto): Observable<{ requestId: string }> {
        return this.http.post<{ requestId: string }>(`${this.basePathApi}/${this.path}`, request);
    }

    sendVerificationCode(email: string, requestId?: string): Observable<{ success: boolean; code?: string }> {
        return this.http.post<{ success: boolean; code?: string }>(
            `${this.basePathApi}/${this.path}/verify/send`,
            { email, requestId },
        );
    }

    verifyEmail(data: VerifyEmailRequest): Observable<{ success: boolean }> {
        return this.http.post<{ success: boolean }>(`${this.basePathApi}/${this.path}/verify/check`, data);
    }
}
