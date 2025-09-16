import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ScrollToService } from 'src/app/shared/services/scroll-to.service';
import { CloudinaryService } from '../../../../shared/services/cloudinary.service';
import { VoicesService } from '../../../../shared/services/voices.service';
import { ImageUrlResponseDto } from '../../../../shared/types/imageUrlResponse.dto';
import { CreateVoiceRequest } from '../../../../shared/types/voices';

type TagGroup = 'what' | 'express' | 'from';

interface TagOption {
    key: string;
    label: string;
    emoji: string;
    custom?: boolean;
}

type Step = 1 | 2 | 3;

@Component({
    selector: 'app-form',
    standalone: true,
    imports: [ReactiveFormsModule],
    templateUrl: './form.component.html',
    styleUrl: './form.component.scss',
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class FormComponent {
    public form: FormGroup;
    public submitted = signal(false);
    public isLoading = signal(false);
    public isDragOver = signal(false);
    public previewUrl = signal<string | null>(null);

    public maxMap = {
        location: 100,     // City
        creditTo: 50,
        name: 50,
        email: 50
    };

    step = signal<Step>(1);
    rotationDeg = signal(0);

    private fb: FormBuilder = inject(FormBuilder);
    public cloudinaryService: CloudinaryService = inject(CloudinaryService);
    public voicesService: VoicesService = inject(VoicesService);
    private readonly scrollToService: ScrollToService = inject(ScrollToService);

    public whatOptions: TagOption[] = [
        // { key: 'drawing', label: 'Drawing', emoji: '✏️' },
        // { key: 'painting', label: 'Painting', emoji: '🖌️' },
        // { key: 'photo', label: 'Photo', emoji: '📸' },
        // { key: 'kids_art', label: 'Kids Art', emoji: '🧒' },
        // { key: 'letter', label: 'Letter', emoji: '✉️' },
        // { key: 'prayer', label: 'Prayer', emoji: '🙏' },
        // { key: 'wish', label: 'Wish', emoji: '🌟' },
        // { key: 'poem', label: 'Poem', emoji: '📝' },
        // { key: 'quote', label: 'Quote', emoji: '📔' },
        // { key: 'memory', label: 'Memory', emoji: '🧠' },
        // { key: 'thought', label: 'Thought', emoji: '💭' },
        // { key: 'pet', label: 'Pet', emoji: '🐾' },
        // { key: 'nature', label: 'Nature', emoji: '🌿' },
        { key: 'art', label: 'Art', emoji: '🎨' },
        { key: 'photo', label: 'Photo', emoji: '🎨' },
        { key: 'kids', label: 'Kids', emoji: '🧒' },
        { key: 'words', label: 'Words', emoji: '📝' },
        { key: 'other', label: 'Other', emoji: '🌀' },
    ];

    public expressOptions: TagOption[] = [
        { key: 'love', label: 'Love', emoji: '❤️' },
        // { key: 'peace', label: 'Peace', emoji: '☮️' },
        { key: 'hope', label: 'Hope', emoji: '🌈' },
        // { key: 'joy', label: 'Joy', emoji: '😊' },
        // { key: 'strength', label: 'Strength', emoji: '💪' },
        { key: 'faith', label: 'Faith', emoji: '🕊️' },
        // { key: 'encouragement', label: 'Encouragement', emoji: '✨' },
        // { key: 'friendship', label: 'Friendship', emoji: '🤝' },
        // { key: 'comfort', label: 'Comfort', emoji: '🫂' },
        // { key: 'healing', label: 'Healing', emoji: '💚' },
        { key: 'grief', label: 'Grief', emoji: '🖤' },
        // { key: 'support', label: 'Support', emoji: '🧷' },
        // { key: 'gratitude', label: 'Gratitude', emoji: '🙏' },
        // { key: 'compassion', label: 'Compassion', emoji: '💞' },
        // { key: 'connection', label: 'Connection', emoji: '🔗' },
        // { key: 'resilience', label: 'Resilience', emoji: '🌱' }
    ];

    public fromOptions: TagOption[] = [
        { key: 'child', label: 'Child', emoji: '🧒' },
        { key: 'senior', label: 'Senior', emoji: '👵' },
        { key: 'school', label: 'School', emoji: '🏫' },
        { key: 'program', label: 'Program', emoji: '📘' },
        { key: 'family', label: 'Family', emoji: '👨‍👩‍👧‍👦' },
        { key: 'parent', label: 'Parent', emoji: '🧑‍🍼' },
        { key: 'in_tribute', label: 'In Tribute', emoji: '🎗️' },
        { key: 'survivor', label: 'Survivor', emoji: '🌟' },
        { key: 'artist', label: 'Artist', emoji: '🎨' },
        { key: 'caregiver', label: 'Caregiver', emoji: '🩺' },
        { key: 'volunteer', label: 'Volunteer', emoji: '🤍' }
    ];

    public autocompleteMap: Record<string, string> = {
        firstName: 'name',
        email: 'email',
        location: 'address-level2',
        creditTo: 'organization'
    };

    public inputModeMap: Record<string, string> = { email: 'email' };
    public typeMap: Record<string, string> = { email: 'email' };
    public autocapitalizeMap: Record<string, string> = { firstName: 'words' };
    

    constructor() {
        this.form = this.fb.group({
            name: ['', [Validators.maxLength(this.maxMap.name)]],
            email: ['', [Validators.email, Validators.maxLength(this.maxMap.email)]],
            location: ['', [Validators.required, Validators.maxLength(this.maxMap.location)]],
            creditTo: ['', [Validators.maxLength(this.maxMap.creditTo)]],
            what: this.fb.control<string[]>([], []),
            express: this.fb.control<string[]>([], []),
            note: [''],
            img: [null, Validators.required],
            consent: [false, Validators.requiredTrue]
          });
    }

    public isSelected(group: TagGroup, key: string): boolean {
        const arr = this.form.get(group) as FormControl<string[]>;
        const v = arr.value ?? [];
        return v.includes(key);
    }

    public disableChip(group: TagGroup, key: string): boolean {
        const selected = (this.form.get(group)?.value as string[]) ?? [];
        return selected.length >= 3 && !selected.includes(key);
    }

    public toggle(group: TagGroup, key: string): void {
        const ctrl = this.form.get(group) as FormControl<string[]>;
        const current = (ctrl.value ?? []).slice();
        const i = current.indexOf(key);
        if (i >= 0) current.splice(i, 1);
        else if (current.length < 3) current.push(key);
        ctrl.setValue(current);
        ctrl.markAsDirty();
        ctrl.markAsTouched();
    }

    public onFileDrop(event: DragEvent) {
        event.preventDefault();
        this.isDragOver.set(false);
        const file = event.dataTransfer?.files[0];
        if (file) this.setFile(file);
    }

    public onDragOver(event: DragEvent) {
        event.preventDefault();
        this.isDragOver.set(true);
    }

    public onDragLeave() {
        this.isDragOver.set(false);
    }

    private setFile(file: File) {
        this.form.patchValue({ img: file });
        const reader = new FileReader();
        reader.onload = () => this.previewUrl.set(reader.result as string);
        reader.readAsDataURL(file);
        this.rotationDeg.set(0);
    }

    public onFileChange(event: any) {
        const file = event.target.files[0];
        if (!file) return;
        this.setFile(file);
    }

    public clearFile(event: Event) {
        this.form.patchValue({ img: null });
        this.previewUrl.set(null);
        this.rotationDeg.set(0);
        event.stopPropagation();
    }

    rotateLeft() { this.rotationDeg.update(v => v - 90); }
    rotateRight() { this.rotationDeg.update(v => v + 90); }

    private async maybeRotatedFile(file: File): Promise<File> {
        const deg = ((this.rotationDeg() % 360) + 360) % 360;
        if (!deg || !file.type.startsWith('image/')) return file;

        return new Promise<File>((resolve, reject) => {
            const fr = new FileReader();
            fr.onload = () => {
                const img = new Image();
                img.onload = () => {
                    const rad = deg * Math.PI / 180;
                    const swap = deg === 90 || deg === 270;
                    const cw = swap ? img.height : img.width;
                    const ch = swap ? img.width : img.height;
                    const c = document.createElement('canvas');
                    c.width = cw;
                    c.height = ch;
                    const ctx = c.getContext('2d')!;
                    ctx.translate(cw / 2, ch / 2);
                    ctx.rotate(rad);
                    ctx.drawImage(img, -img.width / 2, -img.height / 2);
                    c.toBlob(b => {
                        if (!b) return reject();
                        const out = new File([b], file.name.replace(/\.[^.]+$/, '') + '_rot.jpg', { type: 'image/jpeg' });
                        resolve(out);
                    }, 'image/jpeg', 0.92);
                };
                img.onerror = () => reject();
                img.src = fr.result as string;
            };
            fr.onerror = () => reject();
            fr.readAsDataURL(file);
        });
    }

    public submit() {
        if (this.form.valid) {
            this.prepareToUploadVoice();
        } else {
            this.form.markAllAsTouched();
        }
    }

    public prepareToUploadVoice(): void {
        if (this.form.invalid) return;
        this.isLoading.set(true);
        this.uploadAngGetPictureUrl();
    }

    private async uploadAngGetPictureUrl(): Promise<void> {
        try {
            const original: File = this.form.get('img')?.value;
            const toUpload = await this.maybeRotatedFile(original);
            this.cloudinaryService.uploadImageAndGetUrl(toUpload).subscribe({
                next: response => this.uploadVoice(response),
                error: () => this.isLoading.set(false)
            });
        } catch {
            const fallback: File = this.form.get('img')?.value;
            this.cloudinaryService.uploadImageAndGetUrl(fallback).subscribe({
                next: response => this.uploadVoice(response),
                error: () => this.isLoading.set(false)
            });
        }
    }

    private uploadVoice(response: ImageUrlResponseDto): void {
        const img: string = response.imageUrl.url;
        const body: CreateVoiceRequest = {
            firstName: this.form.get('name')?.value,
            email: this.form.get('email')?.value,
            location: this.form.get('location')?.value,
            creditTo: this.form.get('creditTo')?.value,
            what: this.form.get('what')?.value,
            express: this.form.get('express')?.value,
            note: this.form.get('note')?.value,
            img,
            consent: this.form.get('consent')?.value
        };
        this.voicesService.createVoice(body).subscribe({
            next: () => {
                this.isLoading.set(false);
                this.submitted.set(true);
            },
            error: () => this.isLoading.set(false)
        });
    }

    public autoResize(event: Event): void {
        const textarea = event.target as HTMLTextAreaElement;
        textarea.style.height = 'auto';
        textarea.style.height = textarea.scrollHeight + 'px';
    }

    public draftWhat = '';
    public draftExpress = '';

    private slugifyLabel(label: string): string {
        return (label || '').trim().toLowerCase().normalize('NFKD')
            .replace(/[^\p{Letter}\p{Number}\s-]/gu, '')
            .replace(/\s+/g, '-')
            .replace(/-+/g, '-')
            .replace(/^-|-$/g, '');
    }

    private findOptionByKey(group: TagGroup, key: string): TagOption | undefined {
        const list = group === 'what' ? this.whatOptions : group === 'express' ? this.expressOptions : this.fromOptions;
        return list.find(o => o.key === key);
    }

    public resolveLabel(group: TagGroup, key: string): string {
        return this.findOptionByKey(group, key)?.label ?? key;
    }

    public canAddDraft(group: 'what' | 'express'): boolean {
        const draft = group === 'what' ? this.draftWhat : this.draftExpress;
        const v = (draft || '').trim();
        if (v.length < 2 || v.length > 24) return false;
        if (!/^[\p{Letter}\p{Number}\s-]+$/u.test(v)) return false;
        const ctrl = this.form.get(group) as FormControl<string[]>;
        const selected = ctrl.value ?? [];
        if (selected.length >= 3) return false;
        const norm = v.toLowerCase();
        const duplicateByLabel = selected.some(k => this.resolveLabel(group, k).toLowerCase() === norm);
        if (duplicateByLabel) return false;
        const slug = this.slugifyLabel(v);
        const existsInOptions = !!this.findOptionByKey('what', slug) || !!this.findOptionByKey('express', slug);
        if (existsInOptions) return false;
        return true;
    }

    public getLen(field: keyof typeof this.maxMap): number {
        const v = (this.form.get(field)?.value ?? '') as string;
        return v.length;
    }

    public addCustomTag(group: 'what' | 'express'): void {
        if (!this.canAddDraft(group)) return;
        const draft = (group === 'what' ? this.draftWhat : this.draftExpress).trim();
        const key = draft;
        const ctrl = this.form.get(group) as FormControl<string[]>;
        const current = (ctrl.value ?? []).slice();
        if (current.length >= 3) return;
        current.push(key);
        ctrl.setValue(current);
        ctrl.markAsDirty();
        ctrl.markAsTouched();
        if (group === 'what') {
            this.whatOptions.push({ key, label: draft, emoji: '✍️', custom: true });
            this.draftWhat = '';
        } else {
            this.expressOptions.push({ key, label: draft, emoji: '✍️', custom: true });
            this.draftExpress = '';
        }
    }

    public removeTag(group: TagGroup, key: string): void {
        const ctrl = this.form.get(group) as FormControl<string[]>;
        const current = (ctrl.value ?? []).filter(k => k !== key);
        ctrl.setValue(current);
        ctrl.markAsDirty();
        ctrl.markAsTouched();
    }

    goNext() {
        if (this.step() === 1 && !this.form.get('img')?.value) return;
        if (this.step() === 3) return;
        this.step.update(s => (s + 1) as Step);
        this.scrollToService.scrollToTop();
        
    }
    goBack() {
        if (this.step() === 1) return;
        this.step.update(s => (s - 1) as Step);
        this.scrollToService.scrollToTop();
    }

    naturalW = signal(1);
    naturalH = signal(1);
    rotated = computed(() => Math.abs(this.rotationDeg()) % 180 === 90);

    onImgLoad(e: Event) {
        const img = e.target as HTMLImageElement;
        this.naturalW.set(img.naturalWidth);
        this.naturalH.set(img.naturalHeight);
        console.log(img.naturalWidth, img.naturalHeight);
    }

    public computeQuadraticMargin(delta: number): number {
        const a = -0.00006391;
        const b = 0.11447;
        const c = 4.44;
        const margin = (a * delta * delta) + (b * delta) + c;
        return Math.min(55, Math.max(10, margin));
    }
}
