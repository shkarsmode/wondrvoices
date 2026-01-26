import { CommonModule, NgFor, NgIf } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, ElementRef, QueryList, signal, ViewChildren } from '@angular/core';
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
    totalSteps = 6;
    isSubmitting = signal(false);
    requestId = signal<string>('');
    verificationCode = signal<string>('');
    demoVerificationCode = signal<string>(''); // For demo mode

    // Forms
    step1Form: FormGroup;
    step2Form: FormGroup;
    step3Form: FormGroup;
    step4Form: FormGroup;
    
    @ViewChildren('codeInput') codeInputs!: QueryList<ElementRef<HTMLInputElement>>;

    // Progress calculation
    progress = computed(() => (this.currentStep() / this.totalSteps) * 100);
    timeRemaining = computed(() => {
        const times = [3, 2, 1, 1, 0, 0];
        return times[this.currentStep() - 1];
    });

    // Step 1: Journey type options
    journeyTypes = [
        { id: 'me', label: 'Me' },
        { id: 'child', label: 'My Child' },
        { id: 'loved-one', label: 'A Loved One' }
    ];
    selectedJourneyType = signal<string>('');

    // Step 1: Condition options
    conditionOptions = [
        'Cancer',
        'Rare Disease',
        'End-of-Life Care',
        'Grief & Loss',
        'Other Serious Illness'
    ];
    selectedCondition = signal<string>('');

    // Step 2: Journey stage options
    journeyStageOptions = [
        { label: 'Just diagnosed', value: 'just-diagnosed' },
        { label: 'Starting treatment', value: 'starting-treatment' },
        { label: 'In the middle of treatment', value: 'in-treatment' },
        { label: 'Scan day / Waiting for results', value: 'waiting-results' },
        { label: 'Got difficult news', value: 'difficult-news' },
        { label: 'Celebrating a milestone', value: 'celebration' },
        { label: 'In the hospital', value: 'in-hospital' },
        { label: 'Recovery at home', value: 'recovery' },
        { label: 'Long-term survivorship', value: 'survivorship' },
        { label: 'Other', value: 'other' }
    ];
    selectedJourneyStage = signal<string>('');

    // Step 2: Additional context
    additionalContextOptions = [
        'Young Adult (18-39)',
        'Parent with Kids at Home',
        'Cancer Returned'
    ];
    selectedContextTags = signal<string[]>([]);

    // Step 3: Comfort zones
    comfortZones = [
        { id: 'encouragement', label: 'Words of Encouragement', icon: 'schedule' },
        { id: 'prayers', label: 'Prayers & Blessings', icon: 'favorite' },
        { id: 'hope', label: 'Stories of Hope', icon: 'auto_awesome' },
        { id: 'poems', label: 'Poems & Quotes', icon: 'edit_note' },
        { id: 'nature', label: 'Nature & Animals', icon: 'nature' },
        { id: 'mindfulness', label: 'Mindfulness & Calm', icon: 'psychology' },
        { id: 'art', label: 'Art & Drawings', icon: 'palette' },
        { id: 'humor', label: 'Jokes & Humor', icon: 'sentiment_very_satisfied' },
        { id: 'other', label: 'Other', icon: 'forum' }
    ];
    selectedComfortZones = signal<string[]>([]);

    constructor(
        private fb: FormBuilder,
        private requestsService: RequestsService,
        private router: Router
    ) {
        this.step1Form = this.fb.group({
            journeyType: ['', Validators.required],
            condition: ['', Validators.required]
        });

        this.step2Form = this.fb.group({
            journeyStage: ['', Validators.required],
            contextTags: [[]]
        });

        this.step3Form = this.fb.group({
            comfortZones: [[], Validators.required],
            additionalNote: ['']
        });

        this.step4Form = this.fb.group({
            firstName: [''],
            email: ['', [Validators.required, Validators.email]],
            age: ['', [Validators.required, Validators.min(1), Validators.max(120)]],
            gender: [''],
            location: ['', Validators.required]
        });
    }

    nextStep(): void {
        if (this.currentStep() === 1) {
            if (!this.selectedJourneyType() || !this.selectedCondition()) {
                alert('Please select all required options');
                return;
            }
        } else if (this.currentStep() === 2) {
            if (!this.selectedJourneyStage()) {
                alert('Please select your current journey stage');
                return;
            }
        } else if (this.currentStep() === 3) {
            if (this.selectedComfortZones().length === 0) {
                alert('Please select at least one comfort zone');
                return;
            }
        } else if (this.currentStep() === 4) {
            if (this.step4Form.invalid) {
                this.step4Form.markAllAsTouched();
                return;
            }
            this.submitRequest();
            return;
        } else if (this.currentStep() === 5) {
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

    selectJourneyType(type: string): void {
        this.selectedJourneyType.set(type);
    }

    selectCondition(condition: string): void {
        this.selectedCondition.set(condition);
    }

    selectJourneyStage(stage: string): void {
        this.selectedJourneyStage.set(stage);
    }

    toggleContextTag(tag: string): void {
        const tags = this.selectedContextTags();
        if (tags.includes(tag)) {
            this.selectedContextTags.set(tags.filter(t => t !== tag));
        } else {
            this.selectedContextTags.set([...tags, tag]);
        }
    }

    isContextTagSelected(tag: string): boolean {
        return this.selectedContextTags().includes(tag);
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

    onCodeInput(index: number, event: any): void {
        const input = event.target as HTMLInputElement;
        let value = input.value;

        // Оставляем только цифры
        value = value.replace(/\D/g, '');

        // Если больше одной цифры, берем только последнюю
        if (value.length > 1) {
            value = value[value.length - 1];
        }

        input.value = value;

        // Обновляем код
        const currentCode = this.verificationCode();
        const codeArray = currentCode.split('');
        codeArray[index] = value;
        this.verificationCode.set(codeArray.join(''));

        // Переходим на следующее поле
        if (value && index < 5) {
            const nextInput = this.codeInputs.toArray()[index + 1];
            if (nextInput) {
                setTimeout(() => nextInput.nativeElement.focus(), 0);
            }
        }
    }

    onCodeKeyDown(index: number, event: KeyboardEvent): void {
        const input = event.target as HTMLInputElement;
        const key = event.key;

        if (key === 'Backspace') {
            event.preventDefault();
            
            // Очищаем текущий инпут
            input.value = '';
            const currentCode = this.verificationCode();
            const codeArray = currentCode.split('');
            codeArray[index] = '';
            this.verificationCode.set(codeArray.join(''));

            // Если поле пусто, переходим на предыдущее
            if (!input.value && index > 0) {
                const prevInput = this.codeInputs.toArray()[index - 1];
                if (prevInput) {
                    setTimeout(() => prevInput.nativeElement.focus(), 0);
                }
            }
        } else if (key === 'ArrowLeft' && index > 0) {
            event.preventDefault();
            const prevInput = this.codeInputs.toArray()[index - 1];
            if (prevInput) {
                prevInput.nativeElement.focus();
            }
        } else if (key === 'ArrowRight' && index < 5) {
            event.preventDefault();
            const nextInput = this.codeInputs.toArray()[index + 1];
            if (nextInput) {
                nextInput.nativeElement.focus();
            }
        }
    }

    onCodePaste(event: ClipboardEvent): void {
        event.preventDefault();
        const pastedText = event.clipboardData?.getData('text') || '';
        const digits = pastedText.replace(/\D/g, '').slice(0, 6);

        if (digits.length > 0) {
            this.verificationCode.set(digits.padEnd(6, ''));

            // Заполняем инпуты
            this.codeInputs.forEach((input, index) => {
                input.nativeElement.value = digits[index] || '';
            });

            // Фокусируемся на последний заполненный или на 6-й инпут
            const focusIndex = Math.min(digits.length, 5);
            const focusInput = this.codeInputs.toArray()[focusIndex];
            if (focusInput) {
                setTimeout(() => focusInput.nativeElement.focus(), 0);
            }
        }
    }

    submitRequest(): void {
        this.isSubmitting.set(true);

        const requestData: CreateSupportRequestDto = {
            firstName: this.step4Form.value.firstName || undefined,
            age: this.step4Form.value.age,
            gender: this.step4Form.value.gender || undefined,
            location: this.step4Form.value.location,
            journeyType: this.selectedJourneyType(),
            condition: this.selectedCondition(),
            journeyStage: this.selectedJourneyStage(),
            contextTags: this.selectedContextTags(),
            email: this.step4Form.value.email,
            comfortZones: this.selectedComfortZones(),
            additionalNote: this.step3Form.value.additionalNote || undefined
        };

        this.requestsService.createRequest(requestData).subscribe({
            next: (response) => {
                this.requestId.set(response.requestId);
                // Send verification code
                this.requestsService.sendVerificationCode(this.step4Form.value.email).subscribe({
                    next: (codeResponse) => {
                        if (codeResponse.code) {
                            this.demoVerificationCode.set(codeResponse.code);
                        }
                        this.isSubmitting.set(false);
                        this.currentStep.set(5);
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

    resendCode(): void {
        const email = this.step4Form.value.email;
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
        const code = this.verificationCode();
        if (code.length !== 6) {
            alert('Please enter the complete 6-digit code');
            return;
        }

        this.isSubmitting.set(true);
        this.requestsService.verifyEmail({
            email: this.step4Form.value.email,
            code: code
        }).subscribe({
            next: () => {
                this.isSubmitting.set(false);
                this.currentStep.set(6);
            },
            error: () => {
                this.isSubmitting.set(false);
                alert('Invalid verification code');
            }
        });
    }

    viewFeed(): void {
        this.router.navigate(['/browse-requests']);
    }

    backToHome(): void {
        this.router.navigate(['/']);
    }
}
