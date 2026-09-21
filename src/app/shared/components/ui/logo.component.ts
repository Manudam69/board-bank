import { Component, computed, input } from '@angular/core';

type LogoSize = 'sm' | 'md' | 'lg' | 'xl';

@Component({
  selector: 'app-logo',
  template: `
    <svg
      [attr.class]="sizeClass()"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"
    >
      <path d="M3 4h18a2 2 0 012 2v12a2 2 0 01-2 2H3a2 2 0 01-2-2V6a2 2 0 012-2z" />
      <path d="M3 8h20" />
      <path d="M12 13a3 3 0 100-6 3 3 0 000 6z" />
    </svg>
  `,
})
export class LogoComponent {
  readonly size = input<LogoSize>('md');

  protected sizeClass = computed(() => {
    const map: Record<LogoSize, string> = {
      sm: 'h-5 w-5',
      md: 'h-6 w-6',
      lg: 'h-8 w-8',
      xl: 'h-12 w-12',
    };
    return map[this.size()];
  });
}
