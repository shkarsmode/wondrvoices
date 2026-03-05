import { Component, inject, OnInit, signal } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Meta, Title } from '@angular/platform-browser';
import { FormType, SubmissionService } from '../../../../shared/services/submission.service';

@Component({
    selector: 'app-spots',
    imports: [ReactiveFormsModule],
    templateUrl: './spots.component.html',
    styleUrl: './spots.component.scss'
})
export class SpotsComponent implements OnInit {
    private title = inject(Title);
    private meta = inject(Meta);
    private fb = inject(FormBuilder);

    private readonly formType: FormType = FormType.JoinSpot;
    private readonly submissionService: SubmissionService = inject(SubmissionService);

    public form: FormGroup;
    public isLoading = signal(false);
    public submitted = signal(false);

    // Organization type options
    public organizationTypes = [
        { id: 'healthcare', label: 'Healthcare Facility' },
        { id: 'school', label: 'School / University' },
        { id: 'corporation', label: 'Corporation / Business' },
        { id: 'nonprofit', label: 'Nonprofit / Foundation' },
        { id: 'community', label: 'Community Organization' },
        { id: 'faith', label: 'Faith-Based Organization' },
        { id: 'other', label: 'Other' }
    ];

    public fields = [
        { key: 'contactPerson',    label: 'Your Name',          type: 'text',  autocomplete: 'name' as const },
        { key: 'organizationName', label: 'Organization Name',  type: 'text',  autocomplete: 'organization' as const },
        { key: 'email',            label: 'Email Address',      type: 'email', autocomplete: 'email' as const },
    ];

    constructor() {
        this.form = this.fb.group({
            contactPerson: ['', Validators.required],
            organizationName: ['', Validators.required],
            organizationType: ['', Validators.required],
            email: ['', [Validators.required, Validators.email]],
            message: [''],
        });
    }

    public ngOnInit(): void {
        this.updateMetaTags();
    }

    public submit(): void {
        if (this.form.invalid) {
            this.form.markAllAsTouched();
            return;
        }
        this.isLoading.set(true);
        this.createSubmission();
    }

    private async createSubmission(): Promise<void> {
        this.submitted.set(true);
        this.isLoading.set(false);
    }

    private updateMetaTags(): void {
        this.title.setTitle('Partner With Us | WondrVoices');
        this.meta.updateTag({ name: 'description', content: 'Partner with WondrVoices to spread hope and kindness in your community.' });
        this.meta.updateTag({ property: 'og:title', content: 'Partner With Us | WondrVoices' });
        this.meta.updateTag({ property: 'og:description', content: 'Partner with WondrVoices to spread hope and kindness in your community.' });
        this.meta.updateTag({ property: 'og:image', content: 'https://www.wondrvoices.com/assets/img/spots/banner-1.webp' });
        this.meta.updateTag({ property: 'og:image:alt', content: 'WondrVoices Partners' });
        this.meta.updateTag({ property: 'og:url', content: 'https://www.wondrvoices.com/spots' });
        this.meta.updateTag({ property: 'twitter:title', content: 'Partner With Us | WondrVoices' });
        this.meta.updateTag({ property: 'twitter:description', content: 'Partner with WondrVoices to spread hope and kindness in your community.' });
        this.meta.updateTag({ property: 'twitter:image', content: 'https://www.wondrvoices.com/assets/img/spots/banner-1.webp' });
        this.meta.updateTag({ name: 'twitter:card', content: 'summary_large_image' });
    }
}
