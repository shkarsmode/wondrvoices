export type ToastType = 'success' | 'info' | 'warn' | 'error' | 'default';

export interface ToastOptions {
    id?: string;
    type?: ToastType;
    title?: string;
    message?: string;
    duration?: number;
    dismissible?: boolean;
    ariaLive?: 'polite' | 'assertive' | 'off';
}

export interface ToastInternal extends Required<Omit<ToastOptions, 'id'>> {
    id: string;
    createdAt: number;
    remaining: number;
    hovering: boolean;
}
