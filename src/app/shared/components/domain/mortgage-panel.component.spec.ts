import { describe, it, expect, beforeEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { MortgagePanelComponent, type MortgagePanelAction } from './mortgage-panel.component';
import type { CurrencyConfig, Edition, Player, PropertyMetadata } from '../../../core/models';

function makeEdition(): Edition {
  const properties: PropertyMetadata[] = [
    { id: 'a', name: 'Ronda', group: 'Marrón', groupColor: '#8B4513', order: 1, price: 60, mortgageValue: 30, houseCost: 50, hotelCost: 50, rents: [2, 10, 30, 90, 160, 250] },
    { id: 'b', name: 'Santander', group: 'Marrón', groupColor: '#8B4513', order: 3, price: 60, mortgageValue: 30, houseCost: 50, hotelCost: 50, rents: [4, 20, 60, 180, 320, 450] },
    { id: 'c', name: 'Gijón', group: 'Azul claro', groupColor: '#87CEEB', order: 6, price: 100, mortgageValue: 50, houseCost: 50, hotelCost: 50, rents: [6, 30, 90, 270, 400, 550] },
    { id: 'd', name: 'Oviedo', group: 'Azul claro', groupColor: '#87CEEB', order: 8, price: 100, mortgageValue: 50, houseCost: 50, hotelCost: 50, rents: [6, 30, 90, 270, 400, 550] },
  ];
  return {
    id: 'edition',
    name: 'Test',
    currency: { symbol: '$', code: 'USD', scale: 'units' },
    startingMoney: 1500,
    goSalary: 200,
    jailFine: 50,
    incomeTax: 200,
    luxuryTax: 75,
    properties,
  };
}

function makePlayer(
  properties: { propertyId: string; houses: number; hasHotel: boolean; mortgaged: boolean }[],
  cash = 500,
): Player {
  return {
    id: 'p1',
    name: 'Ana',
    avatarColor: 'bg-red-500',
    cash,
    properties,
    bankrupt: false,
    host: true,
    joinedAt: 0,
  };
}

describe('MortgagePanelComponent', () => {
  let fixture: ReturnType<typeof TestBed.createComponent<MortgagePanelComponent>>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [MortgagePanelComponent],
    });
    fixture = TestBed.createComponent(MortgagePanelComponent);
  });

  function setInputs(props: Parameters<typeof makePlayer>[0], cash?: number) {
    const edition = makeEdition();
    fixture.componentRef.setInput('edition', edition);
    fixture.componentRef.setInput('me', makePlayer(props, cash));
    fixture.componentRef.setInput('currency', edition.currency);
    fixture.detectChanges();
  }

  function items() {
    return (fixture.componentInstance as unknown as { items: () => { meta: PropertyMetadata; kind: string | null; amount: number; available: boolean; blockedReason: string | null; mortgaged: boolean }[] }).items();
  }

  function summary() {
    return (fixture.componentInstance as unknown as { summary: () => { total: number; mortgaged: number } }).summary();
  }

  it('maps free properties as available mortgage actions', () => {
    setInputs([{ propertyId: 'a', houses: 0, hasHotel: false, mortgaged: false }]);
    const list = items();
    expect(list).toHaveLength(1);
    expect(list[0].kind).toBe('mortgage');
    expect(list[0].amount).toBe(30);
    expect(list[0].available).toBe(true);
    expect(list[0].blockedReason).toBeNull();
  });

  it('maps mortgaged properties as available unmortgage actions', () => {
    setInputs([{ propertyId: 'a', houses: 0, hasHotel: false, mortgaged: true }], 500);
    const list = items();
    expect(list[0].kind).toBe('unmortgage');
    expect(list[0].amount).toBe(33); // round(30 * 1.1)
    expect(list[0].available).toBe(true);
  });

  it('blocks unmortgage when cash is insufficient', () => {
    setInputs([{ propertyId: 'a', houses: 0, hasHotel: false, mortgaged: true }], 30);
    const list = items();
    expect(list[0].kind).toBe('unmortgage');
    expect(list[0].available).toBe(false);
    expect(list[0].blockedReason).toBe('Dinero insuficiente');
  });

  it('blocks mortgage on properties with buildings', () => {
    setInputs([{ propertyId: 'a', houses: 2, hasHotel: false, mortgaged: false }]);
    const list = items();
    expect(list[0].kind).toBeNull();
    expect(list[0].available).toBe(false);
    expect(list[0].blockedReason).toBe('Vende primero las construcciones');
  });

  it('sorts actionable first, blocked after', () => {
    setInputs([
      { propertyId: 'b', houses: 1, hasHotel: false, mortgaged: false }, // blocked
      { propertyId: 'a', houses: 0, hasHotel: false, mortgaged: false }, // available
      { propertyId: 'c', houses: 0, hasHotel: false, mortgaged: true },  // available unmortgage
    ]);
    const list = items();
    expect(list.map((i) => i.meta.id)).toEqual(['a', 'c', 'b']);
  });

  it('computes summary counts', () => {
    setInputs([
      { propertyId: 'a', houses: 0, hasHotel: false, mortgaged: false },
      { propertyId: 'c', houses: 0, hasHotel: false, mortgaged: true },
    ]);
    expect(summary()).toEqual({ total: 2, mortgaged: 1 });
  });

  it('emits mortgage action', () => {
    setInputs([{ propertyId: 'a', houses: 0, hasHotel: false, mortgaged: false }]);
    let emitted: MortgagePanelAction | undefined;
    fixture.componentInstance.action.subscribe((a) => (emitted = a));
    const item = items()[0];
    (fixture.componentInstance as unknown as { runAction: (item: unknown) => void }).runAction(item);
    expect(emitted).toEqual({ kind: 'mortgage', propertyId: 'a' });
  });

  it('emits unmortgage action', () => {
    setInputs([{ propertyId: 'a', houses: 0, hasHotel: false, mortgaged: true }], 500);
    let emitted: MortgagePanelAction | undefined;
    fixture.componentInstance.action.subscribe((a) => (emitted = a));
    const item = items()[0];
    (fixture.componentInstance as unknown as { runAction: (item: unknown) => void }).runAction(item);
    expect(emitted).toEqual({ kind: 'unmortgage', propertyId: 'a' });
  });

  it('does not emit when busy', () => {
    setInputs([{ propertyId: 'a', houses: 0, hasHotel: false, mortgaged: false }]);
    fixture.componentRef.setInput('busy', true);
    fixture.detectChanges();
    let emitted = false;
    fixture.componentInstance.action.subscribe(() => (emitted = true));
    const item = items()[0];
    (fixture.componentInstance as unknown as { runAction: (item: unknown) => void }).runAction(item);
    expect(emitted).toBe(false);
  });
});
