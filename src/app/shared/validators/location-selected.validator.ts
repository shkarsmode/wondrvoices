// shared/validators/location-selected.validator.ts
import { AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';

export function locationSelectedValidator(): ValidatorFn {
    return (group: AbstractControl): ValidationErrors | null => {
        const location = group.get('location')?.value?.trim();
        const lat = group.get('lat')?.value;
        const lng = group.get('lng')?.value;

        if ((lat === null || lat === undefined || lng === null || lng === undefined)) {
            return { locationNotSelected: true };
        }
        return null;
    };
}
