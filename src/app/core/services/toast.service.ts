import { Injectable, signal } from '@angular/core';

export type ToastType = 'success' | 'error' | 'info';

export interface ToastAction {
  label: string;
  run: () => void;
}

export interface ToastMessage {
  id: string;
  type: ToastType;
  message: string;
  detail?: string;
  action?: ToastAction;
}

interface ToastTimer {
  timer: ReturnType<typeof setTimeout>;
  durationMs: number;
  shownAt: number;
  remainingMs?: number;
}

@Injectable({
  providedIn: 'root',
})
export class ToastService {
  private readonly nextId = signal(1);
  private readonly _toasts = signal<ToastMessage[]>([]);
  readonly toasts = this._toasts.asReadonly();

  private readonly timers = new Map<string, ToastTimer>();

  show(type: ToastType, message: string, detail?: string, durationMs = 3500, action?: ToastAction): void {
    const id = String(this.nextId());
    this.nextId.update((n) => n + 1);
    const toast: ToastMessage = { id, type, message, detail, action };

    this._toasts.update((list) => [...list, toast]);

    if (durationMs > 0) {
      const shownAt = Date.now();
      const timer = setTimeout(() => this.dismiss(id), durationMs);
      this.timers.set(id, { timer, durationMs, shownAt });
    }
  }

  success(message: string, detail?: string, action?: ToastAction): void {
    this.show('success', message, detail, action ? 8000 : 3500, action);
  }

  error(message: string, detail?: string): void {
    this.show('error', message, detail, 5000);
  }

  info(message: string, detail?: string): void {
    this.show('info', message, detail, 3000);
  }

  pause(id: string): void {
    const entry = this.timers.get(id);
    if (!entry || entry.remainingMs !== undefined) {
      return;
    }

    clearTimeout(entry.timer);
    const elapsed = Date.now() - entry.shownAt;
    entry.remainingMs = Math.max(0, entry.durationMs - elapsed);
  }

  resume(id: string): void {
    const entry = this.timers.get(id);
    if (!entry || entry.remainingMs === undefined || entry.remainingMs <= 0) {
      return;
    }

    const durationMs = entry.remainingMs;
    const shownAt = Date.now();
    const timer = setTimeout(() => this.dismiss(id), durationMs);

    entry.timer = timer;
    entry.durationMs = durationMs;
    entry.shownAt = shownAt;
    entry.remainingMs = undefined;
  }

  dismiss(id: string): void {
    const entry = this.timers.get(id);
    if (entry) {
      clearTimeout(entry.timer);
      this.timers.delete(id);
    }

    this._toasts.update((list) => list.filter((t) => t.id !== id));
  }
}
