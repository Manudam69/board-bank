import { Injectable } from '@angular/core';
import type { CurrencyConfig } from '../models/edition.model';

@Injectable({ providedIn: 'root' })
export class MoneyFormatService {
  private readonly scales: Record<CurrencyConfig['scale'], number> = {
    units: 1,
    thousands: 1_000,
    millions: 1_000_000,
  };

  private readonly suffixes: Record<CurrencyConfig['scale'], string> = {
    units: '',
    thousands: 'k',
    millions: 'M',
  };

  format(amount: number, currency: CurrencyConfig): string {
    const divisor = this.scales[currency.scale];
    const scaled = amount / divisor;
    const suffix = this.suffixes[currency.scale];
    const scaledFixed = scaled.toFixed(2);
    const [intPart, decPart] = scaledFixed.split('.');
    const withGroups = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
    const trimmedDecimals = decPart === '00' ? '' : `,${decPart.replace(/0+$/, '')}`;
    return `${currency.symbol}${withGroups}${trimmedDecimals}${suffix}`;
  }

  parse(value: number, currency: CurrencyConfig): number {
    return Math.round(value * this.scales[currency.scale]);
  }
}
