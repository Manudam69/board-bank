import { Injectable } from '@angular/core';
import { SCALE_STEPS, type ScaleStep } from '../constants/scale-steps';
import type { CurrencyConfig, Edition } from '../models/edition.model';

export interface ScaleSelection {
  steps: readonly ScaleStep[];
  defaultStep: ScaleStep;
}

@Injectable({ providedIn: 'root' })
export class MoneyFormatService {
  private readonly scales: Record<CurrencyConfig['scale'], number> = {
    units: 1,
    thousands: 1_000,
    millions: 1_000_000,
    billions: 1_000_000_000,
    trillions: 1_000_000_000_000,
  };

  private readonly suffixes: Record<CurrencyConfig['scale'], string> = {
    units: '',
    thousands: 'k',
    millions: 'M',
    billions: 'B',
    trillions: 'T',
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

  formatExact(amount: number, currency: CurrencyConfig): string {
    const value = Math.max(0, Math.round(amount));
    const withGroups = value.toLocaleString('es-ES', {
      maximumFractionDigits: 0,
    });
    return `${currency.symbol}${withGroups}`;
  }

  computeScaleSteps(edition: Edition): ScaleSelection {
    const base = SCALE_STEPS[0];
    const scaleStep = this.getScaleStep(edition.currency.scale);
    const maxAmount = this.estimateMaxAmount(edition);

    const availableSteps = SCALE_STEPS.filter((step) => {
      if (step.id === '') return true;
      if (step.id === scaleStep.id) return true;
      return maxAmount >= step.factor * 10;
    });

    const steps = availableSteps.length > 1 ? availableSteps : [base];
    const defaultStep = steps.find((s) => s.id === scaleStep.id) ?? steps[steps.length - 1];

    return { steps, defaultStep };
  }

  getScaleStep(scale: CurrencyConfig['scale']): ScaleStep {
    return SCALE_STEPS.find((s) => s.factor === this.scales[scale]) ?? SCALE_STEPS[0];
  }

  private estimateMaxAmount(edition: Edition): number {
    const propertyMax = Math.max(
      ...edition.properties.map((p) =>
        Math.max(p.price, p.mortgageValue, p.houseCost, p.hotelCost, ...p.rents),
      ),
      0,
    );
    return Math.max(
      edition.startingMoney,
      edition.goSalary * 5,
      edition.jailFine * 10,
      edition.incomeTax * 10,
      edition.luxuryTax * 10,
      propertyMax,
    );
  }
}
