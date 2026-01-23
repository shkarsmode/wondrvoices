import { CommonModule, NgFor, NgIf } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, signal } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { RequestsService } from '../../../../shared/services/requests.service';
import { CreateSupportRequestDto } from '../../../../shared/types/request-support.types';

@Component({
    selector: 'app-request-support',
    standalone: true,
    imports: [CommonModule, NgIf, NgFor, ReactiveFormsModule],
    templateUrl: './request-support.component.html',
    styleUrl: './request-support.component.scss',
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class RequestSupportComponent {
    currentStep = signal(1);
    totalSteps = 4;
    isSubmitting = signal(false);
    requestId = signal<string>('');
    verificationCode = signal<string>('');
    demoVerificationCode = signal<string>(''); // For demo mode

    // Forms
    step1Form: FormGroup;
    step2Form: FormGroup;
    verificationCodeInput = signal(['', '', '', '', '', '']);

    // Progress calculation
    progress = computed(() => (this.currentStep() / this.totalSteps) * 100);
    timeRemaining = computed(() => {
        const times = [3, 2, 1, 0];
        return times[this.currentStep() - 1];
    });

    // Step 2 comfort zones
    comfortZones = [
        { id: 'encouragement', label: 'Words of Encouragement', icon: 'thumb_up' },
        { id: 'prayers', label: 'Prayers & Blessings', icon: 'volunteer_activism' },
        { id: 'hope', label: 'Stories of Hope', icon: 'auto_awesome' },
        { id: 'poems', label: 'Poems & Quotes', icon: 'edit_note' },
        { id: 'nature', label: 'Nature & Animals', icon: 'park' },
        { id: 'mindfulness', label: 'Mindfulness & Calm', icon: 'self_improvement' },
        { id: 'art', label: 'Art & Drawings', icon: 'palette' },
        { id: 'humor', label: 'Jokes & Humor', icon: 'sentiment_satisfied' },
        { id: 'other', label: 'Other', icon: 'forum' }
    ];

    selectedComfortZones = signal<string[]>([]);

    // Diagnosis options
    diagnosisOptions = [
        'Cancer Treatment',
        'Leukemia Treatment',
        'Lymphoma Treatment',
        'Pediatric Brain Tumor',
        'Rare Autoimmune Disease',
        'Chronic Illness',
        'Other Serious Illness'
    ];

    // Journey stage options
    journeyStageOptions = [
        'Just Diagnosed',
        'Active Treatment',
        'Post-Treatment Recovery',
        'Long-term Care',
        'Remission',
        'Other'
    ];

    constructor(
        private fb: FormBuilder,
        private requestsService: RequestsService,
        private router: Router
    ) {
        this.step1Form = this.fb.group({
            privacyChoice: ['share', Validators.required],
            firstName: [''],
            email: ['', [Validators.required, Validators.email]],
            age: ['', [Validators.required, Validators.min(1), Validators.max(120)]],
            gender: [''],
            location: ['', Validators.required],
            diagnosis: ['', Validators.required],
            journeyStage: ['', Validators.required],
            hospital: ['']
        });

        this.step2Form = this.fb.group({
            additionalNote: ['']
        });

        // Watch privacy choice to toggle firstName required
        this.step1Form.get('privacyChoice')?.valueChanges.subscribe(value => {
            const firstNameControl = this.step1Form.get('firstName');
            if (value === 'share') {
                firstNameControl?.setValidators([Validators.required]);
            } else {
                firstNameControl?.clearValidators();
            }
            firstNameControl?.updateValueAndValidity();
        });
    }

    nextStep(): void {
        if (this.currentStep() === 1) {
            if (this.step1Form.invalid) {
                this.step1Form.markAllAsTouched();
                return;
            }
        } else if (this.currentStep() === 2) {
            if (this.selectedComfortZones().length === 0) {
                alert('Please select at least one comfort zone');
                return;
            }
            this.submitRequest();
            return;
        } else if (this.currentStep() === 3) {
            this.verifyEmailCode();
            return;
        }
        
        this.currentStep.update(step => step + 1);
    }

    previousStep(): void {
        if (this.currentStep() > 1) {
            this.currentStep.update(step => step - 1);
        }
    }

    toggleComfortZone(zoneId: string): void {
        const zones = this.selectedComfortZones();
        if (zones.includes(zoneId)) {
            this.selectedComfortZones.set(zones.filter(z => z !== zoneId));
        } else {
            this.selectedComfortZones.set([...zones, zoneId]);
        }
    }

    isZoneSelected(zoneId: string): boolean {
        return this.selectedComfortZones().includes(zoneId);
    }

    submitRequest(): void {
        this.isSubmitting.set(true);

        const formData = this.step1Form.value;
        const requestData: CreateSupportRequestDto = {
            firstName: formData.privacyChoice === 'share' ? formData.firstName : undefined,
            age: formData.age,
            gender: formData.gender || undefined,
            location: formData.location,
            diagnosis: formData.diagnosis,
            journeyStage: formData.journeyStage,
            hospital: formData.hospital || undefined,
            isAnonymous: formData.privacyChoice === 'anonymous',
            email: formData.email,
            comfortZones: this.selectedComfortZones(),
            additionalNote: this.step2Form.value.additionalNote || undefined
        };

        this.requestsService.createRequest(requestData).subscribe({
            next: (response) => {
                this.requestId.set(response.requestId);
                // Send verification code
                this.requestsService.sendVerificationCode(formData.email).subscribe({
                    next: (codeResponse) => {
                        if (codeResponse.code) {
                            this.demoVerificationCode.set(codeResponse.code);
                        }
                        this.isSubmitting.set(false);
                        this.currentStep.set(3);
                    },
                    error: () => {
                        this.isSubmitting.set(false);
                        alert('Failed to send verification code');
                    }
                });
            },
            error: () => {
                this.isSubmitting.set(false);
                alert('Failed to submit request');
            }
        });
    }

    onCodeInput(index: number, event: any): void {
        const value = event.target.value;
        const codes = this.verificationCodeInput();
        
        if (value.length === 1 && /^\d$/.test(value)) {
            codes[index] = value;
            this.verificationCodeInput.set([...codes]);
            
            // Move to next input
            if (index < 5) {
                const nextInput = event.target.parentElement.children[index + 1] as HTMLInputElement;
                nextInput?.focus();
            }
        } else if (value.length === 0) {
            codes[index] = '';
            this.verificationCodeInput.set([...codes]);
        }
    }

    onCodeKeyDown(index: number, event: KeyboardEvent): void {
        if (event.key === 'Backspace' && !this.verificationCodeInput()[index] && index > 0) {
            const prevInput = (event.target as HTMLElement).parentElement?.children[index - 1] as HTMLInputElement;
            prevInput?.focus();
        }
    }

    resendCode(): void {
        const email = this.step1Form.value.email;
        this.requestsService.sendVerificationCode(email).subscribe({
            next: (codeResponse) => {
                if (codeResponse.code) {
                    this.demoVerificationCode.set(codeResponse.code);
                }
                alert('Verification code resent!');
            },
            error: () => {
                alert('Failed to resend code');
            }
        });
    }

    verifyEmailCode(): void {
        const code = this.verificationCodeInput().join('');
        if (code.length !== 6) {
            alert('Please enter the complete 6-digit code');
            return;
        }

        this.isSubmitting.set(true);
        this.requestsService.verifyEmail({
            email: this.step1Form.value.email,
            code: code
        }).subscribe({
            next: () => {
                this.isSubmitting.set(false);
                this.currentStep.set(4);
            },
            error: () => {
                this.isSubmitting.set(false);
                alert('Invalid verification code');
            }
        });
    }

    viewGallery(): void {
        this.router.navigate(['/browse-requests']);
    }

    backToHome(): void {
        this.router.navigate(['/']);
    }
}
