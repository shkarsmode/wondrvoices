import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { catchError, debounceTime, distinctUntilChanged, filter, first, map, of, Subscription, switchMap, tap } from 'rxjs';
import { LocationIqService, LocationIqSuggestion, LocationIqSuggestionAddress } from 'src/app/shared/services/location-iq.service';
import { ScrollToService } from 'src/app/shared/services/scroll-to.service';
import { ToastService } from 'src/app/shared/toast/toast.service';
import { locationSelectedValidator } from 'src/app/shared/validators/location-selected.validator';
import { environment } from 'src/environments/environment';
import { CloudinaryService } from '../../../../shared/services/cloudinary.service';
import { VoicesService } from '../../../../shared/services/voices.service';
import { ImageUrlResponseDto } from '../../../../shared/types/imageUrlResponse.dto';
import { CreateVoiceRequest } from '../../../../shared/types/voices';
import { AutocompleteInputComponent } from '../../components/autocomplete-input/autocomplete-input.component';

type TagGroup = 'what' | 'express' | 'from';

interface TagOption {
    key: string;
    label: string;
    emoji: string;
    custom?: boolean;
}

type Step = 1 | 2 | 3 | 4 | 5;

@Component({
    selector: 'app-form',
    standalone: true,
    imports: [ReactiveFormsModule, AutocompleteInputComponent],
    templateUrl: './form.component.html',
    styleUrl: './form.component.scss',
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class FormComponent {
    public form: FormGroup;
    public submitted = signal(false);
    public isLoading = signal(false);
    public isDragOver = signal(false);
    public previewUrl = signal<string | null>(null);

    public maxMap = {
        location: 100,     // City
        creditTo: 50,
        name: 50,
        email: 50
    };

    step = signal<Step>(1);
    rotationDeg = signal(0);

    private fb: FormBuilder = inject(FormBuilder);
    private toast: ToastService = inject(ToastService);
    public cloudinaryService: CloudinaryService = inject(CloudinaryService);
    public voicesService: VoicesService = inject(VoicesService);
    private readonly scrollToService: ScrollToService = inject(ScrollToService);

    private locationIq = inject(LocationIqService);
    private subs = new Subscription();

    public locOpen = signal(false);
    public locLoading = signal(false);
    public locSuggestions = signal<LocationIqSuggestion[]>([]);
    private locSelectInProgress = false;
    public gsLoading = signal(false);
    private GS_LICENSE_KEY = environment.geniusscansdkToken;
    public isCameraAllowed = signal(false);

    public whatOptions: TagOption[] = [
        // { key: 'drawing', label: 'Drawing', emoji: '✏️' },
        // { key: 'painting', label: 'Painting', emoji: '🖌️' },
        // { key: 'photo', label: 'Photo', emoji: '📸' },
        // { key: 'kids_art', label: 'Kids Art', emoji: '🧒' },
        // { key: 'letter', label: 'Letter', emoji: '✉️' },
        // { key: 'prayer', label: 'Prayer', emoji: '🙏' },
        // { key: 'wish', label: 'Wish', emoji: '🌟' },
        // { key: 'poem', label: 'Poem', emoji: '📝' },
        // { key: 'quote', label: 'Quote', emoji: '📔' },
        // { key: 'memory', label: 'Memory', emoji: '🧠' },
        // { key: 'thought', label: 'Thought', emoji: '💭' },
        // { key: 'pet', label: 'Pet', emoji: '🐾' },
        // { key: 'nature', label: 'Nature', emoji: '🌿' },
        { key: 'art', label: 'Art', emoji: '🎨' },
        { key: 'photo', label: 'Photo', emoji: '🎨' },
        { key: 'kids', label: 'Kids', emoji: '🧒' },
        { key: 'words', label: 'Words', emoji: '📝' },
        { key: 'other', label: 'Other', emoji: '🌀' },
    ];

    public expressOptions: TagOption[] = [
        { key: 'love', label: 'Love', emoji: '❤️' },
        // { key: 'peace', label: 'Peace', emoji: '☮️' },
        { key: 'hope', label: 'Hope', emoji: '🌈' },
        // { key: 'joy', label: 'Joy', emoji: '😊' },
        // { key: 'strength', label: 'Strength', emoji: '💪' },
        { key: 'faith', label: 'Faith', emoji: '🕊️' },
        // { key: 'encouragement', label: 'Encouragement', emoji: '✨' },
        // { key: 'friendship', label: 'Friendship', emoji: '🤝' },
        // { key: 'comfort', label: 'Comfort', emoji: '🫂' },
        // { key: 'healing', label: 'Healing', emoji: '💚' },
        { key: 'grief', label: 'Grief', emoji: '🖤' },
        // { key: 'support', label: 'Support', emoji: '🧷' },
        // { key: 'gratitude', label: 'Gratitude', emoji: '🙏' },
        // { key: 'compassion', label: 'Compassion', emoji: '💞' },
        // { key: 'connection', label: 'Connection', emoji: '🔗' },
        // { key: 'resilience', label: 'Resilience', emoji: '🌱' }
    ];

    public fromOptions: TagOption[] = [
        { key: 'child', label: 'Child', emoji: '🧒' },
        { key: 'senior', label: 'Senior', emoji: '👵' },
        { key: 'school', label: 'School', emoji: '🏫' },
        { key: 'program', label: 'Program', emoji: '📘' },
        { key: 'family', label: 'Family', emoji: '👨‍👩‍👧‍👦' },
        { key: 'parent', label: 'Parent', emoji: '🧑‍🍼' },
        { key: 'in_tribute', label: 'In Tribute', emoji: '🎗️' },
        { key: 'survivor', label: 'Survivor', emoji: '🌟' },
        { key: 'artist', label: 'Artist', emoji: '🎨' },
        { key: 'caregiver', label: 'Caregiver', emoji: '🩺' },
        { key: 'volunteer', label: 'Volunteer', emoji: '🤍' }
    ];

    public autocompleteMap: Record<string, string> = {
        firstName: 'name',
        email: 'email',
        location: 'address-level2',
        creditTo: 'organization'
    };

    public inputModeMap: Record<string, string> = { email: 'email' };
    public typeMap: Record<string, string> = { email: 'email' };
    public autocapitalizeMap: Record<string, string> = { firstName: 'words' };


    constructor() {
        this.form = this.fb.group({
            name: ['', [Validators.maxLength(this.maxMap.name)]],
            email: ['', [Validators.email, Validators.maxLength(this.maxMap.email)]],
            location: ['', [Validators.required, Validators.maxLength(this.maxMap.location)]],
            lat: [null as number | null],
            lng: [null as number | null],

            creditTo: ['', [Validators.maxLength(this.maxMap.creditTo)]],
            what: this.fb.control<string[]>([], []),
            express: this.fb.control<string[]>([], []),
            note: [''],
            img: [null, Validators.required],
        }, { validators: [locationSelectedValidator()] });

    }

    async ngOnInit(): Promise<void> {
        // Подписка на изменения поля location для автокомплита
        const locCtrl = this.form.get('location') as FormControl<string>;
        this.subs.add(
            locCtrl.valueChanges.pipe(
                tap(() => {
                    // если юзер что-то напечатывает руками — сбрасываем lat/lng
                    if (!this.locSelectInProgress) {
                        this.form.patchValue({ lat: null, lng: null }, { emitEvent: false });
                    }
                }),
                map(v => (v || '').trim()),
                tap(v => this.locOpen.set(!!v)),
                filter(v => v.length >= 2),
                debounceTime(250),
                distinctUntilChanged(),
                tap(() => this.locLoading.set(true)),
                switchMap(q =>
                    this.locationIq.searchCities(q).pipe(
                        catchError(() => of([]))
                    )
                ),
                tap(() => this.locLoading.set(false))
            ).subscribe(list => {
                this.locSuggestions.set(list);
            })
        );

        this.isCameraAllowed.set(await this.hasCameraConclusive());
    }

    ngOnDestroy(): void {
        this.subs.unsubscribe();
    }

    public selectLocation(s: LocationIqSuggestion): void {
        this.locSelectInProgress = true;
        const label = this.getLocationName(s);
        this.form.patchValue({
            location: label,
            lat: Number(s.lat),
            lng: Number(s.lon)
        }, { emitEvent: false });
        this.setCreditToFromAutoComplete(s);
        this.locOpen.set(false);
        queueMicrotask(() => this.locSelectInProgress = false);
    }

    private setCreditToFromAutoComplete(r: LocationIqSuggestion): void {
        const norm = (s: string) => s.trim().toLowerCase();

        const PLACE_TYPES = new Set(['country','state','region','province','state_district','district','county','city','town','village','hamlet','suburb','neighbourhood','quarter','residential','island','archipelago','continent','municipality','locality']);
        const POI_CLASSES = new Set(['amenity','shop','tourism','leisure','aeroway','railway','man_made','office','healthcare','historic','natural','sport']);
        const POI_HIGHWAY_TYPES = new Set(['bus_stop','tram_stop','station','platform','rest_area','services']);

        const cls = (r.class ?? '').toLowerCase();
        const typ = (r.type ?? '').toLowerCase();

        const isPlaceLike = PLACE_TYPES.has(typ) || cls === 'place';
        const isPoiLike   = POI_CLASSES.has(cls) || (cls === 'highway' && POI_HIGHWAY_TYPES.has(typ));

        let venue = r.address?.name || '';
        if (!venue && r.display_place) {
            const i = r.display_place.indexOf(',');
            if (i > 0) venue = r.display_place.slice(0, i).trim();
        }

        if (venue) {
            const addr: LocationIqSuggestionAddress | undefined = r.address;
            if (!addr) return;
            const topo = [
                addr.city, addr.state, addr.country, addr.suburb, addr.neighbourhood, addr.county, addr.road, addr.postcode
            ]
                .filter(Boolean).map(v => norm(String(v)));
            if (topo.includes(norm(venue))) venue = '';
        }

        const credit_to = isPoiLike && !isPlaceLike && venue ? venue : '';

        this.form.get('creditTo')!.setValue(credit_to);
    }

    public getLocationName(s: LocationIqSuggestion): string {
        // return s.address?.country + ', ' + s.address?.name;
        return s.display_name;
    }

    public onLocationBlur(): void {
        // даём время на click по элементу списка
        setTimeout(() => this.locOpen.set(false), 150);
    }

    public useMyLocation(): void {
        if (!('geolocation' in navigator)) return;
        navigator.geolocation.getCurrentPosition(pos => {
            const { latitude, longitude } = pos.coords;
            this.form.patchValue({ lat: latitude, lng: longitude });
        });
    }

    public isSelected(group: TagGroup, key: string): boolean {
        const arr = this.form.get(group) as FormControl<string[]>;
        const v = arr.value ?? [];
        return v.includes(key);
    }

    public disableChip(group: TagGroup, key: string): boolean {
        const selected = (this.form.get(group)?.value as string[]) ?? [];
        return selected.length >= 3 && !selected.includes(key);
    }

    public toggle(group: TagGroup, key: string): void {
        const ctrl = this.form.get(group) as FormControl<string[]>;
        const current = (ctrl.value ?? []).slice();
        const i = current.indexOf(key);
        if (i >= 0) current.splice(i, 1);
        else if (current.length < 3) current.push(key);
        ctrl.setValue(current);
        ctrl.markAsDirty();
        ctrl.markAsTouched();
    }

    public onFileDrop(event: DragEvent) {
        event.preventDefault();
        this.isDragOver.set(false);
        const file = event.dataTransfer?.files[0];
        if (file) this.setFile(file);
    }

    public onDragOver(event: DragEvent) {
        event.preventDefault();
        this.isDragOver.set(true);
    }

    public onDragLeave() {
        this.isDragOver.set(false);
    }

    private setFile(file: File) {
        this.form.patchValue({ img: file });
        const reader = new FileReader();
        reader.onload = () => this.previewUrl.set(reader.result as string);
        reader.readAsDataURL(file);
        this.rotationDeg.set(0);
    }

    public onFileChange(event: any) {
        const file = event.target.files[0];
        if (!file) return;
        this.setFile(file);
    }

    public clearFile(event: Event) {
        this.form.patchValue({ img: null });
        this.previewUrl.set(null);
        this.rotationDeg.set(0);
        event.stopPropagation();
    }

    rotateLeft() { this.rotationDeg.update(v => v - 90); }
    rotateRight() { this.rotationDeg.update(v => v + 90); }

    private async maybeRotatedFile(file: File): Promise<File> {
        const deg = ((this.rotationDeg() % 360) + 360) % 360;
        if (!deg || !file.type.startsWith('image/')) return file;

        return new Promise<File>((resolve, reject) => {
            const fr = new FileReader();
            fr.onload = () => {
                const img = new Image();
                img.onload = () => {
                    const rad = deg * Math.PI / 180;
                    const swap = deg === 90 || deg === 270;
                    const cw = swap ? img.height : img.width;
                    const ch = swap ? img.width : img.height;
                    const c = document.createElement('canvas');
                    c.width = cw;
                    c.height = ch;
                    const ctx = c.getContext('2d')!;
                    ctx.translate(cw / 2, ch / 2);
                    ctx.rotate(rad);
                    ctx.drawImage(img, -img.width / 2, -img.height / 2);
                    c.toBlob(b => {
                        if (!b) return reject();
                        const out = new File([b], file.name.replace(/\.[^.]+$/, '') + '_rot.jpg', { type: 'image/jpeg' });
                        resolve(out);
                    }, 'image/jpeg', 0.92);
                };
                img.onerror = () => reject();
                img.src = fr.result as string;
            };
            fr.onerror = () => reject();
            fr.readAsDataURL(file);
        });
    }

    public submit() {
        if (this.form.valid) {
            this.prepareToUploadVoice();
        } else {
            this.form.markAllAsTouched();
        }
    }

    public prepareToUploadVoice(): void {
        if (this.form.invalid) return;
        this.isLoading.set(true);
        this.uploadAngGetPictureUrl();
    }

    private async uploadAngGetPictureUrl(): Promise<void> {
        try {
            const original: File = this.form.get('img')?.value;
            const toUpload = await this.maybeRotatedFile(original);
            this.cloudinaryService.uploadImageAndGetUrl(toUpload).subscribe({
                next: response => this.uploadVoice(response),
                error: () => this.isLoading.set(false)
            });
        } catch {
            const fallback: File = this.form.get('img')?.value;
            this.cloudinaryService.uploadImageAndGetUrl(fallback).subscribe({
                next: response => this.uploadVoice(response),
                error: () => this.isLoading.set(false)
            });
        }
    }

    private uploadVoice(response: ImageUrlResponseDto): void {
        const img: string = response.imageUrl.url;
        const body: CreateVoiceRequest = {
            firstName: this.form.get('name')?.value,
            email: this.form.get('email')?.value,
            location: this.form.get('location')?.value,
            creditTo: this.form.get('creditTo')?.value,
            what: this.form.get('what')?.value,
            express: this.form.get('express')?.value,
            note: this.form.get('note')?.value,
            img,
            consent: true,
            lat: this.form.get('lat')?.value,
            lng: this.form.get('lng')?.value,
        };

        this.voicesService.createVoice(body)
            .pipe(first())
            .subscribe({
                next: () => {
                    this.isLoading.set(false);
                    this.submitted.set(true);
                },
                error: () => this.isLoading.set(false)
            });
    }

    public autoResize(event: Event): void {
        const textarea = event.target as HTMLTextAreaElement;
        textarea.style.height = 'auto';
        textarea.style.height = textarea.scrollHeight + 'px';
    }

    public draftWhat = '';
    public draftExpress = '';

    private slugifyLabel(label: string): string {
        return (label || '').trim().toLowerCase().normalize('NFKD')
            .replace(/[^\p{Letter}\p{Number}\s-]/gu, '')
            .replace(/\s+/g, '-')
            .replace(/-+/g, '-')
            .replace(/^-|-$/g, '');
    }

    private findOptionByKey(group: TagGroup, key: string): TagOption | undefined {
        const list = group === 'what' ? this.whatOptions : group === 'express' ? this.expressOptions : this.fromOptions;
        return list.find(o => o.key === key);
    }

    public resolveLabel(group: TagGroup, key: string): string {
        return this.findOptionByKey(group, key)?.label ?? key;
    }

    public canAddDraft(group: 'what' | 'express'): boolean {
        const draft = group === 'what' ? this.draftWhat : this.draftExpress;
        const v = (draft || '').trim();
        if (v.length < 2 || v.length > 24) return false;
        if (!/^[\p{Letter}\p{Number}\s-]+$/u.test(v)) return false;
        const ctrl = this.form.get(group) as FormControl<string[]>;
        const selected = ctrl.value ?? [];
        if (selected.length >= 3) return false;
        const norm = v.toLowerCase();
        const duplicateByLabel = selected.some(k => this.resolveLabel(group, k).toLowerCase() === norm);
        if (duplicateByLabel) return false;
        const slug = this.slugifyLabel(v);
        const existsInOptions = !!this.findOptionByKey('what', slug) || !!this.findOptionByKey('express', slug);
        if (existsInOptions) return false;
        return true;
    }

    public getLen(field: keyof typeof this.maxMap): number {
        const v = (this.form.get(field)?.value ?? '') as string;
        return v.length;
    }

    public addCustomTag(group: 'what' | 'express'): void {
        if (!this.canAddDraft(group)) return;
        const draft = (group === 'what' ? this.draftWhat : this.draftExpress).trim();
        const key = draft;
        const ctrl = this.form.get(group) as FormControl<string[]>;
        const current = (ctrl.value ?? []).slice();
        if (current.length >= 3) return;
        current.push(key);
        ctrl.setValue(current);
        ctrl.markAsDirty();
        ctrl.markAsTouched();
        if (group === 'what') {
            this.whatOptions.push({ key, label: draft, emoji: '✍️', custom: true });
            this.draftWhat = '';
        } else {
            this.expressOptions.push({ key, label: draft, emoji: '✍️', custom: true });
            this.draftExpress = '';
        }
    }

    public removeTag(group: TagGroup, key: string): void {
        const ctrl = this.form.get(group) as FormControl<string[]>;
        const current = (ctrl.value ?? []).filter(k => k !== key);
        ctrl.setValue(current);
        ctrl.markAsDirty();
        ctrl.markAsTouched();
    }

    goNext() {
        if (this.step() === 1 && !this.form.get('img')?.value) return;
        if (this.step() === 5) return;
        this.step.update(s => (s + 1) as Step);
        setTimeout(() =>
            this.scrollToService.scrollToTop()
            , 200);

    }
    goBack() {
        if (this.step() === 1) return;
        this.step.update(s => (s - 1) as Step);
        setTimeout(() =>
            this.scrollToService.scrollToTop()
            , 200);
    }

    naturalW = signal(1);
    naturalH = signal(1);
    rotated = computed(() => Math.abs(this.rotationDeg()) % 180 === 90);

    onImgLoad(e: Event) {
        const img = e.target as HTMLImageElement;
        this.naturalW.set(img.naturalWidth);
        this.naturalH.set(img.naturalHeight);
        console.log(img.naturalWidth, img.naturalHeight);
    }

    public computeQuadraticMargin(delta: number): number {
        const a = -0.00006391;
        const b = 0.11447;
        const c = 4.44;
        const margin = (a * delta * delta) + (b * delta) + c;
        return Math.min(55, Math.max(10, margin));
    }

    public async scanWithGeniusScan(): Promise<void> {
        if (this.gsLoading()) return;
        this.gsLoading.set(true);

        try {
            // @ts-ignore
            const GS = window.GSSDK ?? window.GeniusScan;
            if (!GS) {
                this.toast.warn('[Genius Scan SDK]', 'global not found. Ensure the <script> is loaded', 5000);
                return;
            }

            const starter =
                (typeof GS.scanWithConfiguration === 'function' && GS.scanWithConfiguration) ||
                (typeof GS.start === 'function' && GS.start) ||
                (typeof GS.open === 'function' && GS.open);
    
            if (!starter) {
                console.error('No start function on GSSDK/GeniusScan (expected scanWithConfiguration/start/open).');
                return;
            }

            await GS.setLicenseKey('533c5007525500020151035139465a0d0011440b5d55574a4c555b0b68090706510450540f0200')
            console.log('test', this.GS_LICENSE_KEY);
    
            const cfg = {
                multiPage: false,
                "defaultFilter": "photo",
                "multiPageFormat": "none",
                jpegQuality: 60,
                "showFps": true,
            };
    
            const result = await starter(cfg);

            const { scans, multiPageDocument } = result;
    
            const first =
                result?.images?.[0] ??
                result?.pages?.[0] ??
                result?.scans?.[0];
    
            if (!first) {
                this.toast.warn('[Genius Scan SDK]', 'No scans returned');
                console.warn('No scans returned');
                return;
            }
    
            const blob = scans[0].enhancedImage.data;
            const file = new File([blob], `wondr-scan-${Date.now()}.jpg`, { type: 'image/jpeg' });
            this.setFile(file);
            this.toast.success('[Genius Scan SDK]', 'Scan completed');
        } catch (e: any) {
            // @ts-ignore
            const GS = window.GSSDK ?? window.GeniusScan;
            if (GS?.MissingLicenseKeyError && e instanceof GS.MissingLicenseKeyError) {
                this.toast.warn('[Genius Scan SDK]', 'missing license key');
            } else if (GS?.InvalidLicenseKeyError && e instanceof GS.InvalidLicenseKeyError) {
                this.toast.warn('[Genius Scan SDK]', 'invalid license key');
            } else {
                this.toast.warn('[Genius Scan SDK]', `Genius Scan error ${JSON.stringify(e)}`);
            }
        } finally {
            this.gsLoading.set(false);
        }
    }
    

    public async hasCameraConclusive(): Promise<boolean> {
        if (!navigator.mediaDevices?.getUserMedia || !navigator.mediaDevices?.enumerateDevices) return false;
    
        this.gsLoading.set(true);
        try {
            // 1) Ask for any camera to unlock device labels
            const warmupStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
            warmupStream.getTracks().forEach(track => track.stop());
    
            // 2) Try to find back/environment cameras by label
            const devices = await navigator.mediaDevices.enumerateDevices();
            const videoInputs = devices.filter(d => d.kind === 'videoinput');
    
            const backLabel = /(back|rear|environment|wide)/i;
            const frontLabel = /(front|user|face|integrated|webcam)/i;
    
            const backCameras = videoInputs.filter(d => backLabel.test(d.label) && !frontLabel.test(d.label));
            if (backCameras.length > 0) {
                this.toast.success('Camera access', 'Back camera available');
                return true;
            }
    
            // 3) If labels are inconclusive (e.g., iOS), try environment constraint directly
            try {
                const envProbe = await navigator.mediaDevices.getUserMedia({
                    video: { facingMode: { exact: 'environment' } },
                    audio: false
                });
                envProbe.getTracks().forEach(track => track.stop());
                this.toast.success('Camera access', 'Environment camera available');
                return true;
            } catch {
                // No environment camera or not switchable
            }
    
            return false;
        } catch {
            return false;
        } finally {
            this.gsLoading.set(false);
        }
    }
}
