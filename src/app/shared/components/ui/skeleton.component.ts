import { Component, input } from '@angular/core';

@Component({
  selector: 'app-skeleton',
  standalone: true,
  templateUrl: './skeleton.component.html',
})
export class SkeletonComponent {
  readonly variant = input<'line' | 'card' | 'circle' | 'text'>('line');
  readonly count = input(1);
  readonly width = input<string>('100%');

  protected items(): number[] {
    return Array.from({ length: this.count() }, (_, i) => i);
  }
}
