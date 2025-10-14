// shared/services/location-iq.service.ts
import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
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

    searchCities(q: string, limit = 6): Observable<LocationIqSuggestion[]> {
        const params = new HttpParams()
            .set('key', environment.locationIqToken)
            .set('q', q)
            .set('limit', limit)
            .set('format', 'json')
            .set('dedupe', '1')
            // .set('normalizeaddress', '1')
            // Фильтр на поселения: city/town/village (class=place)
            // .set('tag', 'place:city,place:town,place:village');

        return this.http.get<LocationIqSuggestion[]>(this.base, { params });
    }
}
