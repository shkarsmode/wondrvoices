import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, OnInit, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { RequestsService } from '../../../../shared/services/requests.service';
import { IRequestDetail, ISupportMessage } from '../../../../shared/types/request-support.types';

type AccordionState = {
    message: boolean;
    social: boolean;
    upload: boolean;
    mail: boolean;
};

@Component({
    selector: 'app-request-page',
    standalone: true,
    imports: [CommonModule, RouterLink],
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

    constructor(private route: ActivatedRoute, private requestsService: RequestsService) {}

    ngOnInit(): void {
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
            'encouragement': '👍',
            'prayers': '🙏',
            'hope': '✨',
            'poems': '✍️',
            'nature': '🌿',
            'mindfulness': '🧘',
            'art': '🎨',
            'humor': '😊',
            'other': '💭'
        };
        return icons[zone] || '💭';
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
}
