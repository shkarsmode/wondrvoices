import { Component, inject, signal } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { SwiperComponent } from '../../components/swiper/swiper.component';

@Component({
    selector: 'app-get-involved',
    standalone: true,
    imports: [SwiperComponent, ReactiveFormsModule],
    templateUrl: './get-involved.component.html',
    styleUrl: './get-involved.component.scss'
})
export class GetInvolvedComponent {
    public slides = [
        { imageUrl: 'assets/voices/6.jpg' },
        { imageUrl: 'assets/voices/11.jpg' },
        { imageUrl: 'assets/voices/4.jpg' },
        { imageUrl: 'assets/voices/9.jpg' },
        { imageUrl: 'assets/voices/15.jpg' },
        { imageUrl: 'assets/voices/19.jpg' },
    ];

    public form: FormGroup;
    public submitted = signal(false);

    private fb: FormBuilder = inject(FormBuilder);

    public fieldMap: Record<string, string> = {
        firstName: 'First Name',
        email: 'Email',
        location: 'City, State',
        creditTo: 'Social Handle (optional)'
    };

    constructor() {
        this.form = this.fb.group({
            firstName: ['', [Validators.required, Validators.minLength(2)]],
            email: ['', [Validators.required, Validators.email]],
            location: ['', Validators.required],
            creditTo: [''],
            consent: [false, Validators.requiredTrue]
        });
    }

    public submit() {
        if (this.form.valid) {
            this.submitted.set(true);
            console.log('[Ambassador Form Submitted]:', this.form.value);

            // Here you can send the form data to backend, e.g. via HttpClient
        } else {
            this.form.markAllAsTouched();
        }
    }

}
