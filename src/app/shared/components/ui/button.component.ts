import { Component, input, output } from '@angular/core';

type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost' | 'soft';
type ButtonShape = 'full' | 'lg';
type ButtonSize = 'sm' | 'md' | 'lg';

@Component({
  selector: 'app-button',
  standalone: true,
  templateUrl: './button.component.html',
})
export class ButtonComponent {
  readonly variant = input<ButtonVariant>('primary');
  readonly size = input<ButtonSize>('md');
  readonly shape = input<ButtonShape>('full');
  readonly disabled = input(false);
  readonly loading = input(false);
  readonly type = input<'button' | 'submit' | 'reset'>('button');
  readonly fullWidth = input(false);
  readonly ariaLabel = input<string | undefined>(undefined);
  readonly clickAction = output<MouseEvent>();

  protected getClasses(): string {
    const base =
      'inline-flex items-center justify-center font-medium transition-all focus:outline-none cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98]';
    const sizes: Record<ButtonSize, string> = {
      sm: 'px-3 py-1.5 text-sm',
      md: 'px-4 py-2 text-base',
      lg: 'px-6 py-3 text-lg',
    };
    const variants: Record<ButtonVariant, string> = {
      primary: 'bg-accent text-white hover:bg-accent-hover',
      secondary:
        'bg-surface-elevated text-text border border-border hover:bg-surface-hover',
      danger:
        'bg-transparent text-negative border border-negative/40 hover:bg-danger-muted',
      ghost:
        'bg-transparent text-text-secondary hover:bg-surface-elevated hover:text-text',
      soft: 'bg-surface-hover text-text border border-border hover:bg-surface-active',
    };
    const shape = this.shape() === 'full' ? 'rounded-full' : 'rounded-xl';
    const width = this.fullWidth() ? 'w-full' : '';
    return `${base} ${sizes[this.size()]} ${variants[this.variant()]} ${shape} ${width}`;
  }

  protected onClick(event: MouseEvent): void {
    if (!this.disabled() && !this.loading()) {
      this.clickAction.emit(event);
    }
  }
}
