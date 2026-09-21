import { MoneyFormatService } from './money-format.service';
import { SCALE_STEPS } from '../constants/scale-steps';
import type { CurrencyConfig, Edition } from '../models/edition.model';

const emptyEdition = (base: Partial<Edition> = {}): Edition => ({
  id: 'test',
  name: 'Test',
  currency: { symbol: '$', code: 'USD', scale: 'units' },
  startingMoney: 0,
  goSalary: 0,
  jailFine: 0,
  incomeTax: 0,
  luxuryTax: 0,
  properties: [],
  ...base,
});

describe('MoneyFormatService', () => {
  const service = new MoneyFormatService();

  const cases: { currency: CurrencyConfig; amount: number; expected: string }[] = [
    { currency: { symbol: '€', code: 'EUR', scale: 'units' }, amount: 1500, expected: '€1,500' },
    { currency: { symbol: '€', code: 'EUR', scale: 'units' }, amount: 999_999, expected: '€999,999' },
    { currency: { symbol: '$', code: 'USD', scale: 'thousands' }, amount: 1_500_000, expected: '$1,500k' },
    { currency: { symbol: 'M$', code: 'MILLION', scale: 'millions' }, amount: 0, expected: 'M$0' },
    { currency: { symbol: 'M$', code: 'MILLION', scale: 'millions' }, amount: 500, expected: 'M$500' },
    { currency: { symbol: 'M$', code: 'MILLION', scale: 'millions' }, amount: 20_000, expected: 'M$20k' },
    { currency: { symbol: 'M$', code: 'MILLION', scale: 'millions' }, amount: 280_000, expected: 'M$280k' },
    { currency: { symbol: 'M$', code: 'MILLION', scale: 'millions' }, amount: 1_180_000, expected: 'M$1.18M' },
    { currency: { symbol: 'M$', code: 'MILLION', scale: 'millions' }, amount: 999_999, expected: 'M$1M' },
    { currency: { symbol: 'M$', code: 'MILLION', scale: 'millions' }, amount: 150_000_000, expected: 'M$150M' },
    { currency: { symbol: 'M$', code: 'MILLION', scale: 'millions' }, amount: -20_000, expected: 'M$-20k' },
    { currency: { symbol: 'B$', code: 'BILLION', scale: 'billions' }, amount: 500_000_000, expected: 'B$500M' },
    { currency: { symbol: 'B$', code: 'BILLION', scale: 'billions' }, amount: 1_200_000_000, expected: 'B$1.2B' },
    { currency: { symbol: 'T$', code: 'TRILLION', scale: 'trillions' }, amount: 1_000_000_000_000, expected: 'T$1T' },
  ];

  it.each(cases)('formats $amount in $currency.scale as $expected', ({ currency, amount, expected }) => {
    expect(service.format(amount, currency)).toBe(expected);
  });

  it('parses display value back to internal units', () => {
    const currency: CurrencyConfig = { symbol: 'M$', code: 'MILLION', scale: 'millions' };
    expect(service.parse(150, currency)).toBe(150_000_000);
  });

  it('formats exact full value with thousands separators', () => {
    const currency: CurrencyConfig = { symbol: '$', code: 'USD', scale: 'millions' };
    expect(service.formatExact(1_180_000, currency)).toBe('$1,180,000');
    expect(service.formatExact(0, currency)).toBe('$0');
  });

  it('selects scale step matching currency scale', () => {
    expect(service.getScaleStep('units')).toBe(SCALE_STEPS[0]);
    expect(service.getScaleStep('thousands')).toBe(SCALE_STEPS[1]);
    expect(service.getScaleStep('millions')).toBe(SCALE_STEPS[2]);
    expect(service.getScaleStep('billions')).toBe(SCALE_STEPS[3]);
    expect(service.getScaleStep('trillions')).toBe(SCALE_STEPS[4]);
  });

  describe('computeScaleSteps', () => {
    it('units classic edition hides K/M buttons', () => {
      const edition = emptyEdition({
        currency: { symbol: '€', code: 'EUR', scale: 'units' },
        startingMoney: 1_500,
        goSalary: 200,
        properties: [{ id: 'p', name: 'X', group: 'A', groupColor: '#000', order: 1, price: 400, mortgageValue: 200, houseCost: 200, hotelCost: 200, rents: [2, 10, 30, 90, 160, 250] }],
      });
      const result = service.computeScaleSteps(edition);
      expect(result.steps).toEqual([SCALE_STEPS[0]]);
      expect(result.defaultStep).toBe(SCALE_STEPS[0]);
    });

    it('millions edition shows K and M, defaults to M', () => {
      const edition = emptyEdition({
        currency: { symbol: 'M$', code: 'MILLION', scale: 'millions' },
        startingMoney: 372_000_000,
        properties: [{ id: 'p', name: 'X', group: 'A', groupColor: '#000', order: 1, price: 400_000_000, mortgageValue: 200_000_000, houseCost: 40_000_000, hotelCost: 40_000_000, rents: [2_000_000, 10_000_000, 30_000_000, 90_000_000, 160_000_000, 250_000_000] }],
      });
      const result = service.computeScaleSteps(edition);
      expect(result.steps).toEqual([SCALE_STEPS[0], SCALE_STEPS[1], SCALE_STEPS[2]]);
      expect(result.defaultStep).toBe(SCALE_STEPS[2]);
    });

    it('does not show B for millions edition without billion amounts', () => {
      const edition = emptyEdition({
        currency: { symbol: 'M$', code: 'MILLION', scale: 'millions' },
        startingMoney: 372_000_000,
        properties: [{ id: 'p', name: 'X', group: 'A', groupColor: '#000', order: 1, price: 400_000_000, mortgageValue: 200_000_000, houseCost: 40_000_000, hotelCost: 40_000_000, rents: [2_000_000, 10_000_000, 30_000_000, 90_000_000, 160_000_000, 250_000_000] }],
      });
      expect(service.computeScaleSteps(edition).steps.some((s) => s.id === 'B')).toBe(false);
    });

    it('units edition with billion amounts shows K/M via data-driven rule', () => {
      const edition = emptyEdition({
        currency: { symbol: '$', code: 'USD', scale: 'units' },
        startingMoney: 2_000_000_000,
        properties: [{ id: 'p', name: 'X', group: 'A', groupColor: '#000', order: 1, price: 1_000_000_000, mortgageValue: 500_000_000, houseCost: 100_000_000, hotelCost: 100_000_000, rents: [10_000_000, 50_000_000, 150_000_000, 450_000_000, 800_000_000, 1_250_000_000] }],
      });
      const result = service.computeScaleSteps(edition);
      expect(result.steps).toContain(SCALE_STEPS[0]);
      expect(result.steps).toContain(SCALE_STEPS[1]);
      expect(result.steps).toContain(SCALE_STEPS[2]);
    });
  });
});
