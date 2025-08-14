import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormBuilder, FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';

type TagGroup = 'what' | 'express' | 'from';

interface TagOption {
    key: string;   // machine key
    label: string; // human label without emoji
    emoji: string; // leading emoji for UI
}

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
    public isDragOver = signal(false);
    public previewUrl = signal<string | null>(null);

    private fb: FormBuilder = inject(FormBuilder);

    public fieldMap: Record<string, string> = {
        firstName: 'First Name (optional)',
        email: 'Email (optional)',
        location: 'City, State (optional)',
        creditTo: 'Give Credit To (optional)'
    };

    // --- Tag options (keys are API-friendly)
    public whatOptions: TagOption[] = [
        { key: 'drawing', label: 'Drawing', emoji: '✏️' },
        { key: 'painting', label: 'Painting', emoji: '🖌️' },
        { key: 'photo', label: 'Photo', emoji: '📸' },
        { key: 'kids_art', label: 'Kids Art', emoji: '🧒' },
        { key: 'letter', label: 'Letter', emoji: '✉️' },
        { key: 'prayer', label: 'Prayer', emoji: '🙏' },
        { key: 'wish', label: 'Wish', emoji: '🌟' },
        { key: 'poem', label: 'Poem', emoji: '📝' },
        { key: 'quote', label: 'Quote', emoji: '📔' },
        { key: 'memory', label: 'Memory', emoji: '🧠' },
        { key: 'thought', label: 'Thought', emoji: '💭' },
        { key: 'pet', label: 'Pet', emoji: '🐾' },
        { key: 'nature', label: 'Nature', emoji: '🌿' },
        { key: 'other', label: 'Other', emoji: '🌀' }
    ];

    public expressOptions: TagOption[] = [
        { key: 'love', label: 'Love', emoji: '❤️' },
        { key: 'peace', label: 'Peace', emoji: '☮️' },
        { key: 'hope', label: 'Hope', emoji: '🌈' },
        { key: 'joy', label: 'Joy', emoji: '😊' },
        { key: 'strength', label: 'Strength', emoji: '💪' },
        { key: 'faith', label: 'Faith', emoji: '🕊️' },
        { key: 'encouragement', label: 'Encouragement', emoji: '✨' },
        { key: 'friendship', label: 'Friendship', emoji: '🤝' },
        { key: 'comfort', label: 'Comfort', emoji: '🫂' },
        { key: 'healing', label: 'Healing', emoji: '💚' },
        { key: 'grief', label: 'Grief', emoji: '🖤' },
        { key: 'support', label: 'Support', emoji: '🧷' },
        { key: 'gratitude', label: 'Gratitude', emoji: '🙏' },
        { key: 'compassion', label: 'Compassion', emoji: '💞' },
        { key: 'connection', label: 'Connection', emoji: '🔗' },
        { key: 'resilience', label: 'Resilience', emoji: '🌱' }
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

    constructor() {
        this.form = this.fb.group({
            firstName: ['', Validators.minLength(2)],
            email: ['', [Validators.email]],
            location: [''],
            creditTo: [''],

            // New tag groups + note
            what: this.fb.control<string[]>([], []),
            express: this.fb.control<string[]>([], []),
            from: this.fb.control<string[]>([], []),
            note: [''],

            file: [null, Validators.required],
            consent: [false, Validators.requiredTrue]
        });
    }

    // --- Chip logic
    public isSelected(group: TagGroup, key: string): boolean {
        const arr = this.form.get(group) as FormControl<string[]>;
        const v = arr.value ?? [];
        return v.includes(key);
    }

    public disableChip(group: TagGroup, key: string): boolean {
        const selected = (this.form.get(group)?.value as string[]) ?? [];
        // chip is disabled if already 3 selected and this chip is not selected
        return selected.length >= 3 && !selected.includes(key);
    }

    public toggle(group: TagGroup, key: string): void {
        const ctrl = this.form.get(group) as FormControl<string[]>;
        const current = (ctrl.value ?? []).slice();

        const i = current.indexOf(key);
        if (i >= 0) {
            current.splice(i, 1);
        } else {
            if (current.length >= 3) return; // guard
            current.push(key);
        }
        ctrl.setValue(current);
        ctrl.markAsDirty();
        ctrl.markAsTouched();
    }

    // --- Dropzone (без изменений)
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
        this.form.patchValue({ file });

        const reader = new FileReader();
        reader.onload = () => this.previewUrl.set(reader.result as string);
        reader.readAsDataURL(file);
    }

    public onFileChange(event: any) {
        const file = event.target.files[0];
        this.form.patchValue({ file });
        const reader = new FileReader();
        reader.onload = () => this.previewUrl.set(reader.result as string);
        reader.readAsDataURL(file);
    }

    public clearFile(event: Event) {
        this.form.patchValue({ file: null });
        this.previewUrl.set(null);
        event.stopPropagation();
    }

    public submit() {
        if (this.form.valid) {
            this.submitted.set(true);
            // Здесь уже будут: what[], express[], from[], note
            console.log('Form submitted:', this.form.value);
        } else {
            this.form.markAllAsTouched();
        }
    }
}
