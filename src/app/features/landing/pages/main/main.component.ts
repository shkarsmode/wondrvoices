import { Component, inject, OnInit } from '@angular/core';
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

    public slides = [
        { imageUrl: 'assets/voices/6.jpg' },
        { imageUrl: 'assets/voices/11.jpg' }, 
        { imageUrl: 'assets/voices/4.jpg' }, 
        { imageUrl: 'assets/voices/9.jpg' }, 
        { imageUrl: 'assets/voices/15.jpg' },
        { imageUrl: 'assets/voices/19.jpg' },
    ];

    public ngOnInit(): void {
        this.title.setTitle('Wondrvoices');
    }
}
