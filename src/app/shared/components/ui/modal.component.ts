import { Component, ElementRef, Injector, afterRenderEffect, input, output } from '@angular/core';

@Component({
  selector: 'app-modal',
  standalone: true,
  templateUrl: './modal.component.html',
})
export class ModalComponent {
  readonly open = input.required<boolean>();
  readonly title = input('');
  readonly closeable = input(true);
  readonly size = input<'sm' | 'md' | 'lg' | 'xl'>('md');
  readonly closeAction = output<void>();

  private previousActiveElement: Element | null = null;

  constructor(
    private readonly elementRef: ElementRef,
    private readonly injector: Injector,
  ) {
    afterRenderEffect(
      () => {
        if (this.open()) {
          this.previousActiveElement = document.activeElement;
          const dialog = this.elementRef.nativeElement.querySelector(
            '[role="dialog"]',
          ) as HTMLElement | null;
          const closeButton = dialog?.querySelector(
            'button[aria-label="Cerrar"]',
          ) as HTMLElement | null;
          (closeButton ?? dialog)?.focus();
          document.body.classList.add('overflow-hidden');
        } else {
          document.body.classList.remove('overflow-hidden');
          if (this.previousActiveElement instanceof HTMLElement) {
            this.previousActiveElement.focus();
          }
        }
      },
      { injector: this.injector },
    );
  }

  protected dialogClasses(): string {
    const map: Record<string, string> = {
      sm: 'sm:max-w-sm',
      md: 'sm:max-w-lg',
      lg: 'sm:max-w-2xl',
      xl: 'sm:max-w-4xl',
    };
    return `relative w-full rounded-t-3xl sm:rounded-modal bg-surface sm:border border-border p-6 shadow-2xl shadow-black/40 max-h-[85svh] overflow-y-auto ${map[this.size()]} animate-sheet-in sm:animate-scale-in`;
  }

  protected backdropClasses(): string {
    return 'fixed inset-0 z-50 flex items-end justify-center bg-black/80 p-0 sm:items-center sm:p-4';
  }

  protected close(): void {
    if (this.closeable()) {
      this.closeAction.emit();
    }
  }

  protected onKeydown(event: Event): void {
    if ((event as KeyboardEvent).key === 'Escape') {
      this.close();
    }
  }
}
