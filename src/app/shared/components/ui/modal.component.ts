import { Component, input, output, signal } from '@angular/core';

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

  protected lastOpen = signal(false);

  protected dialogClasses(): string {
    const map: Record<string, string> = {
      sm: 'max-w-sm',
      md: 'max-w-lg',
      lg: 'max-w-2xl',
      xl: 'max-w-4xl',
    };
    return `relative w-full rounded-2xl bg-white p-6 shadow-2xl ${map[this.size()]}`;
  }

  protected close(): void {
    if (this.closeable()) {
      this.closeAction.emit();
    }
  }
}
