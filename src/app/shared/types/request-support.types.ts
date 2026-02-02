export interface ISupportRequest {
    id: string;
    firstName?: string;
    age: number;
    gender?: 'male' | 'female' | 'prefer-not-to-say';
    location: string;
    city?: string;
    state?: string;
    diagnosis: string;
    journeyStage: string;
    hospital?: string;
    isAnonymous: boolean;
    email: string;
    comfortZones: string[];
    additionalNote?: string;
    createdAt: Date;
    hearts?: number;
    shares?: number;
    comments?: number;
    tags?: string[];
    lat?: number;
    lng?: number;
}

export interface ISupportMessage {
    id: string;
    fromName: string;
    anonymous?: boolean;
    type: 'text' | 'image' | 'video';
    message?: string;
    mediaUrl?: string;
    thumbnailUrl?: string;
    createdAt: Date;
    likes?: number;
    location?: string;
}

export interface IRequestDetail extends ISupportRequest {
    messages: ISupportMessage[];
    supportCount?: number;
    mapMarkers?: Array<{ lat: number; lng: number; label?: string; from?: string }>;
}

export interface CreateSupportRequestDto {
    firstName?: string;
    age: number;
    gender?: 'male' | 'female' | 'prefer-not-to-say';
    location: string;
    situation?: string; // 'cancer', 'loss', 'end-of-life', 'other-illness'
    whoNeedsSupport?: string; // 'me', 'my-child', 'someone-i-care-for'
    caregiverRelationship?: string; // 'spouse', 'parent', 'sibling', 'friend', 'other-family', 'other'
    journeyStage: string;
    contextTags?: string[];
    hospital?: string;
    isAnonymous?: boolean;
    email: string;
    comfortZones: string[];
    additionalNote?: string;
}

export interface VerifyEmailRequest {
    email: string;
    code: string;
    requestId?: string;
}

export interface SupportRequestsResponse {
    items: ISupportRequest[];
    total: number;
    page: number;
    limit: number;
}

export enum ComfortZoneType {
    Encouragement = 'encouragement',
    Prayers = 'prayers',
    Hope = 'hope',
    Poems = 'poems',
    Nature = 'nature',
    Mindfulness = 'mindfulness',
    Art = 'art',
    Humor = 'humor',
    Other = 'other'
}

export enum FilterCategory {
    All = 'all',
    Cancer = 'cancer',
    YoungAdult = 'young-adult',
    ParentWithKids = 'parent-with-kids',
    PediatricCancer = 'pediatric-cancer',
    CancerReturned = 'cancer-returned',
    EndOfLife = 'end-of-life',
    RareDisease = 'rare-disease',
    Caregiver = 'caregiver',
    Grieving = 'grieving',
    Humor = 'humor',
    Prayers = 'prayers',
    Nature = 'nature',
    Poems = 'poems',
    Art = 'art',
    Encouragement = 'encouragement',
    Hope = 'hope',
    Mindfulness = 'mindfulness'
}
