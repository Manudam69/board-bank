import { describe, it, expect, beforeEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { BankPayPanelComponent } from './bank-pay-panel.component';
import { AmountInputComponent } from '../ui/amount-input.component';
import { ButtonComponent } from '../ui/button.component';
import { MoneyFormatService } from '../../../core/services/money-format.service';
import { CLASSIC_SPAIN } from '../../../core/constants/editions';
import type { Player } from '../../../core/models';

function makePlayers(): Player[] {
  return [
    { id: 'u1', name: 'Ana', avatarColor: 'bg-red-500', cash: 1500, properties: [], bankrupt: false, host: true, joinedAt: 0 },
    { id: 'u2', name: 'Ben', avatarColor: 'bg-blue-500', cash: 1000, properties: [], bankrupt: false, host: false, joinedAt: 0 },
    { id: 'u3', name: 'Cora', avatarColor: 'bg-green-500', cash: 800, properties: [], bankrupt: true, host: false, joinedAt: 0 },
  ];
}

describe('BankPayPanelComponent', () => {
  let fixture: ReturnType<typeof TestBed.createComponent<BankPayPanelComponent>>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [BankPayPanelComponent, AmountInputComponent, ButtonComponent],
      providers: [MoneyFormatService],
    });

    fixture = TestBed.createComponent(BankPayPanelComponent);
    fixture.componentRef.setInput('players', makePlayers());
    fixture.componentRef.setInput('currency', CLASSIC_SPAIN.currency);
    fixture.componentRef.setInput('edition', CLASSIC_SPAIN);
    fixture.detectChanges();
  });

  it('lists non-bankrupt players including the actor', () => {
    const buttons = Array.from(
      fixture.nativeElement.querySelectorAll('[role="radio"]'),
    ) as HTMLElement[];
    const labels = buttons.map((b) => b.textContent?.trim());
    expect(labels.some((l) => l?.includes('Ana'))).toBe(true);
    expect(labels.some((l) => l?.includes('Ben'))).toBe(true);
    expect(labels.some((l) => l?.includes('Cora'))).toBe(false);
  });

  it('renders edition-derived amount chips', () => {
    const chips = Array.from(
      fixture.nativeElement.querySelectorAll('[role="group"] button'),
    ) as HTMLElement[];
    const chipTexts = chips.map((c) => c.textContent?.trim());
    expect(chipTexts.length).toBeGreaterThan(0);
    // CLASSIC_SPAIN chips: 200, 200, 100, 50 => unique 200, 100, 50
    expect(chipTexts.some((t) => t?.includes('200'))).toBe(true);
    expect(chipTexts.some((t) => t?.includes('100'))).toBe(true);
    expect(chipTexts.some((t) => t?.includes('50'))).toBe(true);
  });

  it('selects a player', () => {
    const benButton = Array.from(
      fixture.nativeElement.querySelectorAll('[role="radio"]'),
    ).find((b) => (b as HTMLElement).textContent?.includes('Ben')) as HTMLElement;
    benButton.click();
    fixture.detectChanges();
    expect(fixture.componentInstance['toId']()).toBe('u2');
  });

  it('sets amount from a chip and toggles it off', () => {
    const chip = Array.from(
      fixture.nativeElement.querySelectorAll('[role="group"] button'),
    )[0] as HTMLElement;
    chip.click();
    fixture.detectChanges();
    expect(fixture.componentInstance.amount()).toBeGreaterThan(0);

    chip.click();
    fixture.detectChanges();
    expect(fixture.componentInstance.amount()).toBe(0);
  });

  it('disables submit until a player and a positive amount are selected', () => {
    const getDisabled = () =>
      fixture.debugElement.query(By.css('app-button')).componentInstance.disabled();

    expect(getDisabled()).toBe(true);

    const benButton = Array.from(
      fixture.nativeElement.querySelectorAll('[role="radio"]'),
    ).find((b) => (b as HTMLElement).textContent?.includes('Ben')) as HTMLElement;
    benButton.click();
    fixture.detectChanges();
    expect(getDisabled()).toBe(true);

    const chip = Array.from(
      fixture.nativeElement.querySelectorAll('[role="group"] button'),
    )[0] as HTMLElement;
    chip.click();
    fixture.detectChanges();
    expect(getDisabled()).toBe(false);
  });

  it('emits payAction and resets form', () => {
    const emitted: { toId: string; amount: number; reason: string }[] = [];
    fixture.componentInstance.payAction.subscribe((e) => emitted.push(e));

    const benButton = Array.from(
      fixture.nativeElement.querySelectorAll('[role="radio"]'),
    ).find((b) => (b as HTMLElement).textContent?.includes('Ben')) as HTMLElement;
    benButton.click();

    const chip = Array.from(
      fixture.nativeElement.querySelectorAll('[role="group"] button'),
    )[0] as HTMLElement;
    chip.click();

    fixture.componentInstance.reason.set('Premio');
    fixture.detectChanges();

    fixture.componentInstance.submit();

    expect(emitted).toHaveLength(1);
    expect(emitted[0].toId).toBe('u2');
    expect(emitted[0].amount).toBeGreaterThan(0);
    expect(emitted[0].reason).toBe('Premio');

    expect(fixture.componentInstance['toId']()).toBeUndefined();
    expect(fixture.componentInstance.amount()).toBe(0);
  });
});
