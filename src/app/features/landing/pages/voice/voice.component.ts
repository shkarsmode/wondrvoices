import { ChangeDetectionStrategy, Component, inject, OnInit } from '@angular/core';
import { Meta, Title } from '@angular/platform-browser';
import { ActivatedRoute } from '@angular/router';
import { voices } from '../../../../shared/data/voices';
import { VoiceCard } from '../gallery/gallery.component';

@Component({
    selector: 'app-voice',
    standalone: true,
    imports: [],
    templateUrl: './voice.component.html',
    styleUrl: './voice.component.scss',
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class VoiceComponent implements OnInit {
    private route = inject(ActivatedRoute);
    private title = inject(Title);
    private meta = inject(Meta);
    public card?: VoiceCard;
    public history: typeof history | {} = typeof history !== 'undefined' ? history : {};

    public ngOnInit(): void {
        const id = this.route.snapshot.paramMap.get('id');
        if (!id) return;

        this.card = voices.find(voice => voice.id === +id);
        this.updateMetaTags();
    }

    private updateMetaTags(): void {
        if (!this.card) return;

        const url = 'https://www.wondrvoices.com/';
        this.title.setTitle(this.card.title);
        this.meta.updateTag({ name: 'description', content: this.card.description });
        this.meta.updateTag({ property: 'og:title', content: this.card.title });
        this.meta.updateTag({ property: 'og:description', content: this.card.description });
        this.meta.updateTag({ property: 'og:image', content: url + this.card.image });
        this.meta.updateTag({ property: 'og:image:alt', content: url + this.card.image });
        this.meta.updateTag({ property: 'twitter:title', content: this.card.title });
        this.meta.updateTag({ property: 'twitter:description', content: this.card.description });
        this.meta.updateTag({ property: 'twitter:image', content: url + this.card.image });
        this.meta.updateTag({ property: 'twitter:image:src', content: url + this.card.image });
        this.meta.updateTag({ name: 'twitter:card', content: 'summary_large_image' });

        console.log(this.card.image);
    }
}
