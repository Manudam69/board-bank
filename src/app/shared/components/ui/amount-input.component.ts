import { Component, computed, inject, input, model, output } from '@angular/core';
import type { CurrencyConfig } from '../../../core/models/edition.model';
import { MoneyFormatService } from '../../../core/services/money-format.service';

@Component({
  selector: 'app-amount-input',
  standalone: true,
  templateUrl: './amount-input.component.html',
})
export class AmountInputComponent {
  private readonly formatter = inject(MoneyFormatService);

  readonly currency = input.required<CurrencyConfig>();
  readonly label = input('Cantidad');
  readonly placeholder = input('0');
  readonly min = input(0);
  readonly max = input<number | undefined>(undefined);
  readonly step = input(1);
  readonly amount = model(0);
  readonly disabled = input(false);

  protected preview = computed(() => this.formatter.format(this.amount(), this.currency()));

  protected onInput(value: string): void {
    const parsed = value === '' ? 0 : Number(value);
    if (!Number.isNaN(parsed)) {
      this.amount.set(parsed);
    }
  }

  protected adjust(delta: number): void {
    const next = Math.max(0, this.amount() + delta);
    this.amount.set(next);
  }
}
