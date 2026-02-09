import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Inject, Injectable } from '@angular/core';
import { Observable, throwError } from 'rxjs';
import { catchError, retry } from 'rxjs/operators';
import { AllPostsResponseDto } from '../types/AllPostsResponse.dto';
import { IPost } from '../types/IPost';
import { BASE_PATH_API } from './variables';

@Injectable({
    providedIn: 'root'
})
export class PostsService {
    private readonly postsPath: string = 'posts';

    constructor(
        private http: HttpClient,
        @Inject(BASE_PATH_API) private basePathApi: string
    ) { }

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
        } else if (error.status >= 500) {
            errorMessage = 'Server error. Please try again later.';
        }
        
        console.error(`[PostsService] ${context} error:`, error);
        return throwError(() => new Error(errorMessage));
    }

    public getPosts(
        limit: number, 
        page: number = 0, 
        postponed: boolean = false
    ): Observable<AllPostsResponseDto> {
        return this.http.get<AllPostsResponseDto>(
            `${this.basePathApi}/${this.postsPath}/all?limit=${limit}&page=${page}&postponed=${postponed}&isWondrvoices=true` 
        ).pipe(
            retry({ count: 1, delay: 1000 }),
            catchError((error) => this.handleError(error, 'Fetching posts'))
        );
    }

    public getCountOfPostsByUserId(userId: number): Observable<number> {
        return this.http.get<number>(
            `${this.basePathApi}/${this.postsPath}/count?id=${userId}` 
        ).pipe(
            catchError((error) => this.handleError(error, 'Fetching post count'))
        );
    }

    public getPostById(id: number): Observable<IPost> {
        return this.http.get<IPost>(
            `${this.basePathApi}/${this.postsPath}/${id}` 
        ).pipe(
            catchError((error) => this.handleError(error, 'Post'))
        );
    }

    public uploadPost(post: IPost): Observable<IPost> {
        return this.http.post<IPost>(
            `${this.basePathApi}/${this.postsPath}`, post
        ).pipe(
            catchError((error) => this.handleError(error, 'Uploading post'))
        );
    }

    public updatePostById(post: IPost): Observable<{ affected: number }> {
        return this.http.post<{ affected: number }>(
            `${this.basePathApi}/${this.postsPath}/update`, 
            post
        ).pipe(
            catchError((error) => this.handleError(error, 'Updating post'))
        );
    }
    
    public deletePostById(id: number): Observable<{ affected: number }> {
        return this.http.delete<{ affected: number }>(
            `${this.basePathApi}/${this.postsPath}/delete/${id}`
        ).pipe(
            catchError((error) => this.handleError(error, 'Deleting post'))
        );
    }
}
