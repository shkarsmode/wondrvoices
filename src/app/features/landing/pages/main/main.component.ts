import { Component, ElementRef, inject, OnInit, ViewChild } from '@angular/core';
import { Title } from '@angular/platform-browser';
import { RouterLink } from '@angular/router';
import { SwiperComponent } from '../../components/swiper/swiper.component';

@Component({
    selector: 'app-main',
    standalone: true,
    imports: [SwiperComponent, RouterLink],
    templateUrl: './main.component.html',
    styleUrl: './main.component.scss'
})
export class MainComponent implements OnInit {
    private title = inject(Title);
    @ViewChild('heroImages1') heroImages1!: ElementRef<HTMLDivElement>;
    @ViewChild('heroImages2') heroImages2!: ElementRef<HTMLDivElement>;
    public mouseEnterBlock1: boolean = false;
    public mouseEnterBlock2: boolean = false;

    public speed = 0.5;
    private offset1 = 0;
    private offset2 = 0;

    public slides = [
        { imageUrl: 'assets/voices/6.jpg' },
        { imageUrl: 'assets/voices/11.jpg' }, 
        { imageUrl: 'assets/voices/4.jpg' }, 
        { imageUrl: 'assets/voices/9.jpg' }, 
        { imageUrl: 'assets/voices/15.jpg' },
        { imageUrl: 'assets/voices/19.jpg' },
    ];

    public images1 = [
        'assets/img/test/3.png',
        'assets/img/test/2.png',
        'assets/img/test/1.png',
        'assets/img/test/4.png',
        'assets/img/test/5.png',
        'assets/img/test/6.png'
    ];

    public images2 = [
        'assets/img/test/4.png',
        'assets/img/test/5.png',
        'assets/img/test/6.png',
        'assets/img/test/1.png',
        'assets/img/test/2.png',
        'assets/img/test/3.png'
    ];

    public ngOnInit(): void {
        this.images1 = [...this.images1, ...this.images1];
        this.images2 = [...this.images2, ...this.images2];
        this.title.setTitle('Wondrvoices');
    }

    public ngAfterViewInit(): void {
        if (typeof window === 'undefined') return;
        // if (window.innerWidth < 1430) return;
        setTimeout(() => {
            this.startAnimation();
        }, 100);
    }

    private startAnimation(): void {
        const block1 = this.heroImages1.nativeElement;
        const block2 = this.heroImages2.nativeElement;

        const step = () => {
            
            if (!this.mouseEnterBlock1) {
                this.offset1 -= this.speed;
            }

            if (!this.mouseEnterBlock2) {
                this.offset2 -= this.speed;
            }

            this.moveAndLoop(block1, true);
            this.moveAndLoop(block2, false);

            requestAnimationFrame(step);
        };

        requestAnimationFrame(step);
    }

    private moveAndLoop(block: HTMLElement, isUp: boolean): void {
        if (isUp) {
            block.style.transform = `translateY(${this.offset1}px)`;
            const blockHeight = block.scrollHeight / 2;
            if (Math.abs(this.offset1) >= blockHeight + 8) {
                this.offset1 = 0;
            }
        } else {
            block.style.transform = `translateY(${-block.scrollHeight / 2 - this.offset2}px)`;
            if (Math.abs(this.offset2) >= block.scrollHeight / 2 + 8) {
                this.offset2 = 0;
            }
        }
    }
}
