import { animate, group, query, style, transition, trigger } from '@angular/animations';
import { CommonModule } from '@angular/common';
import { Component, computed, inject, input } from '@angular/core';
import { ToastInternal } from './toast.model';
import { ToastService } from './toast.service';

@Component({
    selector: 'app-toast-container',
    imports: [CommonModule],
    templateUrl: './toast-container.component.html',
    styleUrls: ['./toast-container.component.scss'],
    animations: [
        trigger('toastAnim', [
            // появление: лёгкий слайд и фейд
            transition(':enter', [
                style({ opacity: 0, transform: 'translateY(6px)' }),
                animate('220ms cubic-bezier(.2,.8,.2,1)', style({ opacity: 1, transform: 'translateY(0)' })),
            ]),
            // закрытие: фейд + коллапс высоты/маргинов/паддингов
            transition(':leave', [
                group([
                    animate('140ms ease', style({ opacity: 0, transform: 'translateY(-4px)' })),
                    query(':self', [
                        style({ height: '*', marginTop: '*', marginBottom: '*', paddingTop: '*', paddingBottom: '*' }),
                        animate('200ms ease', style({ height: 0, marginTop: 0, marginBottom: 0, paddingTop: 0, paddingBottom: 0 }))
                    ])
                ])
            ])
        ])
    ],
    host: {
        class: 'toast-container',
        '[class.pos-top-right]': 'position() === "top-right"',
        '[class.pos-top-left]': 'position() === "top-left"',
        '[class.pos-bottom-right]': 'position() === "bottom-right"',
        '[class.pos-bottom-left]': 'position() === "bottom-left"',
        'aria-live': 'polite',
        'aria-atomic': 'false',
    }
})
export class ToastContainerComponent {
    position = input<'top-right' | 'top-left' | 'bottom-right' | 'bottom-left'>('top-right');
    private readonly svc = inject(ToastService);

    readonly toasts = computed<ToastInternal[]>(() => this.svc.toasts());
    trackById = (_: number, t: ToastInternal) => t.id;

    onEnter(t: ToastInternal) { this.svc.setHover(t.id, true); }
    onLeave(t: ToastInternal) { this.svc.setHover(t.id, false); }
    dismiss(t: ToastInternal) { this.svc.dismiss(t.id); }

    iconPath(t: ToastInternal): string {
        switch (t.type) {
            case 'success': return 'M10 18l-6-6 1.4-1.4L10 15.2l8.6-8.6L20 8l-10 10z';
            case 'info': return 'M11 17h2v-6h-2v6zm0-8h2V7h-2v2z';
            case 'warn': return 'M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z';
            case 'error': return 'M6 6l12 12M6 18L18 6';
            default: return 'M12 4a8 8 0 110 16 8 8 0 010-16z';
        }
    }

    ariaRole(t: ToastInternal) {
        return t.ariaLive === 'assertive' ? 'alert' : 'status';
    }

    // прогресс = оставшееся/всё; скейлим ::before по X
    progressStyle(t: ToastInternal) {
        const p = Math.max(0, Math.min(1, 1 - (t.remaining / t.duration))); // 0..1 пройдено
        return { '--p': String(p) } as any;
    }
}
