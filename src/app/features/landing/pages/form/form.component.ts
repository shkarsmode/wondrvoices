import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { catchError, debounceTime, distinctUntilChanged, filter, first, firstValueFrom, map, of, Subscription, switchMap, tap } from 'rxjs';
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
    public hasLocation = signal(false);

    /* multi-upload state */
    public isMultipleUpload = false;
    public files = signal<File[]>([]);
    public previewUrls = signal<string[]>([]);
    public rotationDegrees = signal<number[]>([]);
    public activeIndex = signal(0);

    /* derived state */
    public currentPreviewUrl = computed(() => {
        const list = this.previewUrls();
        const i = this.activeIndex();
        return list.length > 0 && list[i] ? list[i] : null;
    });
    public rotationForActive = computed(() => {
        const list = this.rotationDegrees();
        const i = this.activeIndex();
        return list.length > 0 && typeof list[i] === 'number' ? list[i] : 0;
    });

    public maxMap = { location: 100, creditTo: 50, name: 50, email: 50 };

    step = signal<Step>(1);
    previousStep = signal<Step>(1);

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

    public whatOptions: TagOption[] = [
        { key: 'art', label: 'Art', emoji: '🎨' },
        { key: 'photo', label: 'Photo', emoji: '🎨' },
        { key: 'kids', label: 'Kids', emoji: '🧒' },
        { key: 'words', label: 'Words', emoji: '📝' },
        { key: 'other', label: 'Other', emoji: '🌀' },
    ];

    public expressOptions: TagOption[] = [
        { key: 'love', label: 'Love', emoji: '❤️' },
        { key: 'hope', label: 'Hope', emoji: '🌈' },
        { key: 'faith', label: 'Faith', emoji: '🕊️' },
        { key: 'grief', label: 'Grief', emoji: '🖤' },
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
        if (typeof window !== 'undefined') {
            this.isMultipleUpload = Number(localStorage?.getItem('dev')) === 1;
        }
        this.form = this.fb.group({
            name: ['', [Validators.maxLength(this.maxMap.name)]],
            email: ['', [Validators.email, Validators.maxLength(this.maxMap.email)]],
            location: ['', [Validators.required]],
            lat: [null as number | null],
            lng: [null as number | null],
            creditTo: ['', [Validators.required, Validators.maxLength(this.maxMap.creditTo)]],
            what: this.fb.control<string[]>([], []),
            express: this.fb.control<string[]>([], []),
            note: [''],
            img: [null],
        }, { validators: [locationSelectedValidator()] });
    }

    async ngOnInit(): Promise<void> {
        const locCtrl = this.form.get('location') as FormControl<string>;
        this.subs.add(
            locCtrl.valueChanges.pipe(
                tap(() => {
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
                switchMap(q => this.locationIq.searchCities(q).pipe(catchError(() => of([])))),
                tap(() => this.locLoading.set(false))
            ).subscribe(list => this.locSuggestions.set(list))
        );
    }

    ngOnDestroy(): void {
        this.subs.unsubscribe();
    }

    /* ————— Upload handling ————— */

    public onFileDrop(event: DragEvent): void {
        event.preventDefault();
        this.isDragOver.set(false);
        const dt = event.dataTransfer;
        if (!dt || !dt.files?.length) return;
        this.ingestFiles(Array.from(dt.files));
    }

    public onDragOver(event: DragEvent): void {
        event.preventDefault();
        this.isDragOver.set(true);
    }

    public onDragLeave(): void {
        this.isDragOver.set(false);
    }

    public onFileChange(event: Event): void {
        const input = event.target as HTMLInputElement;
        const list = Array.from(input.files || []);
        if (!list.length) return;
        this.ingestFiles(list);
        input.value = '';
    }

    public removeCurrentFile(event?: Event): void {
        if (event) event.stopPropagation();
        const i = this.activeIndex();
        const nextFiles = this.files().slice();
        const nextUrls = this.previewUrls().slice();
        const nextRot = this.rotationDegrees().slice();

        nextFiles.splice(i, 1);
        nextUrls.splice(i, 1);
        nextRot.splice(i, 1);

        this.files.set(nextFiles);
        this.previewUrls.set(nextUrls);
        this.rotationDegrees.set(nextRot);

        if (this.activeIndex() >= nextFiles.length) {
            this.activeIndex.set(Math.max(0, nextFiles.length - 1));
        }
        this.syncFormImg();
    }

    public clearAllFiles(): void {
        this.files.set([]);
        this.previewUrls.set([]);
        this.rotationDegrees.set([]);
        this.activeIndex.set(0);
        this.syncFormImg();
    }

    public setActiveIndex(index: number): void {
        this.activeIndex.set(index);
        queueMicrotask(() => this.recomputeImgNaturalSize());
    }

    private ingestFiles(list: File[]): void {
        const onlyImages = list.filter(f => /^image\//i.test(f.type));
        if (!onlyImages.length) return;

        if (!this.isMultipleUpload) {
            const first = onlyImages[0];
            this.files.set([first]);
            this.rotationDegrees.set([0]);
            this.readPreviews([first]).then(urls => this.previewUrls.set(urls));
            this.activeIndex.set(0);
        } else {
            const merged = this.files().concat(onlyImages);
            const limited = merged.slice(0, 30);
            this.files.set(limited);
            const addRot = new Array(onlyImages.length).fill(0);
            this.rotationDegrees.set(this.rotationDegrees().concat(addRot));
            this.readPreviews(onlyImages).then(newUrls => this.previewUrls.set(this.previewUrls().concat(newUrls)));
        }

        this.syncFormImg();
        this.recomputeImgNaturalSize();
    }

    private async readPreviews(files: File[]): Promise<string[]> {
        const results: string[] = [];
        for (const file of files) {
            const url = await new Promise<string>((resolve, reject) => {
                const fr = new FileReader();
                fr.onload = () => resolve(fr.result as string);
                fr.onerror = () => reject();
                fr.readAsDataURL(file);
            });
            results.push(url);
        }
        return results;
    }

    private syncFormImg(): void {
        const single = this.files()[this.activeIndex()] ?? null;
        this.form.patchValue({ img: single }, { emitEvent: false });
        if (!single) {
            this.form.get('img')?.setErrors({ required: true });
        } else {
            this.form.get('img')?.setErrors(null);
        }
    }

    /* ————— Rotation ————— */

    public rotateLeft(): void {
        this.updateRotation(-90);
    }

    public rotateRight(): void {
        this.updateRotation(+90);
    }

    private updateRotation(delta: number): void {
        const idx = this.activeIndex();
        const arr = this.rotationDegrees().slice();
        const next = ((arr[idx] || 0) + delta) % 360;
        arr[idx] = next;
        this.rotationDegrees.set(arr);
    }

    public rotated = computed(() => Math.abs(this.rotationForActive()) % 180 === 90);
    public naturalW = signal(1);
    public naturalH = signal(1);

    public onImgLoad(e: Event): void {
        const img = e.target as HTMLImageElement;
        this.naturalW.set(img.naturalWidth);
        this.naturalH.set(img.naturalHeight);
    }

    private recomputeImgNaturalSize(): void {
        /* no-op placeholder; natural size will update on next <img> load */
    }

    /* ————— Submit ————— */

    public submit(): void {
        if (this.form.invalid || this.files().length === 0) {
            this.form.markAllAsTouched();
            return;
        }
        this.prepareToUploadVoice();
    }

    public prepareToUploadVoice(): void {
        if (this.form.invalid) return;
        this.isLoading.set(true);
        if (this.isMultipleUpload) {
            this.uploadManyAndCreateVoices().finally(() => this.isLoading.set(false));
        } else {
            this.uploadSingleAndCreateVoice().finally(() => this.isLoading.set(false));
        }
    }

    private async uploadSingleAndCreateVoice(): Promise<void> {
        try {
            const idx = this.activeIndex();
            const original = this.files()[idx];
            const rotated = await this.maybeRotatedFile(original, idx);
            const url = await this.uploadToCloudinary(rotated);
            await this.createVoice(url);
            this.submitted.set(true);
        } catch {
            /* silent fail already notified by services if needed */
        }
    }

    private async uploadManyAndCreateVoices(): Promise<void> {
        const files = this.files();
        const urls: string[] = [];

        for (let i = 0; i < files.length; i++) {
            try {
                const rotated = await this.maybeRotatedFile(files[i], i);
                const url = await this.uploadToCloudinary(rotated);
                urls.push(url);
            } catch {
                this.toast.warn('Upload', `Failed to upload image #${i + 1}`);
            }
        }

        for (let i = 0; i < urls.length; i++) {
            try {
                await this.createVoice(urls[i]);
            } catch {
                this.toast.warn('Submit', `Failed to submit card #${i + 1}`);
            }
        }

        if (urls.length > 0) {
            this.submitted.set(true);
        }
    }

    private async uploadToCloudinary(file: File): Promise<string> {
        const res: ImageUrlResponseDto = await firstValueFrom(this.cloudinaryService.uploadImageAndGetUrl(file));
        return res.imageUrl.url;
    }

    private async createVoice(imgUrl: string): Promise<void> {
        const body: CreateVoiceRequest = {
            firstName: this.form.get('name')?.value,
            email: this.form.get('email')?.value,
            location: this.form.get('location')?.value,
            creditTo: this.form.get('creditTo')?.value,
            what: this.form.get('what')?.value,
            express: this.form.get('express')?.value,
            note: this.form.get('note')?.value,
            img: imgUrl,
            consent: true,
            lat: this.form.get('lat')?.value,
            lng: this.form.get('lng')?.value,
        };
        await firstValueFrom(this.voicesService.createVoice(body).pipe(first()));
    }

    private async maybeRotatedFile(file: File, index: number): Promise<File> {
        const deg0 = this.rotationDegrees()[index] || 0;
        const deg = ((deg0 % 360) + 360) % 360;
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

    chooseStep(step: number): void {
        switch (step) {
            case 5:
                if (!this.form.get('lat')?.value || !this.form.get('lng')?.value || !this.form.get('creditTo')?.value) return;
            case 4:
            case 3:
            case 2:
                if (this.files().length === 0) return;
        }
        this.previousStep.set(this.step());
        this.step.set(step as Step);
    }

    goNext(): void {
        if (this.step() === 1 && this.files().length === 0) return;
        if (this.step() === 5) return;
        this.previousStep.set(this.step());
        this.step.update(s => (s + 1) as Step);
        setTimeout(() => this.scrollToService.scrollToTop(), 200);
    }

    goBack(): void {
        if (this.step() === 1) return;
        this.previousStep.set(this.step());
        this.step.update(s => (s - 1) as Step);
        setTimeout(() => this.scrollToService.scrollToTop(), 200);
    }

    public computeQuadraticMargin(delta: number): number {
        const a = -0.00006391;
        const b = 0.11447;
        const c = 4.44;
        const margin = (a * delta * delta) + (b * delta) + c;
        return Math.min(55, Math.max(10, margin));
    }

    public async scanWithGeniusScan(isOpenSource: boolean = false): Promise<void> {
        if (!(await this.hasCameraConclusive())) {
            isOpenSource = true;
            this.toast.warn('Your device has no camera to scan');
        }
        try {
            // @ts-ignore
            const GS = (window as any).GSSDK ?? (window as any).GeniusScan;
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

            await GS.setLicenseKey(this.GS_LICENSE_KEY);

            const cfg: any = {
                multiPage: false,
                defaultFilter: 'automatic',
                multiPageFormat: 'none',
                jpegQuality: 90,
                source: 'camera',
                photoLibraryButtonHidden: true
            };

            const result = await starter(cfg);
            const first = result?.images?.[0] ?? result?.pages?.[0] ?? result?.scans?.[0];
            if (!first) {
                this.toast.warn('[Genius Scan SDK]', 'No scans returned');
                return;
            }

            const blob = result.scans[0].enhancedImage.data;
            const file = new File([blob], `wondr-scan-${Date.now()}.jpg`, { type: 'image/jpeg' });

            if (this.isMultipleUpload) {
                this.ingestFiles([file]);
                this.activeIndex.set(this.previewUrls().length - 1);
            } else {
                this.ingestFiles([file]);
                this.activeIndex.set(0);
            }

            this.toast.success('[Genius Scan SDK]', 'Scan completed');
        } catch (e: any) {
            // @ts-ignore
            const GS = (window as any).GSSDK ?? (window as any).GeniusScan;
            if (GS?.MissingLicenseKeyError && e instanceof GS.MissingLicenseKeyError) {
                this.toast.warn('[Genius Scan SDK]', 'missing license key');
            } else if (GS?.InvalidLicenseKeyError && e instanceof GS.InvalidLicenseKeyError) {
                this.toast.warn('[Genius Scan SDK]', 'invalid license key');
            } else {
                this.toast.warn('[Genius Scan SDK]', `Genius Scan error ${JSON.stringify(e)}`);
            }
        }
    }

    // private setFile(file: File) { this.form.patchValue({ img: file }); const reader = new FileReader(); reader.onload = () => this.previewUrl.set(reader.result as string); reader.readAsDataURL(file); this.rotationDeg.set(0); }
    
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

    public useMyLocation(): void { if (!('geolocation' in navigator)) return; navigator.geolocation.getCurrentPosition(pos => { const { latitude, longitude } = pos.coords; this.form.patchValue({ lat: latitude, lng: longitude }); }); }

    public onLocationBlur(): void { setTimeout(() => this.locOpen.set(false), 150); }

    public isSelected(group: TagGroup, key: string): boolean { const arr = this.form.get(group) as FormControl<string[]>; const v = arr.value ?? []; return v.includes(key); }

    public selectLocation(s: LocationIqSuggestion): void {
        this.locSelectInProgress = true;
        const label = this.getLocationName(s);
        this.form.patchValue({ location: label, lat: Number(s.lat), lng: Number(s.lon) }, { emitEvent: false });
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
            const topo = [addr.city, addr.state, addr.country, addr.suburb, addr.neighbourhood, addr.county, addr.road, addr.postcode]
                .filter(Boolean).map(v => norm(String(v)));
            if (topo.includes(norm(venue))) venue = '';
        }
        const credit_to = isPoiLike && !isPlaceLike && venue ? venue : '';
        this.hasLocation.set(!!credit_to);
        this.form.get('creditTo')!.setValue(credit_to);
    }

    public getLocationName(s: LocationIqSuggestion): string {
        return s.display_name;
    }

    public getLen(field: keyof typeof this.maxMap): number {
        const v = (this.form.get(field)?.value ?? '') as string;
        return v.length;
    }

    public resetAll(): void {
        this.clearAllFiles();
        this.form.reset();
        this.rotationDegrees.set([]);
        this.activeIndex.set(0);
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
