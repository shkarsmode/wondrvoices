import { Injectable } from '@angular/core';
import { delay, Observable, of } from 'rxjs';
import { CreateSupportRequestDto, IRequestDetail, ISupportMessage, ISupportRequest, SupportRequestsResponse, VerifyEmailRequest } from '../types/request-support.types';

@Injectable({
    providedIn: 'root'
})
export class RequestsService {
    private mockRequests: ISupportRequest[] = [
        {
            id: 'WV-2626-4582',
            firstName: 'Sarah',
            age: 42,
            location: 'Seattle, WA',
            city: 'Seattle',
            state: 'WA',
            diagnosis: 'Cancer Treatment',
            journeyStage: 'Active Treatment',
            hospital: 'Seattle Children\'s Hospital',
            isAnonymous: false,
            email: 'sarah@example.com',
            comfortZones: ['nature', 'poems'],
            additionalNote: 'I love sunsets and peaceful words. Going through chemo and could use some light.',
            createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
            hearts: 12,
            shares: 3,
            comments: 2,
            tags: ['nature', 'poems'],
            lat: 47.6062,
            lng: -122.3321
        },
        {
            id: 'WV-1234-5678',
            age: 58,
            location: 'Boston, MA',
            city: 'Boston',
            state: 'MA',
            diagnosis: 'Lymphoma Treatment',
            journeyStage: 'Post-Treatment Recovery',
            hospital: 'Dana-Farber Cancer Institute',
            isAnonymous: true,
            email: 'anonymous@example.com',
            comfortZones: ['prayers', 'poems'],
            additionalNote: 'Going through lymphoma treatment. Prayers and spiritual messages help me feel connected.',
            createdAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
            hearts: 24,
            shares: 7,
            comments: 1,
            tags: ['prayers', 'poems'],
            lat: 42.3601,
            lng: -71.0589
        },
        {
            id: 'WV-9876-1234',
            firstName: 'Emma',
            age: 24,
            gender: 'female',
            location: 'Austin, TX',
            city: 'Austin',
            state: 'TX',
            diagnosis: 'Leukemia Treatment',
            journeyStage: 'Active Treatment',
            hospital: 'MD Anderson Cancer Center',
            isAnonymous: false,
            email: 'emma@example.com',
            comfortZones: ['humor', 'art'],
            additionalNote: 'Fighting leukemia at 24. Anything colorful and funny helps brighten my day.',
            createdAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
            hearts: 12,
            shares: 3,
            comments: 2,
            tags: ['humor', 'art'],
            lat: 30.2672,
            lng: -97.7431
        },
        {
            id: 'WV-5555-7890',
            firstName: 'Ethan',
            age: 7,
            gender: 'male',
            location: 'Denver, CO',
            city: 'Denver',
            state: 'CO',
            diagnosis: 'Pediatric Brain Tumor',
            journeyStage: 'Active Treatment',
            hospital: 'Children\'s Hospital Colorado',
            isAnonymous: false,
            email: 'ethan@example.com',
            comfortZones: ['humor', 'art', 'encouragement'],
            additionalNote: 'My son Ethan loves dinosaurs and superheroes. He\'s being so brave and silly jokes or fun drawings!',
            createdAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
            hearts: 45,
            shares: 12,
            comments: 8,
            tags: ['humor', 'art', 'encouragement'],
            lat: 39.7392,
            lng: -104.9903
        },
        {
            id: 'WV-3333-4444',
            firstName: 'Lisa',
            age: 38,
            gender: 'female',
            location: 'Portland, OR',
            city: 'Portland',
            state: 'OR',
            diagnosis: 'Rare Autoimmune Disease',
            journeyStage: 'Long-term Care',
            hospital: 'Oregon Health & Science University',
            isAnonymous: false,
            email: 'lisa@example.com',
            comfortZones: ['prayers', 'nature', 'poems'],
            additionalNote: 'Living with a rare autoimmune condition. Calming messages and nature help me find peace.',
            createdAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
            hearts: 24,
            shares: 6,
            comments: 3,
            tags: ['prayers', 'nature', 'poems'],
            lat: 45.5152,
            lng: -122.6784
        }
    ];

    private mockMessages: Record<string, ISupportMessage[]> = {
        'WV-2626-4582': [
            {
                id: 'm1',
                fromName: 'Jennifer',
                type: 'image',
                mediaUrl: 'https://images.unsplash.com/photo-1501004318641-b39e6451bec6?auto=format&fit=crop&w=1200&q=80',
                thumbnailUrl: 'https://images.unsplash.com/photo-1501004318641-b39e6451bec6?auto=format&fit=crop&w=600&q=80',
                message: 'Stay strong, Sarah. Thinking of you.',
                createdAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
                likes: 8,
                location: 'Austin, TX'
            },
            {
                id: 'm2',
                fromName: 'Anonymous',
                anonymous: true,
                type: 'image',
                mediaUrl: 'https://images.unsplash.com/photo-1469474968028-56623f02e42e?auto=format&fit=crop&w=1200&q=80',
                thumbnailUrl: 'https://images.unsplash.com/photo-1469474968028-56623f02e42e?auto=format&fit=crop&w=600&q=80',
                message: 'Sending you healing vibes',
                createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
                likes: 5,
                location: 'Toronto, ON'
            },
            {
                id: 'm3',
                fromName: 'Michael R.',
                type: 'video',
                mediaUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
                thumbnailUrl: 'https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=600&q=80',
                message: 'A sunset meditation for you',
                createdAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
                likes: 12,
                location: 'New York, NY'
            }
        ]
    };

    getBrowseRequests(filters?: any): Observable<SupportRequestsResponse> {
        let filteredRequests = [...this.mockRequests];

        if (filters?.category && filters.category !== 'all') {
            filteredRequests = filteredRequests.filter(req => 
                req.comfortZones.includes(filters.category)
            );
        }

        return of({
            items: filteredRequests,
            total: filteredRequests.length,
            page: 1,
            limit: 20
        }).pipe(delay(300));
    }

    getRequestById(id: string): Observable<IRequestDetail | undefined> {
        const request = this.mockRequests.find(r => r.id === id);

        if (!request) {
            return of(undefined).pipe(delay(200));
        }

        const messages = this.mockMessages[id] || [];

        const detail: IRequestDetail = {
            ...request,
            messages,
            supportCount: messages.length,
            mapMarkers: [
                { lat: request.lat || 0, lng: request.lng || 0, label: 'Request Location', from: this.getDisplayName(request) },
                { lat: 40.7128, lng: -74.0060, label: 'Support from Michael', from: 'New York, NY' },
                { lat: 30.2672, lng: -97.7431, label: 'Support from Jennifer', from: 'Austin, TX' },
                { lat: 43.6532, lng: -79.3832, label: 'Support from Anonymous', from: 'Toronto, ON' }
            ]
        };

        return of(detail).pipe(delay(300));
    }

    createRequest(request: CreateSupportRequestDto): Observable<{ requestId: string }> {
        const requestId = `WV-${Math.floor(1000 + Math.random() * 9000)}-${Math.floor(1000 + Math.random() * 9000)}`;
        
        // Simulate API call
        return of({ requestId }).pipe(delay(500));
    }

    sendVerificationCode(email: string): Observable<{ success: boolean; code?: string }> {
        // In demo mode, return a mock code
        const mockCode = Math.floor(100000 + Math.random() * 900000).toString();
        console.log('Demo Mode: Verification code:', mockCode);
        
        return of({ 
            success: true, 
            code: mockCode // Only for demo, real API wouldn't return this
        }).pipe(delay(500));
    }

    verifyEmail(data: VerifyEmailRequest): Observable<{ success: boolean }> {
        // Simulate verification
        return of({ success: true }).pipe(delay(300));
    }

    private getDisplayName(request: ISupportRequest): string {
        return request.isAnonymous ? 'Anonymous' : request.firstName || 'Anonymous';
    }
}
