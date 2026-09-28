import { describe, it, expect, beforeEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { BuildManagerComponent, type PropertyCard, type BuildManagerAction } from './build-manager.component';
import { BuildingRulesService } from '../../../core/services/building-rules.service';
import type { CurrencyConfig, Edition, Player, PropertyMetadata } from '../../../core/models';

function makeEdition(): Edition {
  const properties: PropertyMetadata[] = [
    { id: 'a', name: 'Ronda', group: 'Marrón', groupColor: '#8B4513', order: 1, price: 60, mortgageValue: 30, houseCost: 50, hotelCost: 50, rents: [2, 10, 30, 90, 160, 250] },
    { id: 'b', name: 'Santander', group: 'Marrón', groupColor: '#8B4513', order: 2, price: 60, mortgageValue: 30, houseCost: 50, hotelCost: 50, rents: [4, 20, 60, 180, 320, 450] },
    { id: 'c', name: 'Gijón', group: 'Azul claro', groupColor: '#87CEEB', order: 3, price: 100, mortgageValue: 50, houseCost: 50, hotelCost: 50, rents: [6, 30, 90, 270, 400, 550] },
    { id: 'd', name: 'Oviedo', group: 'Azul claro', groupColor: '#87CEEB', order: 4, price: 100, mortgageValue: 50, houseCost: 50, hotelCost: 50, rents: [6, 30, 90, 270, 400, 550] },
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

function makePlayer(properties: { propertyId: string; houses: number; hasHotel: boolean; mortgaged: boolean }[], cash = 500): Player {
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

describe('BuildManagerComponent', () => {
  let fixture: ReturnType<typeof TestBed.createComponent<BuildManagerComponent>>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [BuildManagerComponent],
      providers: [BuildingRulesService],
    });
    fixture = TestBed.createComponent(BuildManagerComponent);
  });

  function setInputs(cash: number, props: { propertyId: string; houses: number; hasHotel: boolean; mortgaged: boolean }[], initial?: string) {
    const edition = makeEdition();
    fixture.componentRef.setInput('edition', edition);
    fixture.componentRef.setInput('me', makePlayer(props, cash));
    fixture.componentRef.setInput('currency', edition.currency);
    if (initial) fixture.componentRef.setInput('initialPropertyId', initial);
    fixture.detectChanges();
  }

  it('maps level 0-3 cards to build-house primary action', () => {
    setInputs(500, [
      { propertyId: 'a', houses: 1, hasHotel: false, mortgaged: false },
      { propertyId: 'b', houses: 1, hasHotel: false, mortgaged: false },
    ]);
    const cards = (fixture.componentInstance as unknown as { propertyCards: () => PropertyCard[] }).propertyCards();
    expect(cards).toHaveLength(2);
    expect(cards[0].primaryAction?.id).toBe('build-house');
    expect(cards[0].primaryAction?.label).toBe('+ Casa');
  });

  it('maps level 0 cards to disabled sell-house action', () => {
    setInputs(500, [
      { propertyId: 'a', houses: 0, hasHotel: false, mortgaged: false },
      { propertyId: 'b', houses: 0, hasHotel: false, mortgaged: false },
    ]);
    const cards = (fixture.componentInstance as unknown as { propertyCards: () => PropertyCard[] }).propertyCards();
    expect(cards[0].sellAction?.id).toBe('sell-house');
    expect(cards[0].sellAction?.available).toBe(false);
    expect(cards[0].sellAction?.shortReason).toBe('Sin casas');
  });

  it('maps level 4 card to build-hotel primary action', () => {
    setInputs(500, [
      { propertyId: 'a', houses: 4, hasHotel: false, mortgaged: false },
      { propertyId: 'b', houses: 4, hasHotel: false, mortgaged: false },
    ]);
    const cards = (fixture.componentInstance as unknown as { propertyCards: () => PropertyCard[] }).propertyCards();
    expect(cards[0].primaryAction?.id).toBe('build-hotel');
    expect(cards[0].primaryAction?.label).toBe('+ Hotel');
  });

  it('maps level 5 (hotel) card to sell-hotel action', () => {
    setInputs(500, [
      { propertyId: 'a', houses: 0, hasHotel: true, mortgaged: false },
      { propertyId: 'b', houses: 4, hasHotel: false, mortgaged: false },
    ]);
    const cards = (fixture.componentInstance as unknown as { propertyCards: () => PropertyCard[] }).propertyCards();
    const hotelCard = cards.find((c) => c.meta.id === 'a')!;
    expect(hotelCard.primaryAction).toBeUndefined();
    expect(hotelCard.sellAction?.id).toBe('sell-hotel');
    expect(hotelCard.sellAction?.label).toBe('− Hotel');
  });

  it('does not expose actions on incomplete groups', () => {
    setInputs(500, [{ propertyId: 'a', houses: 0, hasHotel: false, mortgaged: false }]);
    const cards = (fixture.componentInstance as unknown as { propertyCards: () => PropertyCard[] }).propertyCards();
    expect(cards[0].primaryAction).toBeUndefined();
    expect(cards[0].sellAction).toBeUndefined();
    expect((fixture.componentInstance as unknown as { selectedGroup: () => { canBuild: boolean } }).selectedGroup()?.canBuild).toBe(false);
  });

  it('marks the initial property as entry', () => {
    setInputs(500, [
      { propertyId: 'a', houses: 1, hasHotel: false, mortgaged: false },
      { propertyId: 'b', houses: 1, hasHotel: false, mortgaged: false },
    ], 'b');
    const cards = (fixture.componentInstance as unknown as { propertyCards: () => PropertyCard[] }).propertyCards();
    expect(cards.find((c) => c.meta.id === 'a')?.isEntry).toBe(false);
    expect(cards.find((c) => c.meta.id === 'b')?.isEntry).toBe(true);
  });

  it('emits action directly when runAction is called', () => {
    setInputs(500, [
      { propertyId: 'a', houses: 1, hasHotel: false, mortgaged: false },
      { propertyId: 'b', houses: 1, hasHotel: false, mortgaged: false },
    ]);
    let emitted: unknown;
    fixture.componentInstance.action.subscribe((a) => (emitted = a));
    (fixture.componentInstance as unknown as { runAction: (id: string, kind: BuildManagerAction['kind']) => void }).runAction('a', 'sell-house');
    expect(emitted).toEqual({ kind: 'sell-house', propertyId: 'a' });
  });

  it('does not emit when busy', () => {
    setInputs(500, [
      { propertyId: 'a', houses: 1, hasHotel: false, mortgaged: false },
      { propertyId: 'b', houses: 1, hasHotel: false, mortgaged: false },
    ]);
    fixture.componentRef.setInput('busy', true);
    fixture.detectChanges();
    let emitted = false;
    fixture.componentInstance.action.subscribe(() => (emitted = true));
    (fixture.componentInstance as unknown as { runAction: (id: string, kind: BuildManagerAction['kind']) => void }).runAction('a', 'build-house');
    expect(emitted).toBe(false);
  });

  it('keeps the selected group when inputs update after building', () => {
    setInputs(500, [
      { propertyId: 'a', houses: 1, hasHotel: false, mortgaged: false },
      { propertyId: 'b', houses: 1, hasHotel: false, mortgaged: false },
      { propertyId: 'c', houses: 0, hasHotel: false, mortgaged: false },
      { propertyId: 'd', houses: 0, hasHotel: false, mortgaged: false },
    ]);
    const comp = fixture.componentInstance as unknown as {
      selectGroup: (g: string) => void;
      selectedGroupId: () => string;
    };

    expect(comp.selectedGroupId()).toBe('Azul claro');
    comp.selectGroup('Marrón');
    fixture.detectChanges();
    expect(comp.selectedGroupId()).toBe('Marrón');

    // Simulate the room update after building a house on 'a'.
    fixture.componentRef.setInput(
      'me',
      makePlayer(
        [
          { propertyId: 'a', houses: 2, hasHotel: false, mortgaged: false },
          { propertyId: 'b', houses: 1, hasHotel: false, mortgaged: false },
          { propertyId: 'c', houses: 0, hasHotel: false, mortgaged: false },
          { propertyId: 'd', houses: 0, hasHotel: false, mortgaged: false },
        ],
        450,
      ),
    );
    fixture.detectChanges();

    expect(comp.selectedGroupId()).toBe('Marrón');
  });
});
