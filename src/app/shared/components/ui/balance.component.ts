import { Component, computed, effect, input, signal } from '@angular/core';
import { MoneyDisplayComponent } from '../domain/money-display.component';
import { MoneyPipe } from '../../pipes/money.pipe';
import { ICONS } from '../../icons';
import type { CurrencyConfig } from '../../../core/models';

@Component({
  selector: 'app-balance',
  standalone: true,
  imports: [MoneyDisplayComponent, MoneyPipe],
  templateUrl: './balance.component.html',
})
export class BalanceComponent {
  readonly amount = input.required<number>();
  readonly currency = input.required<CurrencyConfig>();
  readonly size = input<'sm' | 'md' | 'lg' | 'xl'>('md');

  protected readonly delta = signal<{ value: number; trigger: number } | null>(null);
  protected readonly icons = ICONS;
  private lastAmount: number | undefined;

  constructor() {
    effect(() => {
      const current = this.amount();
      if (this.lastAmount !== undefined) {
        const diff = current - this.lastAmount;
        if (diff !== 0) {
          this.delta.set({ value: diff, trigger: Date.now() });
        }
      }
      this.lastAmount = current;
    });
  }

  protected deltaFormatted = computed(() => {
    const d = this.delta();
    return d && d.value !== 0 ? d.value : null;
  });

  protected deltaPositive = computed(() => (this.delta()?.value ?? 0) > 0);
}
