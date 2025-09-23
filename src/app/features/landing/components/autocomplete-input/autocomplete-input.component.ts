// autocomplete-input.component.ts
import { NgFor, NgIf } from '@angular/common';
import {
    ChangeDetectionStrategy,
    Component, effect,
    ElementRef,
    EventEmitter, forwardRef,
    HostBinding,
    Input, Output, signal,
    ViewChild
} from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';
import { VoicesService } from 'src/app/shared/services/voices.service';
import { VoiceStatus } from 'src/app/shared/types/voices';

@Component({
    selector: 'w-autocomplete',
    standalone: true,
    imports: [NgIf, NgFor],
    changeDetection: ChangeDetectionStrategy.OnPush,
    providers: [{
        provide: NG_VALUE_ACCESSOR,
        useExisting: forwardRef(() => AutocompleteInputComponent),
        multi: true,
    }],
    template: `
  <div class="auto" (keydown)="onKeydown($event)">
    <input
      #inp
      [type]="placeholder.length ? 'search' : 'text'"
      [attr.aria-expanded]="open()"
      [attr.aria-autocomplete]="'list'"
      [attr.aria-haspopup]="'listbox'"
      [attr.placeholder]="placeholder"
      [attr.autocomplete]="autocomplete"
      [attr.name]="name"
      [maxLength]="maxLength"
      [disabled]="disabled"
      [value]="value()"
      (input)="onInput(($any($event.target).value))"
      (focus)="onFocus()"
      (blur)="onBlur()" />

    <ul class="menu" *ngIf="open() && suggestions().length" role="listbox">
      <li *ngFor="let s of suggestions(); let i = index"
          role="option"
          (mousedown)="pick(s)"
          [attr.data-index]="i">{{ s }}</li>
    </ul>

    <div class="empty" *ngIf="open() && !suggestions().length">
      {{ emptyHint }}
    </div>
  </div>
  `,
    styles: [`
    :host { display:flex; flex:1 1 200px; }
    .auto { position: relative; width: 100%;}
    input {
      width: 100%; padding: .5rem .75rem; border:1px solid #d0d7de; border-radius:8px;
    }
    input:focus {
      outline: none; border-color: #4dabf7; box-shadow: 0 0 0 3px rgba(77,171,247,0.2);
    }
    input:disabled { background:#f1f3f5; cursor:not-allowed; }
    .menu {
      position:absolute; left:0; right:0; top:100%; z-index:20;
      background:#fff; border:1px solid #e9ecef; border-radius:8px; margin:.25rem 0 0; padding:.25rem 0;
      max-height:240px; overflow:auto; box-shadow:0 8px 20px rgba(0,0,0,.08);
      box-shadow: 0 8px 20px rgba(0, 0, 0, 0.08);
    }
    .menu li { padding:.5rem .75rem; cursor:pointer; font-size: 14px }
    .menu li:hover { background:#f1f3f5; }
    .empty {
      position:absolute; left:0; right:0; top:100%;
      padding:.6rem .75rem; background:#fff; border:1px dashed #e9ecef; border-radius:8px; margin:.25rem 0 0;
      color:#868e96; font-size:.9rem;
      z-index: 1;
    }
  `],
})
export class AutocompleteInputComponent implements ControlValueAccessor {
    @Input() field: 'creditTo' | 'location' | 'what' | 'express' = 'creditTo';
    @Input() placeholder = 'Type to search…';
    @Input() emptyHint = 'No suggestions';
    @Input() limit = 10;
    @Input() status: VoiceStatus | 'all' = VoiceStatus.Approved;
    @Input() maxLength: number | null = 300;
    @Input() autocomplete: 'on' | 'off' | any = 'on';
    @Input() name: string | null = null;

    @Input() set initial(v: string | undefined) { if (v !== undefined) this.setValue(v, false); }

    @Output() select = new EventEmitter<string>();
    @Output() inputChange = new EventEmitter<string>();

    public isFocused = false;

    @ViewChild('inp', { static: true }) inputRef!: ElementRef<HTMLInputElement>;

    value = signal<string>('');
    open = signal(false);
    suggestions = signal<string[]>([]);
    disabled = false;

    private cache = new Map<string, string[]>(); // key: `${field}|${status}|${limit}|${q}`

    // CVA callbacks
    private onChange: (v: string) => void = () => { };
    private onTouched: () => void = () => { };

    @HostBinding('class.disabled') get isDisabled() { return this.disabled; }

    constructor(private api: VoicesService) {
        // реакция на ввод с лёгким дебаунсом
        effect(onCleanup => {
            const q = this.value().trim();
            // debounce 250ms
            const timer = setTimeout(() => {
                const key = `${this.field}|${this.status}|${this.limit}|${q}`;
                if (!q || q.length < 1) {
                    this.suggestions.set([]);
                    return;
                }
                if (this.cache.has(key)) {
                    this.suggestions.set(this.cache.get(key)!);
                    return;
                }
                this.api.getSuggestions(this.field, q, {
                    limit: this.limit,
                    status: this.status,
                }).subscribe(list => {
                    this.cache.set(key, list);
                    this.suggestions.set(list);
                }, () => this.suggestions.set([]));
            }, 250);

            onCleanup(() => clearTimeout(timer));
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
    onInput(v: string) {
        this.setValue(v, true);
        this.open.set(true);
        this.inputChange.emit(v);
    }
    onFocus() {
        this.open.set(true);
        this.isFocused = true;
    }
    onBlur() {
        // даём время mousedown по опции сработать
        this.isFocused = false;
        setTimeout(() => {
            this.open.set(false);
            this.onTouched();
        }, 120);
    }
    pick(s: string) {
        this.setValue(s, true);
        this.select.emit(s);
        this.open.set(false);
        // фокус остаётся на инпуте (удобно для быстрых правок)
        this.inputRef?.nativeElement.focus();
    }
    onKeydown(evt: KeyboardEvent) {
        if (evt.key === 'Escape') {
            this.open.set(false);
            evt.stopPropagation();
        } else if (evt.key === 'Enter') {
            const [first] = this.suggestions();
            if (first) {
                evt.preventDefault();
                this.pick(first);
            }
        }
    }

    private setValue(v: string, propagate: boolean) {
        if (this.value() === v) return;
        this.value.set(v);
        if (propagate) this.onChange(v);
    }
}
