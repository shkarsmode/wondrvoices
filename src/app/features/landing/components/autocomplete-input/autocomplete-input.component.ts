// autocomplete-input.component.ts
import {
    ChangeDetectionStrategy,
    Component,
    effect,
    ElementRef,
    EventEmitter,
    forwardRef,
    HostBinding,
    inject,
    Input,
    OnInit,
    Output,
    signal,
    ViewChild,
} from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';
import { first, Subscription } from 'rxjs';
import { VoicesService } from 'src/app/shared/services/voices.service';
import { WINDOW } from 'src/app/shared/tokens/window.token';
import { VoiceStatus } from 'src/app/shared/types/voices';

@Component({
    selector: 'w-autocomplete',
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
        [type]="'text'"
        [attr.placeholder]="' '"
        [attr.autocomplete]="autocomplete"
        [attr.name]="name"
        [maxLength]="maxLength"
        [disabled]="disabled"
        [value]="value()"
        (input)="onInput(($any($event.target).value))"
        (focus)="onFocus()"
        (blur)="onBlur()"
        [style.padding-left]="isAllInfo ? '34px' : '0.75rem'"
        [attr.aria-expanded]="open()"
        [attr.aria-autocomplete]="'list'"
        [attr.aria-haspopup]="'listbox'"
        #inputRef />
    <label [class.focused]="inputRef?.value" [class.moved]="isAllInfo">{{ placeholder }}</label>

    @if (inputRef.value) {
        <span 
            class="close"
            (click)="
                onInput(''); 
            ">
            <span class="material-symbols-outlined md">close</span>
        </span>
    }

    @if (loading()) {
        <div class="input-indicator" aria-hidden="true">
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
            suggestionsAll().tag.length > 0
        )
    ) {
        @if (loading()) {
            <ul class="menu" role="listbox" aria-busy="true">
                @if (isAllInfo) {
                    <!-- <div class="section-label">
                        <span class="material-symbols-outlined md" aria-hidden="true">location_on</span>
                        <span class="section-title">Places</span>
                        <span class="count-badge pulse">…</span>
                    </div> -->
                    @for (s of [0,1,2]; track s) { <li class="skeleton-line"></li> }

                    <!-- <div class="section-label">
                        <span class="material-symbols-outlined md" aria-hidden="true">favorite</span>
                        <span class="section-title">People & Orgs</span>
                        <span class="count-badge pulse">…</span>
                    </div> -->
                    @for (s of [0,1,2]; track s) { <li class="skeleton-line"></li> }

                    <!-- <div class="section-label">
                        <span class="material-symbols-outlined md" aria-hidden="true">label</span>
                        <span class="section-title">Tags</span>
                        <span class="count-badge pulse">…</span>
                    </div> -->
                    @for (s of [0,1,2]; track s) { <li class="skeleton-line"></li> }
                } @else {
                    @for (s of [0,1,2,3,4,5]; track s) { <li class="skeleton-line"></li> }
                }
            </ul>
        } @else {
            @if (isAllInfo) {
                <ul class="menu" role="listbox">
                    @if (suggestionsAll().location.length) {
                        <!-- <div class="section-label">
                            <span class="material-symbols-outlined md" aria-hidden="true">location_on</span>
                            <span class="section-title">Places</span>
                            <span class="count-badge">{{ suggestionsAll().location.length }}</span>
                        </div> -->
                        @for (s of suggestionsAll().location; track s; let i = $index) {
                            <li
                                role="option"
                                (mousedown)="pick(s, 'location')"
                                [attr.data-index]="i">
                                <span class="material-symbols-outlined sm opt-ico" aria-hidden="true">location_on</span>
                                <span [innerHTML]="highlightPrefix(s, value())"></span>
                            </li>
                        }
                    }

                    @if (suggestionsAll().creditTo.length) {
                        <!-- <div class="section-label">
                            <span class="material-symbols-outlined md" aria-hidden="true">favorite</span>
                            <span class="section-title">People & Orgs</span>
                            <span class="count-badge">{{ suggestionsAll().creditTo.length }}</span>
                        </div> -->
                        @for (s of suggestionsAll().creditTo; track s; let i = $index) {
                            <li
                                role="option"
                                (mousedown)="pick(s, 'creditTo')"
                                [attr.data-index]="i">
                                <span class="material-symbols-outlined sm opt-ico" aria-hidden="true">favorite</span>
                                <span [innerHTML]="highlightPrefix(s, value())"></span>
                            </li>
                        }
                    }

                    @if (suggestionsAll().tag.length) {
                        <!-- <div class="section-label">
                            <span class="material-symbols-outlined md" aria-hidden="true">label</span>
                            <span class="section-title">tag</span>
                            <span class="count-badge">{{ suggestionsAll().tabs.length }}</span>
                        </div> -->
                        @for (s of suggestionsAll().tag; track s; let i = $index) {
                            <li
                                role="option"
                                (mousedown)="pick(s, 'tab')"
                                [attr.data-index]="i">
                                <span class="material-symbols-outlined sm opt-ico" aria-hidden="true">label</span>
                                <span [innerHTML]="highlightPrefix(s, value())"></span>
                            </li>
                        }
                    }
                </ul>
            } @else {
                @if (suggestionsSpecific().length) {
                    <ul class="menu" role="listbox">
                        <!-- <div class="section-label">
                            <span class="material-symbols-outlined md" aria-hidden="true">
                                {{ field === 'location' ? 'location_on' : (field === 'creditTo' ? 'favorite' : 'label') }}
                            </span>
                            <span class="section-title">
                                {{ field === 'location' ? 'Places' : (field === 'creditTo' ? 'People & Orgs' : 'Tags') }}
                            </span>
                            <span class="count-badge">{{ suggestionsSpecific().length }}</span>
                        </div> -->

                        @for (s of suggestionsSpecific(); track s; let i = $index) {
                            <li
                                role="option"
                                (mousedown)="pick(s, field)"
                                [attr.data-index]="i">
                                <span class="material-symbols-outlined sm opt-ico" aria-hidden="true">
                                    {{ field === 'location' ? 'location_on' : (field === 'creditTo' ? 'favorite' : 'label') }}
                                </span>
                                <span [innerHTML]="highlightPrefix(s, value())"></span>
                            </li>
                        }
                    </ul>
                }
            }
        }
    }

    <!-- @if (open() && !loading() && !isAllInfo && !suggestionsSpecific().length) {
        <div class="empty">
            @if (!value().length) { {{ emptyHint }} } @else { Not found }
        </div>
    } -->
</div>

<div class="preload" aria-hidden="true" style="position: absolute; width: 0; height: 0; overflow: hidden;">
    <span class="material-symbols-outlined sm opt-ico" aria-hidden="true">label</span>
    <span class="material-symbols-outlined sm opt-ico" aria-hidden="true">favorite</span>
    <span class="material-symbols-outlined sm opt-ico" aria-hidden="true">location_on</span>
</div>
    `,
    styles: [`
:host { display: flex; width: 100%; }
.auto { position: relative; width: 100%; max-width: 100%; }

.close {
    position: absolute;
    right: 14px;
    top: 14px;
    cursor: pointer;
    
    span {
        font-size: 24px !important;
    }

    &:hover {
        scale: 1.1;
    }
}


label {
    position: absolute;
    top: 50%;
    left: 1rem;
    transform: translateY(-50%);
    color: #888;
    transition: all 0.2s ease;
    pointer-events: none;
    width: max-content;

    &.moved {
        left: 2.5rem !important;
    }

    @media screen and (max-width: 500px) {
        font-size: 14px;
    }
}

::ng-deep .short-autocomplete {
    label {
        opacity: 0;
        transition: all .4s;
        width: max-content;
    }
}

input:focus+label,
input:active+label,
.focused {
    top: 11px;
    left: 0.9rem;
    font-size: 0.75rem;
    color: #ffbfae;

    &.moved {
        top: 8px;
        font-size: 0.65rem
    }
}

/* ===== Material Symbols (Outlined) base ===== */
.material-symbols-outlined {
    font-family: 'Material Symbols Outlined';
    font-weight: normal;
    font-style: normal;
    font-size: 18px;
    line-height: 1;
    display: inline-block;
    text-transform: none;
    letter-spacing: normal;
    word-wrap: normal;
    white-space: nowrap;
    direction: ltr;
    -webkit-font-feature-settings: 'liga';
    -webkit-font-smoothing: antialiased;
    font-variation-settings: 'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 24;
    vertical-align: middle;
    user-select: none;
}
.material-symbols-outlined.sm { font-size: 16px; }
.material-symbols-outlined.md { font-size: 18px; }
.material-symbols-outlined.lg { font-size: 20px; }

/* Input */
input {
    width: 100%;
    padding: 0.5rem 0.5rem 0.5rem 0.75rem;
    border: 1px solid #d0d7de;
    border-radius: 10px;
    background: #ffffff;
    transition: box-shadow 0.2s ease, border-color 0.2s ease, background-color 0.2s ease, width .3s;
}
input:focus {
    outline: none;
    border-color: #4dabf7;
}
input:disabled { background: #f1f3f5; cursor: not-allowed; }

/* Search icon inside input */
.search {
    position: absolute;
    left: 8px;
    top: 6px;
    height: 20px;
    width: 20px;
    opacity: 0.9;
    color: #3b3b3b;
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
    display: grid;
    grid-template-columns: 22px auto auto;
    align-items: center;
    column-gap: 0.5rem;
    padding: 0.5rem 0.75rem;
    background: linear-gradient(#ffffff, #ffffff);
    border-top: 1px solid #f1f3f5;
    border-bottom: 1px solid #f1f3f5;
    font-weight: 600;
    color: #495057;
}
.section-label:first-child { border-top: 0; }
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
@keyframes badgePulse { 0%, 100% { opacity: 0.35; } 50% { opacity: 0.9; } }

/* Options */
.menu li {
    padding: 0.55rem 0.75rem;
    cursor: pointer;
    font-size: 14px;
    color: #212529;
    display: grid;
    grid-template-columns: 22px 1fr;
    align-items: center;
    column-gap: 0.5rem;
    white-space: pre;
    transition: background-color 0.12s ease, transform 0.04s ease;
    text-align: left;
}
/* remove default bullet */
.menu li::before { content: none; }

.menu li:hover { background: #f8f9fa; }
.menu li:active { transform: translateY(0.5px); }
.opt-ico { opacity: 0.85; }

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
@keyframes shimmer { 0% { background-position: 100% 0; } 100% { background-position: 0 0; } }

/* Empty rows outside the menu */
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
    `]
})
export class AutocompleteInputComponent implements ControlValueAccessor, OnInit {
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
    @Output() inputBlur = new EventEmitter<void>();

    public isFocused = false;
    loading = signal<boolean>(false);

    @ViewChild('inp', { static: true }) inputRef!: ElementRef<HTMLInputElement>;

    value = signal<string>('');
    open = signal<boolean>(false);
    suggestionsSpecific = signal<string[]>([]);
    suggestionsAll = signal<{ location: string[]; creditTo: string[]; tag: string[] }>({
        location: [],
        creditTo: [],
        tag: [],
    });
    disabled = false;

    private cache = new Map<string, string[] | { location: string[]; creditTo: string[]; tag: string[] }>();

    // CVA callbacks
    private onChange: (v: string) => void = () => { };
    private onTouched: () => void = () => { };

    @HostBinding('class.disabled') get isDisabled(): boolean { return this.disabled; }

    private readonly isWin = inject(WINDOW);

    constructor(private api: VoicesService) {
        // React to input with debounce and cleanup.
        effect(onCleanup => {
            const query = this.value().trim();
            let subscription: Subscription | null = null;

            const timerId = setTimeout(() => {
                const cacheKey = `${this.isAllInfo ? 'all' : this.field}|${this.limit}|${query}`;

                if (!query || query.length < 1) {
                    this.loading.set(false);
                    if (this.isAllInfo) {
                        this.suggestionsAll.set({ location: [], creditTo: [], tag: [] });
                    } else {
                        this.suggestionsSpecific.set([]);
                    }
                    return;
                }

                // if (this.cache.has(cacheKey)) {
                //     this.loading.set(false);
                //     const cached = this.cache.get(cacheKey)!;
                //     if (this.isAllInfo) {
                //         this.suggestionsAll.set(cached as any);
                //     } else {
                //         // this.suggestionsSpecific.set([]);
                //     }
                //     return;
                // }

                this.loading.set(true);

                if (this.isAllInfo) {
                    subscription = this.api.getSuggestAllFiltered(query).subscribe({
                        next: (value) => {
                            this.cache.set(cacheKey, value);
                            this.suggestionsAll.set(value);
                            this.loading.set(false);
                        },
                        error: () => {
                            this.suggestionsAll.set({ location: [], creditTo: [], tag: [] });
                            this.loading.set(false);
                        },
                    });
                } else {
                    subscription = this.api
                        .getSuggestAllFiltered(query)
                        .subscribe({
                            next: list => {
                                this.cache.set(cacheKey, list);
                                // const value = list[this.field];
                                this.suggestionsSpecific.set(list[this.field as 'creditTo']);
                                this.loading.set(false);
                            },
                            error: () => {
                                this.suggestionsSpecific.set([]);
                                this.loading.set(false);
                            },
                        });
                }
            }, 0);

            // Cleanup previous debounce and unsubscribe previous request.
            onCleanup(() => {
                clearTimeout(timerId);
                if (subscription) subscription.unsubscribe();
            });
        });
    }

    public ngOnInit(): void {
        if (!this.isWin) return;
        this.api.getSuggestAllIndex()
            .pipe(first())
            .subscribe();
    }

    // ---- ControlValueAccessor ----
    writeValue(v: string | null): void {
        this.setValue(v ?? '', false);
    }
    registerOnChange(fn: (v: string) => void): void { this.onChange = fn; }
    registerOnTouched(fn: () => void): void { this.onTouched = fn; }
    setDisabledState(isDisabled: boolean): void { this.disabled = isDisabled; }

    // ---- UI handlers ----

    // Treat space, underscore, dash, slash, dot, brackets, punctuation, quotes (incl. Unicode) as separators
    private isSeparator(ch: string): boolean {
        return /[\s/_\-\.\(\)\[\],:;!?\|\\]|[’'“”"‘]|[–—]/.test(ch);
    }

    /** Highlight only word-start matches; preserves original spacing and order. */
    public highlightPrefix(text: string, query: string): string {
        const raw = String(text ?? '');
        const q = (query ?? '').trim();
        if (!q) return this.escapeHtml(raw);

        const lower = raw.toLowerCase();
        const ql = q.toLowerCase();
        let out = '';
        let scanFrom = 0; // where to continue searching
        let last = 0;     // end index of the last emitted plain chunk

        while (scanFrom <= lower.length) {
            const idx = lower.indexOf(ql, scanFrom);
            if (idx === -1) break;

            const isWordStart = idx === 0 || this.isSeparator(lower[idx - 1]);
            if (!isWordStart) {
                scanFrom = idx + 1;
                continue;
            }

            // Emit plain chunk before the match
            out += this.escapeHtml(raw.slice(last, idx));
            // Emit highlighted match
            out += `<b>${this.escapeHtml(raw.substr(idx, ql.length))}</b>`;

            // Advance pointers after this match
            last = idx + ql.length;
            scanFrom = last;
        }

        // Emit tail
        out += this.escapeHtml(raw.slice(last));
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
        this.inputBlur.emit();
        setTimeout(() => {
            this.open.set(false);
            this.onTouched();
        }, 120);
    }
    pick(optionText: string, type: 'location' | 'creditTo' | 'tab'): void {
        optionText = this.isAllInfo ? optionText : this.capitalizeEachWord(optionText);
        this.setValue(this.isAllInfo ? '' : optionText, true);
        this.select.emit({ key: type, value: (optionText ?? '').trim() });
        this.open.set(false);
        this.inputRef?.nativeElement.focus();
    }
    private capitalizeEachWord(str: string): string {
        if (typeof str !== 'string' || str.length === 0) {
            return str;
        }
        return str.split(' ')
            .map(word => word.charAt(0).toUpperCase() + word.slice(1))
            .join(' ');
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
                        this.suggestionsAll().tag[0])
                    : this.suggestionsSpecific()?.[0];

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
    
        const rx = new RegExp(`(?:^|[\\s_\\-\\/\\.])(${this.escapeRegex(query)})`, 'gi');
        this.prefixRegexCache.set(key, rx);
        return rx;
    }
    
}
