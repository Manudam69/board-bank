import { Injectable, signal } from '@angular/core';

const STORAGE_KEY = 'boardbank-player-name';

@Injectable({
  providedIn: 'root',
})
export class PlayerIdentityService {
  private readonly _name = signal(this.readName());
  readonly name = this._name.asReadonly();

  setName(name: string): void {
    const trimmed = name.trim();
    this._name.set(trimmed);
    try {
      localStorage.setItem(STORAGE_KEY, trimmed);
    } catch {
      // ignore storage errors (private mode, etc.)
    }
  }

  clear(): void {
    this._name.set('');
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // ignore
    }
  }

  private readName(): string {
    try {
      return localStorage.getItem(STORAGE_KEY) ?? '';
    } catch {
      return '';
    }
  }
}
