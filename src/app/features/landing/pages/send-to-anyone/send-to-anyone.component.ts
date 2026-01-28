import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
    selector: 'app-send-to-anyone',
    standalone: true,
    imports: [CommonModule, RouterLink],
    templateUrl: './send-to-anyone.component.html',
    styleUrl: './send-to-anyone.component.scss',
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class SendToAnyoneComponent {
    messageFormOpen = signal(true);
    
    matchedMessages = [
        {
            id: 1,
            image: 'assets/img/matched/flowers.jpg',
            quote: '"Stay strong! You\'re braver than you believe."',
            from: 'Jennifer M.',
            matchedWith: 'Sarah',
            supporting: 'Cancer Treatment',
            location: 'Portland, OR',
            matchedAgo: '2 days ago'
        },
        {
            id: 2,
            image: 'assets/img/matched/watercolor.jpg',
            quote: '"Sending you healing vibes and peaceful thoughts."',
            from: 'Anonymous',
            matchedWith: 'Anonymous',
            supporting: 'Loss & Grief',
            location: 'Boston, MA',
            matchedAgo: '1 week ago'
        },
        {
            id: 3,
            image: 'assets/img/matched/sunset.jpg',
            quote: '"Your smile lights up the world. Keep shining!"',
            from: 'Michael R.',
            matchedWith: 'Emma',
            supporting: 'Mental Health',
            location: 'Austin, TX',
            matchedAgo: '3 days ago'
        }
    ];

    toggleMessageForm(): void {
        this.messageFormOpen.update(v => !v);
    }

    copyAddress(): void {
        const address = 'WondrVoices\nPO Box 40056\nSt. Pete, FL 33743';
        navigator.clipboard.writeText(address);
    }
}
