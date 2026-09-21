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

@Injectable({
  providedIn: 'root',
})
export class ToastService {
  private readonly nextId = signal(1);
  private readonly _toasts = signal<ToastMessage[]>([]);
  readonly toasts = this._toasts.asReadonly();

  show(type: ToastType, message: string, detail?: string, durationMs = 3500, action?: ToastAction): void {
    const id = String(this.nextId());
    this.nextId.update((n) => n + 1);
    const toast: ToastMessage = { id, type, message, detail, action };

    this._toasts.update((list) => [...list, toast]);

    if (durationMs > 0) {
      setTimeout(() => this.dismiss(id), durationMs);
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

  dismiss(id: string): void {
    this._toasts.update((list) => list.filter((t) => t.id !== id));
  }
}
