// shared/services/location-iq.service.ts
import { HttpClient, HttpErrorResponse, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { environment } from '../../../environments/environment';

export interface LocationIqSuggestion {
    place_id: string;
    display_name: string;
    display_place: string;
    display_address: string;
    lat: string;
    lon: string;
    class: string;
    type: string;
    address?: LocationIqSuggestionAddress;
}

export type LocationIqSuggestionAddress = {
    name: string;
    house_number?: string;
    road?: string;
    neighbourhood?: string;
    suburb?: string;
    city?: string;
    county?: string;
    state?: string;
    postcode?: string;
    country?: string;
    country_code?: string;
};

@Injectable({ providedIn: 'root' })
export class LocationIqService {
    private http = inject(HttpClient);
    private base = 'https://api.locationiq.com/v1/autocomplete';

    /**
     * Handles location search errors gracefully - returns empty array instead of breaking
     */
    private handleError(error: HttpErrorResponse): Observable<LocationIqSuggestion[]> {
        if (error.status === 429) {
            console.warn('[LocationIqService] Rate limit exceeded, returning empty results');
        } else if (error.status === 0) {
            console.warn('[LocationIqService] Network error, returning empty results');
        } else {
            console.error('[LocationIqService] Search error:', error);
        }
        // Return empty array to not break the UI
        return of([]);
    }

    searchCities(q: string, limit = 6): Observable<LocationIqSuggestion[]> {
        if (!q || q.trim().length < 2) {
            return of([]);
        }

        const params = new HttpParams()
            .set('key', environment.locationIqToken)
            .set('q', q)
            .set('limit', limit)
            .set('format', 'json')
            .set('dedupe', '1');
            // .set('normalizeaddress', '1')
            // Фильтр на поселения: city/town/village (class=place)
            // .set('tag', 'place:city,place:town,place:village');

        return this.http.get<LocationIqSuggestion[]>(this.base, { params }).pipe(
            catchError((error) => this.handleError(error))
        );
    }
}
