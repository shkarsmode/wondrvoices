import { Component, inject, OnInit, signal } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Title } from '@angular/platform-browser';
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';

@Component({
    selector: 'app-spots',
    standalone: true,
    imports: [ReactiveFormsModule],
    templateUrl: './spots.component.html',
    styleUrl: './spots.component.scss'
})
export class SpotsComponent implements OnInit {
    private title = inject(Title);
    private fb = inject(FormBuilder);

    public form: FormGroup;
    public submitted = signal(false);

    public fieldMap: Record<string, string> = {
        organizationName: 'Organization Name',
        address: 'Address',
        city: 'City',
        contactPerson: 'Contact Person',
        email: 'Email',
        type: 'Type of Organization'
    };

    constructor() {
        this.form = this.fb.group({
            organizationName: ['', Validators.required],
            address: ['', Validators.required],
            city: ['', Validators.required],
            contactPerson: ['', Validators.required],
            email: ['', [Validators.required, Validators.email]],
            type: ['', Validators.required],
            consent: [false, Validators.requiredTrue]
        });
    }

    public ngOnInit(): void {
        this.title.setTitle('Become a WondrSpot | WondrVoices');
    }

    public async submit(): Promise<void> {
        if (this.form.valid) {
            this.submitted.set(true);
            console.log('[WondrSpot Form Submitted]:', this.form.value);
            await this.generatePdfThankYou(this.form.value);
        } else {
            this.form.markAllAsTouched();
        }
    }

    private async generatePdfThankYou(formData: any) {
        const pdfDoc = await PDFDocument.create();
        const page = pdfDoc.addPage([600, 700]);
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

        let y = height - 180;
        const rowHeight = 35;
        const col1Width = 180;

        const rows = [
            { label: 'Organization Name', value: formData.organizationName },
            { label: 'Address', value: formData.address },
            { label: 'City', value: formData.city },
            { label: 'Contact Person', value: formData.contactPerson },
            { label: 'Email', value: formData.email },
            { label: 'Type of Org', value: formData.type }
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
        a.download = 'WondrSpot_Thank_You.pdf';
        a.click();

        URL.revokeObjectURL(url);
    }
}
