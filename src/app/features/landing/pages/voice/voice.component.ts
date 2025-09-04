import { JsonPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, OnInit, signal, WritableSignal } from '@angular/core';
import { Meta, Title } from '@angular/platform-browser';
import { ActivatedRoute } from '@angular/router';
import { VoicesService } from 'src/app/shared/services/voices.service';
import { IVoice } from 'src/app/shared/types/voices';

@Component({
    selector: 'app-voice',
    standalone: true,
    imports: [JsonPipe],
    templateUrl: './voice.component.html',
    styleUrl: './voice.component.scss',
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class VoiceComponent implements OnInit {
    private route = inject(ActivatedRoute);
    private title = inject(Title);
    private meta = inject(Meta);
    private voicesService = inject(VoicesService);
    public card: WritableSignal<IVoice | any> = signal(null);
    public history: typeof history | {} = typeof history !== 'undefined' ? history : {};

    public async ngOnInit(): Promise<void> {
        const id = this.route.snapshot.paramMap.get('id');
        if (!id) return;

        // this.card.set(voices.find(voice => voice.id === +id));
        // if (!this.card()) {
        const card = await this.voicesService.getApprovedVoiceById(+id).toPromise();
        this.card.set(card);
        // }
        this.updateMetaTags();
    }

    private updateMetaTags(): void {
        if (!this.card()) return;

        const url = 'https://www.wondrvoices.com/';
        if (!this.card()?.location) return;
        
        this.title.setTitle(this.card().location);
        // this.meta.updateTag({ name: 'description', content: this.card.description });
        this.meta.updateTag({ property: 'og:title', content: this.card().location });
        // this.meta.updateTag({ property: 'og:description', content: this.card.description });
        this.meta.updateTag({ property: 'og:image', content: url + this.card().img });
        this.meta.updateTag({ property: 'og:image:alt', content: url + this.card().img });
        this.meta.updateTag({ property: 'twitter:title', content: this.card().location });
        // this.meta.updateTag({ property: 'twitter:description', content: this.card.description });
        this.meta.updateTag({ property: 'twitter:image', content: url + this.card().img });
        this.meta.updateTag({ property: 'twitter:image:src', content: url + this.card().img });
        this.meta.updateTag({ name: 'twitter:card', content: 'summary_large_image' });
    }
}
