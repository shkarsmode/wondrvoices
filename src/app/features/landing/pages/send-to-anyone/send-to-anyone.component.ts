import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, OnInit, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { first } from 'rxjs';
import { VoicesService } from '../../../../shared/services/voices.service';
import { IVoice, VoiceSourceType } from '../../../../shared/types/voices';

@Component({
    selector: 'app-send-to-anyone',
    standalone: true,
    imports: [CommonModule, RouterLink],
    templateUrl: './send-to-anyone.component.html',
    styleUrl: './send-to-anyone.component.scss',
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class SendToAnyoneComponent implements OnInit {
    private readonly voicesService = inject(VoicesService);

    readonly wallLoading = signal(false);
    readonly wallCards = signal<IVoice[]>([]);
    readonly addressCopied = signal(false);

    readonly visibleWallCards = computed(() =>
        this.wallCards()
            .filter((card) => !!card.img && !this.isJourneyLinkedCard(card))
            .slice(0, 6)
    );

    ngOnInit(): void {
        this.loadWallCards();
    }

    copyAddress(): void {
        const address = 'WondrVoices\nPO Box 40056\nSt. Pete, FL 33743';

        if (typeof navigator === 'undefined' || !navigator.clipboard?.writeText) {
            return;
        }

        navigator.clipboard.writeText(address).then(() => {
            this.addressCopied.set(true);
            setTimeout(() => this.addressCopied.set(false), 1800);
        }).catch(() => {
            this.addressCopied.set(false);
        });
    }

    getVoiceDisplayName(card: IVoice): string {
        return card.creditTo?.trim() || card.firstName?.trim() || 'Community Member';
    }

    getVoiceLocation(card: IVoice): string {
        return card.location?.trim() || 'From the WondrVoices community';
    }

    private isJourneyLinkedCard(card: IVoice): boolean {
        return card.sourceType === VoiceSourceType.SupportMessage
            || !!card.sourceSupportRequestId
            || !!card.sourceSupportMessageId;
    }

    private loadWallCards(): void {
        this.wallLoading.set(true);

        this.voicesService.getApprovedVoices(30, {
            orderBy: 'createdAt',
            orderDir: 'DESC',
            page: 1
        }).pipe(first()).subscribe({
            next: ({ items }) => {
                this.wallCards.set(items ?? []);
                this.wallLoading.set(false);
            },
            error: () => {
                this.wallCards.set([]);
                this.wallLoading.set(false);
            }
        });
    }
}
