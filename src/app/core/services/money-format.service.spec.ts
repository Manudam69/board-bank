import { MoneyFormatService } from './money-format.service';
import type { CurrencyConfig } from '../models/edition.model';

describe('MoneyFormatService', () => {
  const service = new MoneyFormatService();

  const cases: { currency: CurrencyConfig; amount: number; expected: string }[] = [
    { currency: { symbol: '€', code: 'EUR', scale: 'units' }, amount: 1500, expected: '€1.500' },
    { currency: { symbol: '$', code: 'USD', scale: 'thousands' }, amount: 1_500_000, expected: '$1.500k' },
    { currency: { symbol: 'M$', code: 'MILLION', scale: 'millions' }, amount: 150_000_000, expected: 'M$150M' },
  ];

  it.each(cases)('formats $amount in $currency.scale as $expected', ({ currency, amount, expected }) => {
    expect(service.format(amount, currency)).toBe(expected);
  });

  it('parses display value back to internal units', () => {
    const currency: CurrencyConfig = { symbol: 'M$', code: 'MILLION', scale: 'millions' };
    expect(service.parse(150, currency)).toBe(150_000_000);
  });
});
