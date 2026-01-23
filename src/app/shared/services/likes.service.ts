import { Injectable } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class LikesService {
    private readonly storageKey = 'wondrvoices_likes';
    private memoryStore = new Set<string>();

    hasLiked(requestId: string): boolean {
        return this.readStore().has(requestId);
    }

    toggleLike(requestId: string): boolean {
        const store = this.readStore();
        let liked = false;

        if (store.has(requestId)) {
            store.delete(requestId);
        } else {
            store.add(requestId);
            liked = true;
        }

        this.saveStore(store);
        return liked;
    }

    getAllLikes(): Set<string> {
        return this.readStore();
    }

    private readStore(): Set<string> {
        if (this.isStorageAvailable()) {
            try {
                const raw = localStorage.getItem(this.storageKey);
                if (!raw) return new Set<string>();
                const parsed: string[] = JSON.parse(raw);
                return new Set(parsed);
            } catch {
                return new Set<string>(this.memoryStore);
            }
        }

        return new Set<string>(this.memoryStore);
    }

    private saveStore(store: Set<string>): void {
        if (this.isStorageAvailable()) {
            try {
                localStorage.setItem(this.storageKey, JSON.stringify(Array.from(store)));
                return;
            } catch {
                // fall through to memory store if localStorage fails
            }
        }

        this.memoryStore = new Set<string>(store);
    }

    private isStorageAvailable(): boolean {
        return typeof window !== 'undefined' && typeof localStorage !== 'undefined';
    }
}
