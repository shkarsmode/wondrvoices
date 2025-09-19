import { NgIf } from '@angular/common';
import { Component, inject, OnDestroy, OnInit, signal } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Meta, Title } from '@angular/platform-browser';
import { degrees, PDFDocument, rgb, StandardFonts } from 'pdf-lib';
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

                const pdfUrl = await this.generatePdfWelcomeSign({
                    partnerName: this.form.value.organizationName,
                    // optional, will be used if user uploaded a logo:
                    partnerLogoFile: this.uploadedLogoFile ?? null,
                
                    // assets from your /assets (adjust paths as needed)
                    sampleCardImageUrl: 'assets/img/about/5.webp',
                    qrImageUrl: 'assets/img/qr.webp', // QR код внизу слева
                
                    // text content (you can translate later)
                    headline: 'Spread kindness with us!',
                    introParagraph:
                        'Grab a blank card or paper and create a message of hope for someone facing cancer or serious illness.',
                    bullets: [
                        {
                            title: 'You Create',
                            text:
                                'Draw or write something hopeful, inspirational or just to tell someone they are not alone. Upload it on wondrvoices website or app.'
                        },
                        {
                            title: 'We Share',
                            text:
                                'Your creation will help us create a gallery of hope, for patients facing cancer.'
                        }
                    ],
                    subheading1: 'Your words or art can make a difference.',
                    partnerBlurb:
                        'is proud to partner with WondrVoices to be a hub of hope. Use this space to write a message that will brighten a day for someone in a hospital or care facility. Your support shows you care. Your words or art can make a difference.',
                    shareTitle: 'Share your kindness!',
                    shareText:
                        'Scan the QR code to learn how to upload your creation and share it with Wondrvoices and your friends on social media.',
                    socialHandle: '@wondrvoices',
                    siteUrlText: 'https://wondrvoices.com'
                });
                this.pdfUrl.set(pdfUrl);
            }, () => {
                this.isLoading.set(false);
            });
    }

    private async generatePdfWelcomeSign(cfg: {
        partnerName: string;
        partnerLogoFile: File | null;
        sampleCardImageUrl: string;
        wondrVoicesWordmarkUrl?: string;
        qrImageUrl: string;
    
        headline: string;
        introParagraph: string;
        bullets: Array<{ title: string; text: string }>;
        subheading1: string;
        partnerBlurb: string;
        shareTitle: string;
        shareText: string;
        socialHandle: string;
        siteUrlText: string;
    }): Promise<string> {
        // ===== Canvas & layout =====
        const PAGE_W = 595; // A4 portrait
        const PAGE_H = 842;
        const MARGIN = 40;
    
        const LEFT_COL_W = Math.floor(PAGE_W * 0.55) - MARGIN;   // ~55%
        const RIGHT_COL_W = Math.floor(PAGE_W * 0.45) - MARGIN;  // ~45%
        const LEFT_X = MARGIN;
        const RIGHT_X = PAGE_W - MARGIN - RIGHT_COL_W;
    
        const pdfDoc = await PDFDocument.create();
        const page = pdfDoc.addPage([PAGE_W, PAGE_H]);
    
        const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica);
        const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
        const fontItalic = await pdfDoc.embedFont(StandardFonts.HelveticaOblique);
    
        // ===== Helpers =====
        const drawTextWrapped = (
            text: string,
            x: number,
            y: number,
            maxWidth: number,
            font: any,
            size: number,
            color = rgb(0, 0, 0),
            lineHeight = 1.3
        ) => {
            const words = text.split(/\s+/);
            const lines: string[] = [];
            let current = '';
            for (const w of words) {
                const test = current ? `${current} ${w}` : w;
                const width = font.widthOfTextAtSize(test, size);
                if (width > maxWidth && current) {
                    lines.push(current);
                    current = w;
                } else {
                    current = test;
                }
            }
            if (current) lines.push(current);
    
            let yy = y;
            for (const line of lines) {
                page.drawText(line, { x, y: yy, size, font, color });
                yy -= size * lineHeight;
            }
            return yy;
        };
    
        const drawBulletList = (
            items: Array<{ title: string; text: string }>,
            x: number,
            y: number,
            maxWidth: number
        ) => {
            let cursorY = y;
            const dotRadius = 2.2;
            const dotOffset = 8;       // distance from left x to bullet dot center
            const gapAfterDot = 12;    // spacing between dot and text start
            const blockSpacing = 14;
    
            for (const item of items) {
                // bullet dot aligned to first line baseline
                page.drawCircle({
                    x: x + dotOffset,
                    y: cursorY - 6.5 + 10,
                    size: dotRadius,
                    color: rgb(0.18, 0.18, 0.18)
                });
    
                const titleText = `${item.title}: `;
                const titleSize = 12.5;
                const bodySize = 12.5;
    
                // title (bold)
                const titleWidth = fontBold.widthOfTextAtSize(titleText, titleSize);
                page.drawText(titleText, {
                    x: x + dotOffset + gapAfterDot,
                    y: cursorY,
                    size: titleSize,
                    font: fontBold,
                    color: rgb(0.1, 0.1, 0.1)
                });
    
                // body (wrap) continuing same line
                const textStartX = x + dotOffset + gapAfterDot + titleWidth;
                const textMaxWidth = maxWidth - (textStartX - x);
                cursorY = drawTextWrapped(
                    item.text,
                    textStartX,
                    cursorY,
                    textMaxWidth + 250,
                    fontRegular,
                    bodySize,
                    rgb(0.1, 0.1, 0.1)
                );
                cursorY -= blockSpacing;
            }
            return cursorY;
        };
    
        const embedImageFromUrl = async (url: string) => {
            const bytes = await fetch(url).then(r => r.arrayBuffer());
            const ext = url.split('.').pop()?.toLowerCase();
            if (ext === 'png') return await pdfDoc.embedPng(bytes);
            if (ext === 'jpg' || ext === 'jpeg') return await pdfDoc.embedJpg(bytes);
            throw new Error(`Unsupported image format for PDF: ${ext}`);
        };
    
        const embedImageFromFile = async (file: File) => {
            const bytes = await file.arrayBuffer();
            if (/image\/png/i.test(file.type)) return await pdfDoc.embedPng(bytes);
            if (/image\/jpeg/i.test(file.type)) return await pdfDoc.embedJpg(bytes);
            throw new Error(`Unsupported image type: ${file.type}`);
        };

        const drawParagraphWithItalicLead = ({
            lead,
            rest,
            x,
            y,
            maxWidth,
            size,
            color = rgb(0, 0, 0),
            lineHeight = 1.3,
            fonts
        }: {
            lead: string;                  // e.g. cfg.partnerName
            rest: string;                  // e.g. "is proud to partner with ..."
            x: number;
            y: number;
            maxWidth: number;
            size: number;
            color?: any;
            lineHeight?: number;
            fonts: { italic: any; regular: any };
        }) => {
            // Measure italic lead once
            const leadWithSpace = lead.trimEnd() + ' ';
            const leadWidth = fonts.italic.widthOfTextAtSize(leadWithSpace, size);
        
            // First line: fill remaining width after the italic word
            const words = rest.split(/\s+/);
            let firstLine = '';
            for (let i = 0; i < words.length; i++) {
                const test = firstLine ? `${firstLine} ${words[i]}` : words[i];
                const w = fonts.regular.widthOfTextAtSize(test, size);
                if (w > (maxWidth - leadWidth) && firstLine) {
                    // stop before overflow
                    // draw first line: italic lead + regular remainder
                    page.drawText(leadWithSpace, { x, y, size, font: fonts.italic, color });
                    page.drawText(firstLine, { x: x + leadWidth, y, size, font: fonts.regular, color });
        
                    // Draw remaining wrapped lines from left edge
                    let yy = y - size * lineHeight;
                    let line = '';
                    for (let j = i; j < words.length; j++) {
                        const t = line ? `${line} ${words[j]}` : words[j];
                        const tw = fonts.regular.widthOfTextAtSize(t, size);
                        if (tw > maxWidth && line) {
                            page.drawText(line, { x, y: yy, size, font: fonts.regular, color });
                            yy -= size * lineHeight;
                            line = words[j];
                        } else {
                            line = t;
                        }
                    }
                    if (line) {
                        page.drawText(line, { x, y: yy, size, font: fonts.regular, color });
                        yy -= size * lineHeight;
                    }
                    return yy; // next Y
                } else {
                    firstLine = test;
                }
            }
        
            // If all text fits into the first line
            page.drawText(leadWithSpace, { x, y, size, font: fonts.italic, color });
            page.drawText(firstLine, { x: x + leadWidth, y, size, font: fonts.regular, color });
            return y - size * lineHeight;
        };
    
        const drawPartnerHeader = async (x: number, y: number) => {
            // Left anchor for logo
            const logoX = x; // do NOT shift; we’ll compute headline centering properly
            const headlineSize = 22;
            const gapBetweenLogoAndHeadline = 16;
        
            let logoWidth = 0;
            let logoHeight = 0;
        
            // Draw partner logo (or fallback text) and measure its box
            if (cfg.partnerLogoFile) {
                const img = await embedImageFromFile(cfg.partnerLogoFile);
                const maxW = 120;
                const maxH = 60;
                const scale = Math.min(maxW / img.width, maxH / img.height);
                const w = img.width * scale;
                const h = img.height * scale;
        
                page.drawImage(img, { x: logoX, y: y - h, width: w, height: h });
                logoWidth = w;
                logoHeight = h;
            } else {
                const fallbackSize = 18;
                page.drawText(cfg.partnerName, {
                    x: logoX,
                    y: y - fallbackSize,
                    size: fallbackSize,
                    font: fontBold,
                    color: rgb(0.12, 0.12, 0.12)
                });
                logoWidth = fontBold.widthOfTextAtSize(cfg.partnerName, fallbackSize);
                logoHeight = fallbackSize + 6; // small fudge so baseline sits a bit lower
            }
        
            // Compute centered X for the headline
            const headlineWidth = fontBold.widthOfTextAtSize(cfg.headline, headlineSize);
            let headlineX = (PAGE_W - headlineWidth) / 2;
        
            // Prevent overlap with the logo area on the left
            const minHeadlineX = logoX + logoWidth + gapBetweenLogoAndHeadline;
            if (headlineX < minHeadlineX) {
                headlineX = minHeadlineX;
            }
        
            // Align headline baseline roughly to the vertical middle of the logo block
            const baselineY = y - (logoHeight / 2) + (headlineSize * 0.30);
        
            // Draw headline (orange)
            page.drawText(cfg.headline, {
                x: headlineX,
                y: baselineY,
                size: headlineSize,
                font: fontBold,
                color: rgb(0.98, 0.47, 0.16)
            });
        };
    
        // ===== Background =====
        page.drawRectangle({ x: 0, y: 0, width: PAGE_W, height: PAGE_H, color: rgb(1, 1, 1) });
    
        // ===== Header =====
        await drawPartnerHeader(LEFT_X, PAGE_H - MARGIN);
    
        // ===== Left column content =====
        let leftY = PAGE_H - MARGIN - 150;
    
        leftY = drawTextWrapped(
            cfg.introParagraph,
            LEFT_X,
            leftY,
            PAGE_W - LEFT_X - MARGIN,
            fontRegular,
            12.5,
            rgb(0.1, 0.1, 0.1)
        );
        leftY -= 10;
    
        leftY = drawBulletList(cfg.bullets, LEFT_X, leftY, LEFT_COL_W);
        leftY -= 15;
    
        page.drawText(cfg.subheading1, {
            x: LEFT_X,
            y: leftY,
            size: 12.5,
            font: fontBold,
            color: rgb(0.1, 0.1, 0.1)
        });
        leftY -= 20;
    
        // partner name in italic + rest as normal (single paragraph look)
        const italicName = `${cfg.partnerName} `;
        leftY = drawParagraphWithItalicLead({
            lead: cfg.partnerName,
            rest: cfg.partnerBlurb,
            x: LEFT_X,
            y: leftY,    
            maxWidth: LEFT_COL_W,
            size: 12,
            color: rgb(0.1, 0.1, 0.1),
            lineHeight: 1.3,
            fonts: { italic: fontItalic, regular: fontRegular }
        });
    
        // ===== Right column image (tilted card) =====
        {
            const img = await embedImageFromUrl(cfg.sampleCardImageUrl);
            const maxW = Math.min(RIGHT_COL_W, 240);
            const maxH = 300;
            const s = Math.min(maxW / img.width, maxH / img.height);
            const w = img.width * s, h = img.height * s;
    
            const topY = PAGE_H - MARGIN - 220; // a bit below header
            const x = RIGHT_X + (RIGHT_COL_W - w) / 2 + 10;
            const y = topY - h - 20;
    
            page.drawImage(img, {
                x,
                y,
                width: w,
                height: h,
                rotate: degrees(-8)
            });
    
            // subtle shadow
            page.drawRectangle({
                x: x + 10,
                y: y - 6,
                width: w,
                height: 10,
                color: rgb(0, 0, 0),
                opacity: 0.08
            });
        }
    
        // ===== Footer: left (QR + socials) =====
        {
            const qr = await embedImageFromUrl(cfg.qrImageUrl);
            const qrSize = 84;
            const qx = LEFT_X;
            const qy = MARGIN + 36;
    
            page.drawImage(qr, { x: qx, y: qy, width: qrSize, height: qrSize });
    
            page.drawText('Connect and Share with us', {
                x: qx + qrSize + 12,
                y: qy + qrSize - 4,
                size: 10.5,
                font: fontRegular,
                color: rgb(0.15, 0.15, 0.15)
            });
    
            page.drawText(cfg.siteUrlText, {
                x: qx + qrSize + 12,
                y: qy + qrSize - 22,
                size: 12.5,
                font: fontBold,
                color: rgb(0.15, 0.15, 0.15)
            });
    
            // simple social placeholders row
            const socialsY = qy + 18;
            page.drawText(`${cfg.socialHandle}`, {
                x: qx + qrSize + 12,
                y: socialsY,
                size: 11.5,
                font: fontRegular,
                color: rgb(0.15, 0.15, 0.15)
            });
        }
    
        // ===== Footer: right (share block) =====
        {
            const boxX = RIGHT_X;
            const boxW = RIGHT_COL_W;
            const baseY = MARGIN + 36;
    
            page.drawText(cfg.shareTitle, {
                x: boxX,
                y: baseY + 70,
                size: 12.5,
                font: fontBold,
                color: rgb(0.1, 0.1, 0.1)
            });
    
            drawTextWrapped(
                cfg.shareText,
                boxX,
                baseY + 50,
                boxW,
                fontRegular,
                12,
                rgb(0.1, 0.1, 0.1)
            );
        }
    
        // ===== Save =====
        const pdfBytes = await pdfDoc.save();
        const blob = new Blob([pdfBytes], { type: 'application/pdf' });
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
