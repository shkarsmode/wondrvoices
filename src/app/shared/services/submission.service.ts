// src/app/services/submission.service.ts
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { BASE_PATH_API } from './variables';

export enum FormType {
    JoinSpot = 'join_spot',
    GetInvolved = 'get_involved',
    Contact = 'contact',
    Custom = 'custom',
}

export interface Submission {
    id?: number;
    formType: FormType;
    data: Record<string, unknown>;
    createdAt?: string;
    updatedAt?: string;
}


@Injectable({
    providedIn: 'root'
})
export class SubmissionService {
    private readonly submissionPath: string = 'submission';
    private http: HttpClient = inject(HttpClient);
    private basePathApi = inject(BASE_PATH_API);
    private apiUrl = `${this.basePathApi}/${this.submissionPath}`;

    /**
     * Handles HTTP errors and returns a user-friendly error message
     */
    private handleError(error: HttpErrorResponse, context: string): Observable<never> {
        let errorMessage = 'An unexpected error occurred';
        
        if (error.status === 0) {
            errorMessage = 'Unable to connect to server. Please check your internet connection.';
        } else if (error.status === 400) {
            errorMessage = error.error?.message || 'Invalid form data';
        } else if (error.status >= 500) {
            errorMessage = 'Server error. Please try again later.';
        }
        
        console.error(`[SubmissionService] ${context} error:`, error);
        return throwError(() => new Error(errorMessage));
    }

    public create(submission: Omit<Submission, 'id' | 'createdAt' | 'updatedAt'>): Observable<Submission> {
        return this.http.post<Submission>(`${this.apiUrl}`, submission).pipe(
            catchError((error) => this.handleError(error, 'Submitting form'))
        );
    }

    public getAll(params?: { page?: number; limit?: number; formType?: FormType; q?: string }): Observable<Submission[]> {
        return this.http.get<Submission[]>(`${this.apiUrl}`, { params: params as any }).pipe(
            catchError((error) => this.handleError(error, 'Fetching submissions'))
        );
    }

    // getById(id: number): Observable<Submission> {
    //     return this.http.get<Submission>(`${this.apiUrl}/${id}`);
    // }

    // delete(id: number): Observable<{ affected: number }> {
    //     return this.http.delete<{ affected: number }>(`${this.apiUrl}/delete/${id}`);
    // }
}
