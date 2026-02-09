import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Inject, Injectable } from '@angular/core';
import { Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { ImageUrlResponseDto } from '../types/imageUrlResponse.dto';
import { BASE_PATH_API } from './variables';

@Injectable({
    providedIn: 'root'
})
export class CloudinaryService {

    private readonly imgPath: string = 'images';

    constructor(
        private http: HttpClient,
        @Inject(BASE_PATH_API) private basePathApi: string
    ) { }

    /**
     * Handles HTTP errors for image uploads
     */
    private handleError(error: HttpErrorResponse): Observable<never> {
        let errorMessage = 'Failed to upload image';
        
        if (error.status === 0) {
            errorMessage = 'Unable to connect to server. Please check your internet connection.';
        } else if (error.status === 413) {
            errorMessage = 'Image file is too large. Please choose a smaller file.';
        } else if (error.status === 415) {
            errorMessage = 'Unsupported image format. Please use JPG, PNG or GIF.';
        } else if (error.status >= 500) {
            errorMessage = 'Server error while uploading. Please try again later.';
        }
        
        console.error('[CloudinaryService] Upload error:', error);
        return throwError(() => new Error(errorMessage));
    }

    public uploadImageAndGetUrl(image: any): Observable<ImageUrlResponseDto> {
        const formData = new FormData();
        formData.append('image', image);

        return this.http.post<ImageUrlResponseDto>(
            `${this.basePathApi}/${this.imgPath}/upload`, 
            formData
        ).pipe(
            catchError((error) => this.handleError(error))
        );
    } 
}
