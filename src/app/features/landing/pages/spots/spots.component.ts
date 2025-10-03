import { NgIf } from '@angular/common';
import { Component, inject, OnDestroy, OnInit, signal } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Meta, Title } from '@angular/platform-browser';
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
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
        // this.submissionService
        //     .create({
        //         formType: this.formType,
        //         data: {
        //             organizationName: this.form.value.organizationName,
        //             contactPerson: this.form.value.contactPerson,
        //             email: this.form.value.email,
        //             city: this.form.value.city,
        //             ...(logoUrl ? { logoUrl } : {})
        //         }
        //     })
        //     .pipe(first())
        //     .subscribe(async () => {
                this.submitted.set(true);
                this.isLoading.set(false);

                const LOGO_SLOT = {
                    x: 38,
                    y: 780,
                    maxW: 300,
                    maxH: 125,
                    pad: 8, 
                    drawBadge: false,
                    badgeOpacity: 0.92,
                };

                const TEMPLATE_URL = 'assets/pdf/cards-of-hope-template.pdf';
                const pdfUrl = await this.generatePdfFromTemplate({
                    templateUrl: TEMPLATE_URL,
                    partnerLogoFile: this.uploadedLogoFile,
                    partnerLogoUrl: logoUrl,
                    slot: LOGO_SLOT,
                    fallbackText: this.form.value.organizationName || 'Your Organization',
                });
                this.pdfUrl.set(pdfUrl);
            // }, () => {
            //     this.isLoading.set(false);
            // });
    }

    private async generatePdfFromTemplate(opts: {
        templateUrl: string; 
        partnerLogoFile?: File | null;
        partnerLogoUrl?: string;
        slot: { 
            x: number;
            y: number;
            maxW: number;
            maxH: number;
            pad?: number;
            drawBadge?: boolean;
            badgeOpacity?: number;
        };
        fallbackText?: string;
    }): Promise<string> {
        const pdfBytes = await fetch(opts.templateUrl).then(r => r.arrayBuffer());
        const pdfDoc = await PDFDocument.load(pdfBytes);
        const page = pdfDoc.getPage(0);

        // page.getSize() пригодится, если захочешь привязать слот в процентах
        // const { width: PAGE_W, height: PAGE_H } = page.getSize();

        // ---- подготовим картинку лого ----
        let img: any | null = null;
        if (opts.partnerLogoFile) {
            const bytes = await opts.partnerLogoFile.arrayBuffer();
            img = /png/i.test(opts.partnerLogoFile.type) ? await pdfDoc.embedPng(bytes) : await pdfDoc.embedJpg(bytes);
        } else if (opts.partnerLogoUrl) {
            const bytes = await fetch(opts.partnerLogoUrl).then(r => r.arrayBuffer());
            const ext = opts.partnerLogoUrl.split('.').pop()?.toLowerCase();
            if (ext === 'png') img = await pdfDoc.embedPng(bytes);
            if (ext === 'jpg' || ext === 'jpeg') img = await pdfDoc.embedJpg(bytes);
        }

        const pad = opts.slot.pad ?? 6;
        const maxW = opts.slot.maxW - pad * 2;
        const maxH = opts.slot.maxH - pad * 2;

        // Необязательный белый «бейдж» под логотип (с небольшой прозрачностью)
        if (opts.slot.drawBadge) {
            page.drawRectangle({
                x: opts.slot.x,
                y: opts.slot.y - opts.slot.maxH,
                width: opts.slot.maxW,
                height: opts.slot.maxH,
                color: rgb(1, 1, 1),
                opacity: opts.slot.badgeOpacity ?? 0.9,
            });
        }

        if (img) {
            // Сохраняем пропорции лого и вписываем в слот
            const s = Math.min(maxW / img.width, maxH / img.height, 1); // не масштабируем вверх
            const w = img.width * s;
            const h = img.height * s;

            const x = opts.slot.x + (opts.slot.maxW - w) / 2; // по центру слота
            const y = opts.slot.y - pad - h;                   // из верхней границы вниз

            page.drawImage(img, { x, y, width: w, height: h });
        } else if (opts.fallbackText) {
            const font = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
            const size = 25;
            const textW = font.widthOfTextAtSize(opts.fallbackText, size);
            const tx = opts.slot.x + (opts.slot.maxW - textW) / 2;
            const ty = opts.slot.y - opts.slot.maxH / 2 - size / 2;
            page.drawText(opts.fallbackText, { x: tx, y: ty, size, font, color: rgb(0.1, 0.1, 0.1) });
        }

        const out = await pdfDoc.save();
        // @ts-ignore
        const blob = new Blob([out], { type: 'application/pdf' });
        return URL.createObjectURL(blob);
    }
    
    

    private updateMetaTags(): void {
        this.title.setTitle('Become a WondrSpot | WondrVoices');
        this.meta.updateTag({ name: 'description', content: 'Become a WondrSpot and help spread hope and kindness.' });
        this.meta.updateTag({ property: 'og:title', content: 'Become a WondrSpot | WondrVoices' });
        this.meta.updateTag({ property: 'og:description', content: 'Become a WondrSpot and help spread hope and kindness.' });
        this.meta.updateTag({ property: 'og:image', content: 'https://www.wondrvoices.com/assets/img/spots/banner-1.webp' });
        this.meta.updateTag({ property: 'og:image:alt', content: 'WondrSpots' });
        this.meta.updateTag({ property: 'og:url', content: 'https://www.wondrvoices.com/spots' });
        this.meta.updateTag({ property: 'twitter:title', content: 'Become a WondrSpot | WondrVoices' });
        this.meta.updateTag({ property: 'twitter:description', content: 'Become a WondrSpot and help spread hope and kindness.' });
        this.meta.updateTag({ property: 'twitter:image', content: 'https://www.wondrvoices.com/assets/img/spots/banner-1.webp' });
        this.meta.updateTag({ name: 'twitter:card', content: 'summary_large_image' });
    }
}
