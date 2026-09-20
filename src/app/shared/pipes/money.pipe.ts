import { Pipe, type PipeTransform } from '@angular/core';
import { MoneyFormatService } from '../../core/services/money-format.service';
import type { CurrencyConfig } from '../../core/models/edition.model';

@Pipe({
  name: 'money',
  standalone: true,
})
export class MoneyPipe implements PipeTransform {
  constructor(private readonly formatter: MoneyFormatService) {}

  transform(amount: number, currency: CurrencyConfig): string {
    return this.formatter.format(amount, currency);
  }
}
