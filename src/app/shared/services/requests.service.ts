import { HttpClient, HttpErrorResponse, HttpParams } from '@angular/common/http';
import { Inject, Injectable } from '@angular/core';
import { Observable, throwError } from 'rxjs';
import { catchError, retry } from 'rxjs/operators';
import { CreateSupportMessageDto, CreateSupportRequestDto, IRequestDetail, ISupportMessage, SupportRequestsResponse, VerifyEmailRequest } from '../types/request-support.types';
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

    /**
     * Handles HTTP errors and returns a user-friendly error message
     */
    private handleError(error: HttpErrorResponse, context: string): Observable<never> {
        let errorMessage = 'An unexpected error occurred';
        
        if (error.status === 0) {
            errorMessage = 'Unable to connect to server. Please check your internet connection.';
        } else if (error.status === 404) {
            errorMessage = `${context} not found`;
        } else if (error.status === 400) {
            errorMessage = error.error?.message || 'Invalid request data';
        } else if (error.status === 429) {
            errorMessage = 'Too many requests. Please try again later.';
        } else if (error.status >= 500) {
            errorMessage = 'Server error. Please try again later.';
        }
        
        console.error(`[RequestsService] ${context} error:`, error);
        return throwError(() => new Error(errorMessage));
    }

    getBrowseRequests(filters?: { category?: string; comfortZone?: string; page?: number; limit?: number }): Observable<SupportRequestsResponse> {
        let params = new HttpParams();
        if (filters?.category) params = params.set('category', filters.category);
        if (filters?.comfortZone) params = params.set('comfortZone', filters.comfortZone);
        if (filters?.page) params = params.set('page', String(filters.page));
        if (filters?.limit) params = params.set('limit', String(filters.limit));

        return this.http.get<SupportRequestsResponse>(`${this.basePathApi}/${this.path}`, { params }).pipe(
            retry({ count: 2, delay: 1000 }),
            catchError((error) => this.handleError(error, 'Fetching support requests'))
        );
    }

    getRequestById(id: string): Observable<IRequestDetail> {
        return this.http.get<IRequestDetail>(`${this.basePathApi}/${this.path}/${id}`).pipe(
            catchError((error) => this.handleError(error, 'Support request'))
        );
    }

    createRequest(request: CreateSupportRequestDto): Observable<{ requestId: string }> {
        return this.http.post<{ requestId: string }>(`${this.basePathApi}/${this.path}`, request).pipe(
            catchError((error) => this.handleError(error, 'Creating support request'))
        );
    }

    sendVerificationCode(email: string, requestId?: string): Observable<{ success: boolean; code?: string }> {
        return this.http.post<{ success: boolean; code?: string }>(
            `${this.basePathApi}/${this.path}/verify/send`,
            { email, requestId },
        ).pipe(
            catchError((error) => this.handleError(error, 'Sending verification code'))
        );
    }

    verifyEmail(data: VerifyEmailRequest): Observable<{ success: boolean }> {
        return this.http.post<{ success: boolean }>(`${this.basePathApi}/${this.path}/verify/check`, data).pipe(
            catchError((error) => this.handleError(error, 'Email verification'))
        );
    }

    createSupportMessage(requestId: string, payload: CreateSupportMessageDto): Observable<ISupportMessage> {
        return this.http.post<ISupportMessage>(`${this.basePathApi}/${this.path}/${requestId}/messages`, payload).pipe(
            catchError((error) => this.handleError(error, 'Sending support message'))
        );
    }

    uploadSupportImage(file: File): Observable<{ imageUrl: any }> {
        const formData = new FormData();
        formData.append('image', file);
        return this.http.post<{ imageUrl: any }>(`${this.basePathApi}/images/upload`, formData).pipe(
            catchError((error) => this.handleError(error, 'Uploading image'))
        );
    }
}
