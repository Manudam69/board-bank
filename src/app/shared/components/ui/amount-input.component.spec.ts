import { describe, it, expect, beforeEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { AmountInputComponent } from './amount-input.component';
import { MoneyFormatService } from '../../../core/services/money-format.service';
import { SCALE_STEPS } from '../../../core/constants/scale-steps';
import type { CurrencyConfig, Edition } from '../../../core/models/edition.model';

const currency: CurrencyConfig = { symbol: '$', code: 'USD', scale: 'millions' };

const edition = (base: Partial<Edition> = {}): Edition => ({
  id: 'test',
  name: 'Test',
  currency,
  startingMoney: 372_000_000,
  goSalary: 2_000_000,
  jailFine: 1_000_000,
  incomeTax: 1_000_000,
  luxuryTax: 1_500_000,
  properties: [
    {
      id: 'p',
      name: 'X',
      group: 'A',
      groupColor: '#000',
      order: 1,
      price: 400_000_000,
      mortgageValue: 200_000_000,
      houseCost: 40_000_000,
      hotelCost: 40_000_000,
      rents: [2_000_000, 10_000_000, 30_000_000, 90_000_000, 160_000_000, 250_000_000],
    },
  ],
  ...base,
});

describe('AmountInputComponent', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [MoneyFormatService],
    });
  });

  it('typing 1.18 with M selected computes 1.180.000', async () => {
    const fixture = TestBed.createComponent(AmountInputComponent);
    fixture.componentRef.setInput('currency', currency);
    fixture.componentRef.setInput('edition', edition());
    fixture.detectChanges();
    await fixture.whenStable();

    const input = fixture.nativeElement.querySelector('input');
    input.value = '1,18';
    input.dispatchEvent(new InputEvent('input'));
    fixture.detectChanges();
    await fixture.whenStable();

    expect(fixture.componentInstance.amount()).toBe(1_180_000);
    expect(fixture.nativeElement.textContent).toContain('$1.180.000');
  });

  it('switching scale keeps mantissa and recomputes value', async () => {
    const fixture = TestBed.createComponent(AmountInputComponent);
    fixture.componentRef.setInput('currency', currency);
    fixture.componentRef.setInput('edition', edition());
    fixture.detectChanges();
    await fixture.whenStable();

    const input = fixture.nativeElement.querySelector('input');
    input.value = '1,18';
    input.dispatchEvent(new InputEvent('input'));
    fixture.detectChanges();
    await fixture.whenStable();

    expect(fixture.componentInstance.amount()).toBe(1_180_000);

    const kButton = fixture.nativeElement.querySelector('button[role="radio"]:nth-of-type(2)');
    expect(kButton.textContent.trim()).toBe('K');
    kButton.click();
    fixture.detectChanges();
    await fixture.whenStable();

    expect(fixture.componentInstance.amount()).toBe(1_180);
  });

  it('typing suffix in input selects scale automatically', async () => {
    const fixture = TestBed.createComponent(AmountInputComponent);
    fixture.componentRef.setInput('currency', currency);
    fixture.componentRef.setInput('edition', edition());
    fixture.detectChanges();
    await fixture.whenStable();

    const input = fixture.nativeElement.querySelector('input');
    input.value = '500k';
    input.dispatchEvent(new InputEvent('input'));
    fixture.detectChanges();
    await fixture.whenStable();

    expect(fixture.componentInstance.amount()).toBe(500_000);
    expect(input.value).toBe('500');
  });

  it('shows error state when amount exceeds max', async () => {
    const fixture = TestBed.createComponent(AmountInputComponent);
    fixture.componentRef.setInput('currency', currency);
    fixture.componentRef.setInput('edition', edition());
    fixture.componentRef.setInput('max', 1_000_000);
    fixture.detectChanges();
    await fixture.whenStable();

    const input = fixture.nativeElement.querySelector('input');
    input.value = '2';
    input.dispatchEvent(new InputEvent('input'));
    fixture.detectChanges();
    await fixture.whenStable();

    expect(fixture.componentInstance.exceedsMax()).toBe(true);
    expect(fixture.nativeElement.textContent).toContain('No tienes suficiente dinero');
  });

  it('hides scale buttons for units edition with small amounts', async () => {
    const fixture = TestBed.createComponent(AmountInputComponent);
    fixture.componentRef.setInput('currency', { symbol: '€', code: 'EUR', scale: 'units' });
    fixture.componentRef.setInput(
      'edition',
      edition({
        currency: { symbol: '€', code: 'EUR', scale: 'units' },
        startingMoney: 1_500,
        goSalary: 0,
        jailFine: 0,
        incomeTax: 0,
        luxuryTax: 0,
        properties: [
          {
            id: 'p',
            name: 'X',
            group: 'A',
            groupColor: '#000',
            order: 1,
            price: 400,
            mortgageValue: 200,
            houseCost: 200,
            hotelCost: 200,
            rents: [2, 10, 30, 90, 160, 250],
          },
        ],
      }),
    );
    fixture.detectChanges();
    await fixture.whenStable();

    const radios = fixture.nativeElement.querySelectorAll('button[role="radio"]');
    expect(radios.length).toBe(0);
    expect(fixture.nativeElement.textContent).toContain('—');
  });

  it('defaults to scale matching currency scale', async () => {
    const fixture = TestBed.createComponent(AmountInputComponent);
    fixture.componentRef.setInput('currency', currency);
    fixture.componentRef.setInput('edition', edition());
    fixture.detectChanges();
    await fixture.whenStable();

    expect(fixture.componentInstance.selectedStep()).toBe(SCALE_STEPS[2]);
  });
});
