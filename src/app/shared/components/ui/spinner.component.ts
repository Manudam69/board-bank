import { Component, input } from '@angular/core';

@Component({
  selector: 'app-spinner',
  standalone: true,
  templateUrl: './spinner.component.html',
})
export class SpinnerComponent {
  readonly size = input<'sm' | 'md' | 'lg'>('md');
  readonly label = input('Cargando...');

  protected sizeClass(): string {
    const map = { sm: 'h-4 w-4', md: 'h-6 w-6', lg: 'h-8 w-8' };
    return map[this.size()];
  }
}
