import { Component, inject, OnInit, signal } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Meta, Title } from '@angular/platform-browser';
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import { first } from 'rxjs';
import { FormType, SubmissionService } from '../../../../shared/services/submission.service';
import { SwiperComponent } from '../../components/swiper/swiper.component';

@Component({
    selector: 'app-get-involved',
    standalone: true,
    imports: [SwiperComponent, ReactiveFormsModule],
    templateUrl: './get-involved.component.html',
    styleUrl: './get-involved.component.scss'
})
export class GetInvolvedComponent implements OnInit {
    private title = inject(Title);
    private meta = inject(Meta);
    private readonly formType: FormType = FormType.GetInvolved;
    private readonly submissionService: SubmissionService = inject(SubmissionService);
    public slides = [
        { imageUrl: 'assets/voices/6.jpg' },
        { imageUrl: 'assets/voices/11.jpg' },
        { imageUrl: 'assets/voices/4.jpg' },
        { imageUrl: 'assets/voices/9.jpg' },
        { imageUrl: 'assets/voices/15.jpg' },
        { imageUrl: 'assets/voices/19.jpg' },
    ];

    public form: FormGroup;
    public isLoading = signal(false);
    public submitted = signal(false);

    private fb: FormBuilder = inject(FormBuilder);

    public fields = [
        { key: 'firstName', label: 'Name', type: 'text', autocomplete: 'name' as const },
        { key: 'email', label: 'Email', type: 'email', autocomplete: 'email' as const },
        { key: 'location', label: 'City, State', type: 'text', autocomplete: 'address-level2' as const },
        { key: 'creditTo', label: 'Social Handle (optional)', type: 'text', autocomplete: 'nickname' as const },
      ];

    constructor() {
        this.form = this.fb.group({
            firstName: ['', [Validators.required, Validators.minLength(2)]],
            email: ['', [Validators.required, Validators.email]],
            location: ['', Validators.required],
            creditTo: [''],
            consent: [false, Validators.requiredTrue]
        });
    }

    public ngOnInit(): void {
        this.updateMetaTags();
    }

    private updateMetaTags(): void {
        this.title.setTitle('Get Involved | Wondrvoices');
        this.meta.updateTag({ name: 'description', content: 'Get involved and help spread hope and kindness with WondrVoices.' });
        this.meta.updateTag({ property: 'og:title', content: 'Get Involved | WondrVoices' });
        this.meta.updateTag({
            property: 'og:description',
            content: 'Get involved and help spread hope and kindness with WondrVoices.',
        });
        this.meta.updateTag({
            property: 'og:image',
            content: '	https://www.wondrvoices.com/assets/img/spots/banner-1.png',
        });
        this.meta.updateTag({
            property: 'og:image:alt',
            content: 'WondrVoices Get Involved',
        });
        this.meta.updateTag({
            property: 'og:url',
            content: 'https://www.wondrvoices.com/get-involved',
        });
        this.meta.updateTag({
            property: 'twitter:title',
            content: 'Get Involved | WondrVoices',
        });
        this.meta.updateTag({
            property: 'twitter:description',
            content: 'Get involved and help spread hope and kindness with WondrVoices.',
        });
        this.meta.updateTag({
            property: 'twitter:image',
            content: '	https://www.wondrvoices.com/assets/img/spots/banner-1.png',
        });
        this.meta.updateTag({
            name: 'twitter:card',
            content: 'summary_large_image',
        });
    }

    public async submit(): Promise<void> {
        if (this.form.valid) {
            this.isLoading.set(true);
            this.submissionService.create({
                formType: this.formType,
                data: this.form.value
            })
                .pipe(first())
                .subscribe((res) => {
                    this.isLoading.set(false);
                    this.submitted.set(true);
                    // this.generatePdfThankYou(this.form.value).then();
                });
            console.log('[WondrGetInvolved Form Submitted]:', this.form.value);
        } else {
            this.form.markAllAsTouched();
        }
    }

    private async generatePdfThankYou(formData: any) {
        const pdfDoc = await PDFDocument.create();
        const page = pdfDoc.addPage([600, 600]);
        const { width, height } = page.getSize();

        const gradientUrl = 'assets/img/gradient-bg.png';
        const gradientBytes = await fetch(gradientUrl).then(res => res.arrayBuffer());
        const gradientImage = await pdfDoc.embedPng(gradientBytes);
        page.drawImage(gradientImage, {
            x: 0,
            y: 0,
            width,
            height
        });

        // Logo
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

        // Line in the corner of a table
        const decoUrl = 'assets/img/lines.png';
        const decoBytes = await fetch(decoUrl).then(res => res.arrayBuffer());
        const decoImage = await pdfDoc.embedPng(decoBytes);
        const decoDims = decoImage.scale(0.3);
        page.drawImage(decoImage, {
            x: width - decoDims.width - 25,
            y: height - decoDims.height - 155,
            width: decoDims.width,
            height: decoDims.height
        });

        const helvetica = await pdfDoc.embedFont(StandardFonts.Helvetica);
        const helveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

        // Title
        page.drawText('Thank You for Joining WondrVoices!', {
            x: 50,
            y: height - 130,
            size: 22,
            font: helveticaBold,
            color: rgb(0.95, 0.38, 0.16)
        });

        // Table
        const tableYStart = height - 180;
        let y = tableYStart;
        const rowHeight = 35;
        const col1Width = 150;
        const col2Width = width - col1Width - 100;

        const rows = [
            { label: 'Name', value: formData.firstName },
            { label: 'Email', value: formData.email },
            { label: 'Location', value: formData.location },
            { label: 'Social Handle', value: formData.creditTo }
        ];

        rows.forEach(row => {
            // Line's background
            page.drawRectangle({
                x: 50,
                y: y - rowHeight + 5,
                width: width - 100,
                height: rowHeight - 5,
                color: rgb(1, 0.95, 0.9),
                opacity: 0.4
            });

            // Label
            page.drawText(row.label + ':', {
                x: 60,
                y: y - 20,
                size: 14,
                font: helveticaBold,
                color: rgb(0.36, 0.22, 0.18)
            });

            // Value
            page.drawText(row.value, {
                x: 60 + col1Width,
                y: y - 20,
                size: 14,
                font: helvetica,
                color: rgb(0.2, 0.2, 0.2)
            });

            // Underline
            page.drawLine({
                start: { x: 50, y: y - rowHeight + 5 },
                end: { x: width - 50, y: y - rowHeight + 5 },
                thickness: 0.5,
                color: rgb(1, 1, 1)
            });

            y -= rowHeight;
        });

        y -= 30;
        page.drawText('Your voice helps spread hope and kindness.', {
            x: 50,
            y,
            size: 14,
            font: helvetica,
            color: rgb(0.36, 0.62, 0.24)
        });

        y -= 30;
        page.drawText('With gratitude,', {
            x: 50,
            y,
            size: 14,
            font: helvetica
        });
        y -= 20;
        page.drawText('The WondrVoices Team', {
            x: 50,
            y,
            size: 14,
            font: helvetica
        });

        const pdfBytes = await pdfDoc.save();
        const blob = new Blob([pdfBytes], { type: 'application/pdf' });
        const url = URL.createObjectURL(blob);

        const a = document.createElement('a');
        a.href = url;
        a.download = 'WondrVoices_Thank_You.pdf';
        a.click();

        URL.revokeObjectURL(url);
    }

}
