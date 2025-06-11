import { Component, OnInit } from '@angular/core';
import { SwiperComponent } from '../components/swiper/swiper.component';

@Component({
    selector: 'app-landing-page',
    standalone: true,
    imports: [SwiperComponent],
    templateUrl: './landing-page.component.html',
    styleUrl: './landing-page.component.scss'
})
export class LandingPageComponent implements OnInit {
    public slides = [{ imageUrl: 'https://thumbs.dreamstime.com/b/aerial-phooto-festetics-castle-keszthely-hungary-189535465.jpg' }, { imageUrl: 'https://w0.peakpx.com/wallpaper/240/495/HD-wallpaper-glade-creek-mill-forest-rocks-fall-phooto-autumn-mill-colors-beautiful-trees-foliage.jpg' }, { imageUrl: 'https://images.crunchbase.com/image/upload/c_pad,f_auto,q_auto:eco,dpr_1/jmezjfbuxu3vufvmuxku' }];

    public ngOnInit(): void {
        document.addEventListener('click', function (e) {
            const target = e.target as HTMLElement;

            if (target.classList.contains('button') && !(target as any).disabled) {
                const ripple = document.createElement('span');
                ripple.className = 'ripple';

                const rect = target.getBoundingClientRect();
                const size = Math.max(rect.width, rect.height);
                const x = e.clientX - rect.left - size / 2;
                const y = e.clientY - rect.top - size / 2;

                ripple.style.width = ripple.style.height = `${size}px`;
                ripple.style.left = `${x}px`;
                ripple.style.top = `${y}px`;

                target.appendChild(ripple);

                setTimeout(() => ripple.remove(), 600);
            }
        });
    }
}
