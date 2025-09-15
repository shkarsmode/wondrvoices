import { NgIf } from '@angular/common';
import { Component, inject, OnDestroy, OnInit, signal } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Meta, Title } from '@angular/platform-browser';
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import { first } from 'rxjs';
import { CloudinaryService } from '../../../../shared/services/cloudinary.service';
import { FormType, SubmissionService } from '../../../../shared/services/submission.service';
import { ImageUrlResponseDto } from '../../../../shared/types/imageUrlResponse.dto';

@Component({
    selector: 'app-spots',
    standalone: true,
    imports: [ReactiveFormsModule, NgIf],
    templateUrl: './spots.component.html',
    styleUrl: './spots.component.scss'
})
export class SpotsComponent implements OnInit, OnDestroy {
    private title = inject(Title);
    private meta = inject(Meta);
    private fb = inject(FormBuilder);

    private readonly formType: FormType = FormType.JoinSpot;
    private readonly submissionService: SubmissionService = inject(SubmissionService);
    private readonly cloudinaryService: CloudinaryService = inject(CloudinaryService);

    public form: FormGroup;
    public isLoading = signal(false);
    public submitted = signal(false);
    public pdfUrl = signal<string | null>(null);

    // Selected file and preview state
    private uploadedLogoFile: File | null = null;
    public logoPreviewUrl = signal<string | null>(null);
    public logoError = signal<string | null>(null);
    public isDragOver = signal<boolean>(false);

    public fields = [
        { key: 'organizationName', label: 'Organization Name', type: 'text',  autocomplete: 'organization' as const },
        { key: 'contactPerson',    label: 'Contact Person',    type: 'text',  autocomplete: 'name' as const },
        { key: 'email',            label: 'Email',             type: 'email', autocomplete: 'email' as const },
        { key: 'city',             label: 'City',              type: 'text',  autocomplete: 'address-level2' as const }
    ];

    constructor() {
        this.form = this.fb.group({
            organizationName: ['', Validators.required],
            contactPerson: ['', Validators.required],
            email: ['', [Validators.required, Validators.email]],
            city: ['', Validators.required],
            logo: [null],
            logoFileName: ['']
        });
    }

    public ngOnInit(): void {
        this.updateMetaTags();
    }

    public ngOnDestroy(): void {
        const url = this.pdfUrl();
        if (url) URL.revokeObjectURL(url);

        // Revoke preview URL to avoid memory leaks
        this.revokePreviewUrl();
    }

    public submit(): void {
        if (this.form.invalid) {
            this.form.markAllAsTouched();
            return;
        }
        this.isLoading.set(true);

        const file: File | null = this.uploadedLogoFile ?? this.form.get('logo')?.value ?? null;

        if (file) {
            this.cloudinaryService.uploadImageAndGetUrl(file).subscribe({
                next: async (response: ImageUrlResponseDto) => {
                    const logoUrl = response.imageUrl.url;
                    await this.createSubmissionAndPdf(logoUrl);
                },
                error: async () => {
                    // Proceed without logo if upload failed
                    await this.createSubmissionAndPdf(undefined);
                }
            });
        } else {
            this.createSubmissionAndPdf(undefined);
        }
    }

    public onLogoSelected(event: Event): void {
        const input = event.target as HTMLInputElement;
        const file = input.files && input.files[0] ? input.files[0] : null;
        this.applyLogoFile(file);
    }

    public onDragOver(event: DragEvent): void {
        event.preventDefault();
        this.isDragOver.set(true);
    }

    public onDragLeave(event: DragEvent): void {
        event.preventDefault();
        this.isDragOver.set(false);
    }

    public onDropLogo(event: DragEvent): void {
        event.preventDefault();
        this.isDragOver.set(false);
        const file = event.dataTransfer?.files?.[0] ?? null;
        this.applyLogoFile(file);
    }

    public triggerFileDialog(inputRef: HTMLInputElement): void {
        inputRef.click();
    }

    public clearLogo(inputRef: HTMLInputElement): void {
        this.uploadedLogoFile = null;
        this.form.patchValue({ logo: null, logoFileName: '' });
        inputRef.value = '';
        this.revokePreviewUrl();
        this.logoError.set(null);
    }

    private applyLogoFile(file: File | null): void {
        this.logoError.set(null);

        if (!file) {
            this.uploadedLogoFile = null;
            this.form.patchValue({ logo: null, logoFileName: '' });
            this.revokePreviewUrl();
            return;
        }

        const isValidType = /image\/(png|jpeg)/i.test(file.type);
        const isValidSize = file.size <= 5 * 1024 * 1024;

        if (!isValidType) {
            this.logoError.set('Please upload PNG or JPEG only.');
            return;
        }
        if (!isValidSize) {
            this.logoError.set('Max file size is 5 MB.');
            return;
        }

        this.uploadedLogoFile = file;
        this.form.patchValue({ logo: file, logoFileName: file.name });

        // Update preview
        this.revokePreviewUrl();
        const objectUrl = URL.createObjectURL(file);
        this.logoPreviewUrl.set(objectUrl);
    }

    private revokePreviewUrl(): void {
        const current = this.logoPreviewUrl();
        if (current) {
            URL.revokeObjectURL(current);
            this.logoPreviewUrl.set(null);
        }
    }

    private async createSubmissionAndPdf(logoUrl?: string): Promise<void> {
        this.submissionService
            .create({
                formType: this.formType,
                data: {
                    organizationName: this.form.value.organizationName,
                    contactPerson: this.form.value.contactPerson,
                    email: this.form.value.email,
                    city: this.form.value.city,
                    ...(logoUrl ? { logoUrl } : {})
                }
            })
            .pipe(first())
            .subscribe(async () => {
                this.submitted.set(true);
                this.isLoading.set(false);

                const pdfUrl = await this.generatePdfThankYou({
                    contactPerson: this.form.value.contactPerson,
                    email: this.form.value.email,
                    organizationName: this.form.value.organizationName,
                    city: this.form.value.city
                });
                this.pdfUrl.set(pdfUrl);
            }, () => {
                this.isLoading.set(false);
            });
    }

    private async generatePdfThankYou(formData: {
        contactPerson: string;
        email: string;
        organizationName: string;
        city: string;
    }): Promise<string> {
        const pdfDoc = await PDFDocument.create();
        const page = pdfDoc.addPage([600, 700]);
        const { width, height } = page.getSize();

        const gradientUrl = 'assets/img/gradient-bg.png';
        const gradientBytes = await fetch(gradientUrl).then(res => res.arrayBuffer());
        const gradientImage = await pdfDoc.embedPng(gradientBytes);
        page.drawImage(gradientImage, { x: 0, y: 0, width, height });

        const logoUrl = 'assets/img/full-logo.png';
        const logoBytes = await fetch(logoUrl).then(res => res.arrayBuffer());
        const logoImage = await pdfDoc.embedPng(logoBytes);
        const logoDims = logoImage.scale(0.2);
        page.drawImage(logoImage, {
            x: (width - logoDims.width) / 2,
            y: height - 80,
            width: logoDims.width,
            height: logoDims.height
        });

        const decoUrl = 'assets/img/lines.png';
        const decoBytes = await fetch(decoUrl).then(res => res.arrayBuffer());
        const decoImage = await pdfDoc.embedPng(decoBytes);
        const decoDims = decoImage.scale(0.3);
        page.drawImage(decoImage, {
            x: width - decoDims.width - 30,
            y: height - decoDims.height - 160,
            width: decoDims.width,
            height: decoDims.height
        });

        const helvetica = await pdfDoc.embedFont(StandardFonts.Helvetica);
        const helveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

        page.drawText('Thank You for Becoming a WondrSpot!', {
            x: 50,
            y: height - 130,
            size: 22,
            font: helveticaBold,
            color: rgb(0.95, 0.38, 0.16)
        });

        // Draw partner logo if user provided it
        if (this.uploadedLogoFile) {
            const bytes = await this.uploadedLogoFile.arrayBuffer();
            const embedded = /image\/png/i.test(this.uploadedLogoFile.type)
                ? await pdfDoc.embedPng(bytes)
                : await pdfDoc.embedJpg(bytes);

            const scale = embedded.scale(0.25);
            page.drawImage(embedded, {
                x: width - scale.width - 50,
                y: 50,
                width: scale.width,
                height: scale.height
            });
            page.drawText('Partner logo', {
                x: width - scale.width - 50,
                y: 50 + scale.height + 6,
                size: 10,
                font: helvetica,
                color: rgb(0.36, 0.22, 0.18)
            });
        }

        let y = height - 180;
        const rowHeight = 35;
        const col1Width = 180;

        const rows = [
            { label: 'Organization Name', value: formData.organizationName },
            { label: 'City', value: formData.city },
            { label: 'Contact Person', value: formData.contactPerson },
            { label: 'Email', value: formData.email }
        ];

        rows.forEach(row => {
            page.drawRectangle({
                x: 50,
                y: y - rowHeight + 5,
                width: width - 100,
                height: rowHeight - 5,
                color: rgb(1, 0.95, 0.9),
                opacity: 0.4
            });

            page.drawText(row.label + ':', {
                x: 60,
                y: y - 20,
                size: 14,
                font: helveticaBold,
                color: rgb(0.36, 0.22, 0.18)
            });

            page.drawText(row.value, {
                x: 60 + col1Width,
                y: y - 20,
                size: 14,
                font: helvetica,
                color: rgb(0.2, 0.2, 0.2)
            });

            y -= rowHeight;
        });

        y -= 30;
        page.drawText('Your spot helps spread hope and kindness.', {
            x: 50,
            y,
            size: 14,
            font: helvetica,
            color: rgb(0.36, 0.62, 0.24)
        });

        const pdfBytes = await pdfDoc.save();
        const blob = new Blob([pdfBytes], { type: 'application/pdf' });
        return URL.createObjectURL(blob);
    }

    private updateMetaTags(): void {
        this.title.setTitle('Become a WondrSpot | WondrVoices');
        this.meta.updateTag({ name: 'description', content: 'Become a WondrSpot and help spread hope and kindness.' });
        this.meta.updateTag({ property: 'og:title', content: 'Become a WondrSpot | WondrVoices' });
        this.meta.updateTag({ property: 'og:description', content: 'Become a WondrSpot and help spread hope and kindness.' });
        this.meta.updateTag({ property: 'og:image', content: 'https://www.wondrvoices.com/assets/img/spots/banner-1.png' });
        this.meta.updateTag({ property: 'og:image:alt', content: 'WondrSpots' });
        this.meta.updateTag({ property: 'og:url', content: 'https://www.wondrvoices.com/spots' });
        this.meta.updateTag({ property: 'twitter:title', content: 'Become a WondrSpot | WondrVoices' });
        this.meta.updateTag({ property: 'twitter:description', content: 'Become a WondrSpot and help spread hope and kindness.' });
        this.meta.updateTag({ property: 'twitter:image', content: 'https://www.wondrvoices.com/assets/img/spots/banner-1.png' });
        this.meta.updateTag({ name: 'twitter:card', content: 'summary_large_image' });
    }
}
