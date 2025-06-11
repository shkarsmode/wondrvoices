import { Component, CUSTOM_ELEMENTS_SCHEMA, effect, ElementRef, input, InputSignal, Signal, viewChild } from '@angular/core';
import { SwiperContainer } from 'swiper/element';
import { SwiperOptions } from 'swiper/types';

interface Slide {
    id?: number;
    title?: string;
    description?: string;
    imageUrl?: string;
    linkUrl?: string;
    order?: number;
    active?: boolean;
    customClass?: string;
    content?: {
        html?: string;
        text?: string;
    };
    metadata?: {
        [key: string]: any;
    };
}

@Component({
    selector: 'app-swiper',
    standalone: true,
    imports: [],
    templateUrl: './swiper.component.html',
    styleUrl: './swiper.component.scss',
    schemas: [CUSTOM_ELEMENTS_SCHEMA]
})
export class SwiperComponent {
    private readonly swiperContainer: Signal<ElementRef<SwiperContainer>> = 
        viewChild.required<ElementRef<SwiperContainer>>('swiperContainer');

    public readonly slides: InputSignal<readonly Slide[]> = 
        input.required<ReadonlyArray<Slide>>();

    constructor() {
        effect(() => {
            if (this.slides().length !== 0) {
                const swiperElement = this.swiperContainer().nativeElement;

                Object.assign(swiperElement, swiperOptions);
                swiperElement.initialize();
            }
        });
    }
}

const swiperOptions: SwiperOptions = {
    initialSlide: 1,
    loop: true,
    roundLengths: true,
    slidesPerView: 2,
    zoom: true,
    autoplay: {
        delay: 3000,
        pauseOnMouseEnter: true
    },
    speed: 600
};
