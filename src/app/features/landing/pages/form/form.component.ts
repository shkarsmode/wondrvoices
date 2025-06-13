import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';

@Component({
    selector: 'app-form',
    standalone: true,
    imports: [
        ReactiveFormsModule
    ],
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

    constructor() {
        this.form = this.fb.group({
            firstName: ['', Validators.minLength(2)],
            email: ['', [Validators.email]],
            location: [''],
            creditTo: [''],
            file: [null, Validators.required],
            consent: [false, Validators.requiredTrue]
        });
    }

    public onFileDrop(event: DragEvent) {
        event.preventDefault();
        this.isDragOver.set(false);
        const file = event.dataTransfer?.files[0];
        if (file) {
            this.setFile(file);
        }
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
        reader.onload = () => {
            this.previewUrl.set(reader.result as string);
        };
        reader.readAsDataURL(file);
    }

    public onFileChange(event: any) {
        const file = event.target.files[0];
        this.form.patchValue({ file });
        const reader = new FileReader();
        reader.onload = () => {
            this.previewUrl.set(reader.result as string);
        };
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
            console.log('Form submitted:', this.form.value);
        } else {
            this.form.markAllAsTouched();
        }
    }
}
