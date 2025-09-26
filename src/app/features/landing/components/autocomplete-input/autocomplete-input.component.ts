// autocomplete-input.component.ts
import { NgFor, NgIf } from '@angular/common';
import {
    ChangeDetectionStrategy,
    Component,
    ElementRef,
    EventEmitter,
    HostBinding,
    Input,
    Output,
    ViewChild,
    effect,
    forwardRef,
    signal,
} from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';
import { Subscription, combineLatest } from 'rxjs';
import { VoicesService } from 'src/app/shared/services/voices.service';
import { VoiceStatus } from 'src/app/shared/types/voices';

@Component({
    selector: 'w-autocomplete',
    standalone: true,
    imports: [NgIf, NgFor],
    changeDetection: ChangeDetectionStrategy.OnPush,
    providers: [
        {
            provide: NG_VALUE_ACCESSOR,
            useExisting: forwardRef(() => AutocompleteInputComponent),
            multi: true,
        },
    ],
    template: `
<div
    class="auto"
    [class.is-all]="isAllInfo"
    [class.loading]="loading()"
    (keydown)="onKeydown($event)">

    @if (isAllInfo) {
        <img src="assets/svg/search.svg" class="search" />
    }

    <input
        #inp
        [type]="loading() ? 'text' : (placeholder.length ? 'search' : 'text')"
        [attr.placeholder]="placeholder"
        [attr.autocomplete]="autocomplete"
        [attr.name]="name"
        [maxLength]="maxLength"
        [disabled]="disabled"
        [value]="value()"
        (input)="onInput(($any($event.target).value))"
        (focus)="onFocus()"
        (blur)="onBlur()"
        [style.padding-left]="isAllInfo ? '30px' : '0.75rem'"
        [attr.aria-expanded]="open()"
        [attr.aria-autocomplete]="'list'"
        [attr.aria-haspopup]="'listbox'" />

    @if (loading()) {
        <div
            class="input-indicator"
            aria-hidden="true">
            <span class="spinner"></span>
        </div>
    }

    @if (
        open() &&
        (
            loading() ||
            suggestionsSpecific().length > 0 ||
            suggestionsAll().location.length > 0 ||
            suggestionsAll().creditTo.length > 0 ||
            suggestionsAll().tabs.length > 0
        )
    ) {
        @if (loading()) {
            <ul
                class="menu"
                role="listbox"
                aria-busy="true">

                @if (isAllInfo) {
                    <div class="section-label">
                        <span class="section-emoji" aria-hidden="true">📍</span>
                        <span class="section-title">Location</span>
                        <span class="count-badge pulse">…</span>
                    </div>
                    @for (s of [0,1,2]; track s) {
                        <li class="skeleton-line"></li>
                    }

                    <div class="section-label">
                        <span class="section-emoji" aria-hidden="true">👤</span>
                        <span class="section-title">CreditTo</span>
                        <span class="count-badge pulse">…</span>
                    </div>
                    @for (s of [0,1,2]; track s) {
                        <li class="skeleton-line"></li>
                    }

                    <div class="section-label">
                        <span class="section-emoji" aria-hidden="true">🏷️</span>
                        <span class="section-title">Tags</span>
                        <span class="count-badge pulse">…</span>
                    </div>
                    @for (s of [0,1,2]; track s) {
                        <li class="skeleton-line"></li>
                    }
                } @else {
                    @for (s of [0,1,2,3,4,5]; track s) {
                        <li class="skeleton-line"></li>
                    }
                }
            </ul>
        } @else {
            @if (isAllInfo) {
                <ul
                    class="menu"
                    role="listbox">

                    @if (suggestionsAll().location.length !== 0) {
                        <div class="section-label">
                            <span class="section-emoji" aria-hidden="true">📍</span>
                            <span class="section-title">Location</span>
                            <span class="count-badge">{{ suggestionsAll().location.length }}</span>
                        </div>
                        @for (s of suggestionsAll().location; track s; let i = $index) {
                            <li
                                role="option"
                                (mousedown)="pick(s, 'location')"
                                [attr.data-index]="i"
                                [innerHTML]="highlightPrefix(s, value())">
                            </li>
                        }
                    }

                    <!-- @if (suggestionsAll().location.length === 0) {
                        <div class="empty-row">– Not found</div>
                    } -->

                    @if (suggestionsAll().creditTo.length !== 0) {
                        <div class="section-label">
                            <span class="section-emoji" aria-hidden="true">👤</span>
                            <span class="section-title">CreditTo</span>
                            <span class="count-badge">{{ suggestionsAll().creditTo.length }}</span>
                        </div>
                        @for (s of suggestionsAll().creditTo; track s; let i = $index) {
                            <li
                                role="option"
                                (mousedown)="pick(s, 'creditTo')"
                                [attr.data-index]="i"
                                [innerHTML]="highlightPrefix(s, value())">
                            </li>
                        }
                    }

                    <!-- @if (suggestionsAll().creditTo.length === 0) {
                        <div class="empty-row">– Not found</div>
                    } -->

                    @if (suggestionsAll().tabs.length !== 0) {
                        <div class="section-label">
                            <span class="section-emoji" aria-hidden="true">🏷️</span>
                            <span class="section-title">Tags</span>
                            <span class="count-badge">{{ suggestionsAll().tabs.length }}</span>
                        </div>
                        @for (s of suggestionsAll().tabs; track s; let i = $index) {
                            <li
                                role="option"
                                (mousedown)="pick(s, 'tab')"
                                [attr.data-index]="i" [innerHTML]="highlightPrefix(s, value())">
                            </li>
                        }
                    }
                    <!-- @if (suggestionsAll().tabs.length === 0) {
                        <div class="empty-row">– Not found</div>
                    } -->
                </ul>
            } @else {
                @if (suggestionsSpecific().length) {
                    <ul
                        class="menu"
                        role="listbox">
                        @for (s of suggestionsSpecific(); track s; let i = $index) {
                            <li
                                role="option"
                                (mousedown)="pick(s, this.field)"
                                [attr.data-index]="i" 
                                [innerHTML]="highlightPrefix(s, value())">
                            </li>
                        }
                    </ul>
                }
            }
        }
    }

    @if (open() && !loading() && (!suggestionsSpecific().length)) {
        <div class="empty">
            @if (!value().length) { {{ emptyHint }} } @else { Not found }
        </div>
    }
</div>
    `,
    styles: [`
:host { display: flex; width: 100%; }
.auto { position: relative; width: 100%; max-width: 100%; }

/* Input */
input {
    width: 100%;
    padding: 0.5rem 0.5rem 0.5rem 0.75rem;
    border: 1px solid #d0d7de;
    border-radius: 10px;
    background: #ffffff;
    transition: box-shadow 0.2s ease, border-color 0.2s ease, background-color 0.2s ease;
}
input:focus {
    outline: none;
    border-color: #4dabf7;
    box-shadow: 0 6px 24px rgba(77, 171, 247, 0.18), 0 0 0 3px rgba(77, 171, 247, 0.14);
}
input:disabled { background: #f1f3f5; cursor: not-allowed; }

.search {
    position: absolute;
    left: 8px;
    top: 6px;
    color: #472a2f;
    font-size: 21px;
    height: 20px;
}

/* Placeholder opacity based on isAllInfo */
input::placeholder { opacity: 0.72; }
.is-all input::placeholder { opacity: 0.45; }

.loading input { padding: 0.5rem 2.25rem 0.5rem 0.75rem; }

/* Inline loader inside input */
.input-indicator {
    position: absolute;
    right: 0.5rem;
    top: 0;
    bottom: 0;
    display: flex;
    align-items: center;
    pointer-events: none;
}
.spinner {
    width: 16px;
    height: 16px;
    border-radius: 50%;
    border: 2px solid rgba(13, 110, 253, 0.2);
    border-top-color: rgba(13, 110, 253, 0.9);
    animation: spin 0.7s linear infinite;
}
@keyframes spin { to { transform: rotate(360deg); } }

/* Listbox (menu) */
.menu {
    position: absolute;
    left: 0;
    right: 0;
    top: calc(100% + 0.25rem);
    z-index: 20;
    background: #ffffff;
    border: 1px solid #e9ecef;
    border-radius: 12px;
    padding: 0.25rem 0;
    max-height: 320px;
    overflow: auto;
    box-shadow: 0 24px 48px rgba(0, 0, 0, 0.08), 0 8px 20px rgba(0, 0, 0, 0.06);
}

/* Section headers */
.section-label {
    top: 0;
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.5rem 0.75rem;
    background: linear-gradient(#ffffff, #ffffff);
    border-top: 1px solid #f1f3f5;
    border-bottom: 1px solid #f1f3f5;
    font-weight: 600;
    color: #495057;
}
.section-label:first-child { border-top: 0; }
.section-emoji { width: 1.25rem; text-align: center; }
.section-title { letter-spacing: 0.2px; }
.count-badge {
    margin-left: auto;
    padding: 0 0.5rem;
    height: 1.25rem;
    line-height: 1.25rem;
    border-radius: 999px;
    font-size: 0.75rem;
    color: #0b7285;
    background: #e3fafc;
    border: 1px solid #c5f6fa;
}
.pulse { animation: badgePulse 1.2s ease-in-out infinite; }
@keyframes badgePulse {
    0%, 100% { opacity: 0.35; }
    50% { opacity: 0.9; }
}

/* Options */
.menu li {
    padding: 0.55rem 0.75rem;
    cursor: pointer;
    font-size: 14px;
    color: #212529;
    display: flex;
    align-items: center;
    white-space: pre;
    // gap: 0.5rem;
    transition: background-color 0.12s ease, transform 0.04s ease;
}
.menu li:hover { background: #f8f9fa; }
.menu li:active { transform: translateY(0.5px); }
.menu li::before {
    content: "•";
    opacity: 0.32;
    transform: translateY(-1px);
    font-size: 12px;
    margin-right: 5px;
}

/* Skeleton rows */
.skeleton-line {
    position: relative;
    overflow: hidden;
    height: 34px;
    margin: 2px 0;
    border-radius: 8px;
    background: linear-gradient(90deg, #f1f3f5 25%, #f8f9fa 37%, #f1f3f5 63%);
    background-size: 400% 100%;
    animation: shimmer 1.2s ease-in-out infinite;
}
.skeleton-line::after {
    content: "";
    position: absolute;
    left: 0.75rem;
    right: 30%;
    top: 50%;
    transform: translateY(-50%);
    height: 10px;
    border-radius: 4px;
    background: rgba(0, 0, 0, 0.06);
}
@keyframes shimmer {
    0% { background-position: 100% 0; }
    100% { background-position: 0 0; }
}

/* Empty rows inside the menu */
.empty-row {
    padding: 0.55rem 0.75rem;
    color: #868e96;
    font-style: italic;
    font-size: 14px;
}

/* Outside empty hint panel */
.empty {
    position: absolute;
    left: 0;
    right: 0;
    top: calc(100% + 0.25rem);
    padding: 0.6rem 0.75rem;
    background: #ffffff;
    border: 1px dashed #e9ecef;
    border-radius: 12px;
    color: #868e96;
    font-size: 0.9rem;
    z-index: 1;
}

/* Subtle custom scrollbar (WebKit) */
.menu::-webkit-scrollbar { width: 10px; }
.menu::-webkit-scrollbar-track { background: transparent; }
.menu::-webkit-scrollbar-thumb {
    background: #e9ecef;
    border-radius: 999px;
    border: 2px solid #ffffff;
}
.menu::-webkit-scrollbar-thumb:hover { background: #dee2e6; }
    `],
})
export class AutocompleteInputComponent implements ControlValueAccessor {
    @Input() field: 'creditTo' | 'location' | 'tab' = 'creditTo';
    @Input() placeholder = 'Type to search…';
    @Input() emptyHint = 'No suggestions';
    @Input() limit = 10;
    @Input() status: VoiceStatus | 'all' = VoiceStatus.Approved;
    @Input() maxLength: number | null = 300;
    @Input() autocomplete: 'on' | 'off' | any = 'on';
    @Input() name: string | null = null;
    @Input() isAllInfo = false;

    @Input() set initial(initialValue: string | undefined) {
        if (initialValue !== undefined) this.setValue(initialValue, false);
    }

    @Output() select = new EventEmitter<{ key: 'location' | 'creditTo' | 'tab'; value: string }>();
    @Output() inputChange = new EventEmitter<string>();

    public isFocused = false;
    loading = signal<boolean>(false);

    @ViewChild('inp', { static: true }) inputRef!: ElementRef<HTMLInputElement>;

    value = signal<string>('');
    open = signal<boolean>(false);
    suggestionsSpecific = signal<string[]>([]);
    suggestionsAll = signal<{ location: string[]; creditTo: string[]; tabs: string[] }>({
        location: [],
        creditTo: [],
        tabs: [],
    });
    disabled = false;

    private cache = new Map<string, string[] | { location: string[]; creditTo: string[]; tabs: string[] }>();

    // CVA callbacks
    private onChange: (v: string) => void = () => {};
    private onTouched: () => void = () => {};

    @HostBinding('class.disabled') get isDisabled(): boolean { return this.disabled; }

    constructor(private api: VoicesService) {
        // React to input with debounce and proper cleanup.
        effect(onCleanup => {
            const query = this.value().trim();
            let subscription: Subscription | null = null;

            const timerId = setTimeout(() => {
                const cacheKey = `${this.isAllInfo ? 'all' : this.field}|${this.status}|${this.limit}|${query}`;

                if (!query || query.length < 1) {
                    this.loading.set(false);
                    if (this.isAllInfo) {
                        this.suggestionsAll.set({ location: [], creditTo: [], tabs: [] });
                    } else {
                        this.suggestionsSpecific.set([]);
                    }
                    return;
                }

                if (this.cache.has(cacheKey)) {
                    this.loading.set(false);
                    const cached = this.cache.get(cacheKey)!;
                    if (this.isAllInfo) {
                        this.suggestionsAll.set(cached as any);
                    } else {
                        this.suggestionsSpecific.set(cached as string[]);
                    }
                    return;
                }

                this.loading.set(true);

                if (this.isAllInfo) {
                    const fields: ('creditTo' | 'location' | 'what' | 'express')[] = [
                        'creditTo',
                        'location',
                        'what',
                        'express',
                    ];

                    subscription = combineLatest(
                        fields.map(f =>
                            this.api.getSuggestions(f, query, { limit: 3, status: this.status }),
                        ),
                    ).subscribe({
                        next: ([creditTo, location, what, express]) => {
                            const value = {
                                creditTo,
                                location,
                                tabs: [...what, ...express].slice(0, 3),
                            };
                            this.cache.set(cacheKey, value);
                            this.suggestionsAll.set(value);
                            this.loading.set(false);
                        },
                        error: () => {
                            this.suggestionsAll.set({ location: [], creditTo: [], tabs: [] });
                            this.loading.set(false);
                        },
                    });
                } else {
                    const apiField = this.field === 'tab' ? 'what' : this.field;
                    subscription = this.api
                        .getSuggestions(apiField, query, { limit: this.limit, status: this.status })
                        .subscribe({
                            next: list => {
                                this.cache.set(cacheKey, list);
                                this.suggestionsSpecific.set(list);
                                this.loading.set(false);
                            },
                            error: () => {
                                this.suggestionsSpecific.set([]);
                                this.loading.set(false);
                            },
                        });
                }
            }, 250);

            // Cleanup: cancel previous debounce and unsubscribe previous request.
            onCleanup(() => {
                clearTimeout(timerId);
                if (subscription) subscription.unsubscribe();
            });
        });
    }

    // ---- ControlValueAccessor ----
    writeValue(v: string | null): void {
        this.setValue(v ?? '', false);
    }
    registerOnChange(fn: (v: string) => void): void {
        this.onChange = fn;
    }
    registerOnTouched(fn: () => void): void {
        this.onTouched = fn;
    }
    setDisabledState(isDisabled: boolean): void {
        this.disabled = isDisabled;
    }

    // ---- UI handlers ----

    public highlightPrefix(text: string, query: string): string {
        const q = (query ?? '').trim();
        if (!q) return this.escapeHtml(text ?? '');
    
        const rx = this.getWordStartRegex(q);
    
        let out = '';
        let last = 0;
    
        // Use original text for correct \b behavior, escape while building HTML
        text.replace(rx, (match: string, group: string, offset: number) => {
            // normal chunk before match
            out += this.escapeHtml(text.slice(last, offset));
            // matched prefix in bold
            out += `<b>${this.escapeHtml(group)}</b>`;
            last = offset + group.length;
            return match;
        });
    
        // tail
        out += this.escapeHtml(text.slice(last));
    
        return out;
    }

    onInput(nextValue: string): void {
        this.setValue(nextValue, true);
        this.open.set(true);
        this.inputChange.emit(nextValue);
    }
    onFocus(): void {
        this.open.set(true);
        this.isFocused = true;
    }
    onBlur(): void {
        // Allow option mousedown to fire before closing.
        this.isFocused = false;
        setTimeout(() => {
            this.open.set(false);
            this.onTouched();
        }, 120);
    }
    pick(optionText: string, type: 'location' | 'creditTo' | 'tab'): void {
        this.setValue(this.isAllInfo ? '' : optionText, true);
        this.select.emit({ key: type, value: (optionText ?? '').trim() });
        this.open.set(false);
        this.inputRef?.nativeElement.focus();
    }
    onKeydown(evt: KeyboardEvent): void {
        if (evt.key === 'Escape') {
            this.open.set(false);
            evt.stopPropagation();
            return;
        }
        if (evt.key === 'Enter') {
            const first =
                this.isAllInfo
                    ? (this.suggestionsAll().location[0] ||
                       this.suggestionsAll().creditTo[0] ||
                       this.suggestionsAll().tabs[0])
                    : this.suggestionsSpecific()[0];

            if (first) {
                evt.preventDefault();
                const inferredField =
                    this.isAllInfo
                        ? (this.suggestionsAll().location[0]
                            ? 'location'
                            : this.suggestionsAll().creditTo[0]
                                ? 'creditTo'
                                : 'tab')
                        : this.field;
                this.pick(first, inferredField);
            }
        }
    }

    private setValue(v: string, propagate: boolean): void {
        if (this.value() === v) return;
        this.value.set(v);
        if (propagate) this.onChange(v);
    }

    private prefixRegexCache = new Map<string, RegExp>();

    // Escape HTML to prevent XSS
    private escapeHtml(raw: string): string {
        return raw
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    // Escape regex special symbols
    private escapeRegex(raw: string): string {
        return raw.replace(/[\\.^$|?*+()[\]{}]/g, '\\$&');
    }

    // Build or reuse case-insensitive word-start regex: \b(query)
    private getWordStartRegex(query: string): RegExp {
        const key = query.toLowerCase();
        const cached = this.prefixRegexCache.get(key);
        if (cached) return cached;

        const rx = new RegExp(`\\b(${this.escapeRegex(query)})`, 'gi');
        this.prefixRegexCache.set(key, rx);
        return rx;
    }
}
