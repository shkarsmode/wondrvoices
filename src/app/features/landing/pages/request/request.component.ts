import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { LikesService } from '../../../../shared/services/likes.service';
import { RequestsService } from '../../../../shared/services/requests.service';
import { CreateSupportMessageDto, IRequestDetail, ISupportMessage } from '../../../../shared/types/request-support.types';

type AccordionState = {
    message: boolean;
    social: boolean;
    upload: boolean;
    mail: boolean;
};

@Component({
    selector: 'app-request-page',
    standalone: true,
    imports: [CommonModule, RouterLink, FormsModule],
    templateUrl: './request.component.html',
    styleUrl: './request.component.scss',
    changeDetection: ChangeDetectionStrategy.OnPush
})

export class RequestComponent implements OnInit {
    request = signal<IRequestDetail | undefined>(undefined);
    loading = signal(true);
    accordionOpen = signal<AccordionState>({
        message: true,
        social: false,
        upload: false,
        mail: false
    });
    liked = signal<Set<string>>(new Set());
    sendOpen = signal(true);
    mailModalOpen = signal(false);
    successModalOpen = signal(false);

    messageText = '';
    senderEmail = '';
    senderName = '';
    senderLocation = '';
    sendingMessage = signal(false);
    uploadingMedia = signal(false);
    uploadedMediaUrl = signal<string | null>(null);

    constructor(private route: ActivatedRoute, private requestsService: RequestsService, private likesService: LikesService) {}

    ngOnInit(): void {
        this.liked.set(new Set(this.likesService.getAllLikes()));
        const id = this.route.snapshot.paramMap.get('id');
        if (!id) return;
        this.requestsService.getRequestById(id).subscribe(detail => {
            this.request.set(detail);
            this.loading.set(false);
        });
    }

    getDisplayName(): string {
        const req = this.request();
        if (!req) return '';
        return req.isAnonymous ? 'Anonymous' : req.firstName || 'Anonymous';
    }

    getTimeAgo(date: Date | string): string {
        const now = new Date();
        const diffInDays = Math.floor((now.getTime() - new Date(date).getTime()) / (1000 * 60 * 60 * 24));
        if (diffInDays === 0) return 'Today';
        if (diffInDays === 1) return '1 day ago';
        if (diffInDays < 7) return `${diffInDays} days ago`;
        if (diffInDays < 14) return '1 week ago';
        return `${Math.floor(diffInDays / 7)} weeks ago`;
    }

    getComfortZoneIcon(zone: string): string {
        const icons: Record<string, string> = {
            'encouragement': 'thumb_up',
            'prayers': 'volunteer_activism',
            'hope': 'auto_awesome',
            'poems': 'edit_note',
            'nature': 'park',
            'mindfulness': 'self_improvement',
            'art': 'palette',
            'humor': 'sentiment_satisfied',
            'other': 'forum'
        };
        return icons[zone] || 'forum';
    }

    getSupportCount(): number {
        return this.request()?.messages?.length || 0;
    }

    getMediaLabel(message: ISupportMessage): string {
        if (message.type === 'video') return 'VIDEO';
        if (message.type === 'image') return 'IMAGE';
        return 'TEXT';
    }

    toggleAccordion(section: keyof AccordionState): void {
        const current = this.accordionOpen();
        this.accordionOpen.set({ ...current, [section]: !current[section] });
    }

    isLiked(requestId: string): boolean {
        return this.liked().has(requestId);
    }

    getHeartCount(detail: IRequestDetail): number {
        const baseHearts = detail.hearts || 0;
        return this.isLiked(detail.id) ? baseHearts + 1 : baseHearts;
    }

    toggleSendLove(): void {
        const current = this.request();
        if (!current) return;

        this.likesService.toggleLike(current.id);
        this.liked.set(new Set(this.likesService.getAllLikes()));
        this.request.set({ ...current });
    }

    toggleSend(): void {
        this.sendOpen.update(v => !v);
    }

    onFileSelected(event: Event): void {
        const input = event.target as HTMLInputElement;
        const file = input.files?.[0];
        if (!file) return;

        this.uploadingMedia.set(true);
        this.requestsService.uploadSupportImage(file).subscribe({
            next: (response) => {
                const url = response?.imageUrl?.secure_url || response?.imageUrl?.url || response?.imageUrl?.secureUrl;
                this.uploadedMediaUrl.set(url || null);
                this.uploadingMedia.set(false);
            },
            error: () => {
                this.uploadingMedia.set(false);
                alert('Failed to upload file');
            }
        });
    }

    submitSupportMessage(): void {
        const req = this.request();
        if (!req) return;

        const message = this.messageText.trim();
        const mediaUrl = this.uploadedMediaUrl();

        if (!this.senderEmail.trim() || !this.senderLocation.trim()) {
            alert('Please provide your email and location');
            return;
        }

        if (!message && !mediaUrl) {
            alert('Please add a message or upload an image');
            return;
        }

        const payload: CreateSupportMessageDto = {
            message: message || undefined,
            type: mediaUrl ? 'image' : 'text',
            mediaUrl: mediaUrl || undefined,
            thumbnailUrl: mediaUrl || undefined,
            fromName: this.senderName.trim() || undefined,
            email: this.senderEmail.trim(),
            location: this.senderLocation.trim(),
        };

        this.sendingMessage.set(true);
        this.requestsService.createSupportMessage(req.id, payload).subscribe({
            next: () => {
                // Don't add message to list - it needs approval first
                // Just clear the form and show success modal
                this.messageText = '';
                this.senderEmail = '';
                this.senderName = '';
                this.senderLocation = '';
                this.uploadedMediaUrl.set(null);
                this.sendingMessage.set(false);
                this.sendOpen.set(false);
                this.successModalOpen.set(true);
            },
            error: () => {
                this.sendingMessage.set(false);
                alert('Failed to send message');
            }
        });
    }

    openMailModal(): void {
        this.mailModalOpen.set(true);
    }

    closeMailModal(): void {
        this.mailModalOpen.set(false);
    }

    closeSuccessModal(): void {
        this.successModalOpen.set(false);
    }

    shareRequest(): void {
        const req = this.request();
        if (!req) return;
        
        const url = window.location.href;
        const text = `Support ${this.getDisplayName()}'s journey on WondrVoices`;
        
        if (navigator.share) {
            navigator.share({ title: text, url }).catch(() => {});
        } else if (navigator?.clipboard?.writeText) {
            navigator.clipboard.writeText(url).then(() => alert('Link copied to clipboard!')).catch(() => {});
        }
    }

    browseMoreRequests(): void {
        this.successModalOpen.set(false);
        window.location.href = '/browse-requests';
    }

    copyMailAddress(): void {
        const req = this.request();
        const text = `WondrVoices\nID: ${req?.id || ''}\nPO Box 40056\nSt. Pete, FL 33743`;
        if (navigator?.clipboard?.writeText) {
            navigator.clipboard.writeText(text).then(() => alert('Address copied')).catch(() => this.fallbackCopy(text));
        } else {
            this.fallbackCopy(text);
        }
    }

    private fallbackCopy(text: string): void {
        const textarea = document.createElement('textarea');
        textarea.value = text;
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
        alert('Address copied');
    }

    getInitials(message: ISupportMessage): string {
        const name = message.anonymous ? 'Anonymous' : message.fromName || 'User';
        const parts = name.trim().split(/\s+/);
        if (parts.length === 1) {
            return parts[0].slice(0, 2).toUpperCase();
        }
        return `${(parts[0][0] || '').toUpperCase()}${(parts[1][0] || '').toUpperCase()}`;
    }

    getMessageTypeLabel(message: ISupportMessage): string {
        if (message.type === 'image') return 'Artwork';
        if (message.type === 'video') return 'Video';
        return 'Message';
    }

    getPrimaryTag(detail?: IRequestDetail): string | undefined {
        return detail?.tags?.[0] || detail?.comfortZones?.[0];
    }

    formatTag(tag?: string): string {
        if (!tag) return '';
        return tag
            .replace(/[-_]/g, ' ')
            .split(' ')
            .filter(Boolean)
            .map(part => part.charAt(0).toUpperCase() + part.slice(1))
            .join(' ');
    }
}
