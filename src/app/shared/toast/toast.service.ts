import { Injectable, signal } from '@angular/core';
import { ToastInternal, ToastOptions } from './toast.model';

@Injectable({ providedIn: 'root' })
export class ToastService {
    private readonly _toasts = signal<ToastInternal[]>([]);
    readonly toasts = this._toasts.asReadonly();

    private readonly defaults: Required<Omit<ToastOptions, 'id'>> = {
        type: 'default',
        title: '',
        message: '',
        duration: 4000,
        dismissible: true,
        ariaLive: 'polite',
    };

    show(opts: ToastOptions) {
        const id = opts.id ?? crypto.randomUUID().slice(0, 10);
        const t: ToastInternal = {
            id,
            ...this.defaults,
            ...opts,
            createdAt: Date.now(),
            remaining: opts.duration ?? this.defaults.duration,
            hovering: false,
        };
        this._toasts.update(list => [t, ...list]);
        this.armTimer(id, /*resume*/ false);
        return id;
    }

    success(title: string, message?: string, duration = 3500) {
        return this.show({ type: 'success', title, message, duration });
    }
    info(title: string, message?: string, duration = 4000) {
        return this.show({ type: 'info', title, message, duration });
    }
    warn(title: string, message?: string, duration = 4500) {
        return this.show({ type: 'warn', title, message, duration });
    }
    error(title: string, message?: string, duration = 5000) {
        return this.show({ type: 'error', title, message, duration, ariaLive: 'assertive' });
    }

    dismiss(id: string) {
        this._toasts.update(list => list.filter(t => t.id !== id));
    }
    clearAll() {
        this._toasts.set([]);
    }

    setHover(id: string, hovering: boolean) {
        this._toasts.update(list => list.map(t => t.id === id ? { ...t, hovering } : t));
        const t = this._toasts().find(x => x.id === id);
        if (!t) return;

        if (hovering) {
            // при входе курсора считаем остаток точно к этому моменту
            const elapsed = Date.now() - t.createdAt;
            const remaining = Math.max(0, t.duration - elapsed);
            this._toasts.update(list => list.map(x => x.id === id ? { ...x, remaining } : x));
        } else {
            // при выходе — продолжаем обратный отсчёт плавно
            this.armTimer(id, /*resume*/ true);
        }
    }

    private armTimer(id: string, resume: boolean) {
        const t0 = this._toasts().find(x => x.id === id);
        if (!t0) return;

        const start = Date.now();
        const total = resume ? t0.remaining : t0.duration;

        const tick = () => {
            const current = this._toasts().find(x => x.id === id);
            if (!current) return;                // уже удалили

            if (current.hovering) return;        // пауза — выходим, перезапустим при unhover

            const elapsed = Date.now() - start;
            const remaining = Math.max(0, total - elapsed);

            // обновляем только если есть видимая разница (экономим лишние перерисовки)
            if (Math.abs(remaining - current.remaining) > 1) {
                this._toasts.update(list => list.map(x => x.id === id ? { ...x, remaining } : x));
            }

            if (remaining <= 0) {
                this.dismiss(id);
            } else {
                requestAnimationFrame(tick);
            }
        };

        requestAnimationFrame(tick);
    }
}
