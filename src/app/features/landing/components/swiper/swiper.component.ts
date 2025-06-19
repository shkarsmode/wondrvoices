import { AfterViewInit, Component, CUSTOM_ELEMENTS_SCHEMA, effect, ElementRef, input, InputSignal, Signal, viewChild } from '@angular/core';
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
export class SwiperComponent implements AfterViewInit{
    private readonly swiperContainer: Signal<ElementRef<SwiperContainer>> = 
        viewChild.required<ElementRef<SwiperContainer>>('swiperContainer');

    public readonly slides: InputSignal<readonly Slide[]> = 
        input.required<ReadonlyArray<Slide>>();

    constructor() {
        if (typeof window === 'undefined') return;
        
        effect(() => {
            if (this.slides().length !== 0) {
                const swiperElement = this.swiperContainer().nativeElement;

                if (window.screen.width < 900) {
                    swiperOptions.slidesPerView = 2;
                } else if (window.screen.width <= 500) {
                    swiperOptions.slidesPerView = 1;
                }

                Object.assign(swiperElement, swiperOptions);
                swiperElement.initialize();
            }
        });
    }

    public ngAfterViewInit() {
        const shadowRoot = this.swiperContainer().nativeElement.shadowRoot;
        if (shadowRoot) {
            const style = document.createElement('style');
            style.textContent = `
                .swiper-wrapper {
                    transition-timing-function: linear !important;
                }
            `;
            shadowRoot.appendChild(style);
        }
    }
}

const swiperOptions: SwiperOptions = {
    initialSlide: 1,
    loop: true,
    roundLengths: true,
    slidesPerView: 3,
    zoom: true,
    spaceBetween: 30,
    grabCursor: true,

    autoplay: {
        delay: 0,
        pauseOnMouseEnter: false,
        stopOnLastSlide: false
    },
    speed: 7000,
    allowTouchMove: true,

    // freeMode: true,   
};
