import { Component, computed, inject, input } from '@angular/core';
import type { CurrencyConfig } from '../../../core/models/edition.model';
import { MoneyFormatService } from '../../../core/services/money-format.service';

@Component({
  selector: 'app-money-display',
  standalone: true,
  templateUrl: './money-display.component.html',
})
export class MoneyDisplayComponent {
  private readonly formatter = inject(MoneyFormatService);

  readonly amount = input.required<number>();
  readonly currency = input.required<CurrencyConfig>();
  readonly size = input<'sm' | 'md' | 'lg' | 'xl'>('md');
  readonly positiveClass = input('text-positive');
  readonly negativeClass = input('text-negative');

  protected formatted = computed(() => this.formatter.format(this.amount(), this.currency()));

  protected textClasses(): string {
    const map = {
      sm: 'text-sm',
      md: 'text-base',
      lg: 'text-2xl',
      xl: 'text-4xl',
    };
    const color = this.amount() < 0 ? this.negativeClass() : this.positiveClass();
    return `font-bold tabular-nums ${map[this.size()]} ${color}`;
  }
}
