import { describe, it, expect } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { BuildingRulesService, type BuildingLevel } from './building-rules.service';
import type { Edition, Player, PlayerProperty, PropertyMetadata } from '../models';

function makeEdition(props: Partial<PropertyMetadata>[] = []): Edition {
  const defaults: PropertyMetadata[] = [
    { id: 'a', name: 'A', group: 'G1', groupColor: '#8B4513', order: 1, price: 60, mortgageValue: 30, houseCost: 50, hotelCost: 50, rents: [2, 10, 30, 90, 160, 250] },
    { id: 'b', name: 'B', group: 'G1', groupColor: '#8B4513', order: 2, price: 60, mortgageValue: 30, houseCost: 50, hotelCost: 50, rents: [4, 20, 60, 180, 320, 450] },
    { id: 'c', name: 'C', group: 'G1', groupColor: '#8B4513', order: 3, price: 80, mortgageValue: 40, houseCost: 50, hotelCost: 50, rents: [6, 30, 90, 270, 400, 550] },
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
    properties: props.length ? (props as PropertyMetadata[]) : defaults,
    readonly: true,
  };
}

function makePlayer(properties: PlayerProperty[], cash = 1500): Player {
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

function prop(id: string, houses: number, hasHotel = false, mortgaged = false): PlayerProperty {
  return { propertyId: id, houses, hasHotel, mortgaged };
}

describe('BuildingRulesService', () => {
  let service: BuildingRulesService;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [BuildingRulesService] });
    service = TestBed.inject(BuildingRulesService);
  });

  describe('nivel efectivo', () => {
    it('hotel cuenta como nivel 5', () => {
      expect(service.levelOf(prop('x', 0, true))).toBe(5);
      expect(service.levelOf(prop('x', 4, false))).toBe(4);
      expect(service.levelOf(prop('x', 0, false))).toBe(0);
    });
  });

  describe('validación de distribución uniforme', () => {
    it.each([
      [[0, 0, 0] as BuildingLevel[], true],
      [[1, 0, 0] as BuildingLevel[], true],
      [[1, 1, 0] as BuildingLevel[], true],
      [[1, 1, 1] as BuildingLevel[], true],
      [[2, 1, 1] as BuildingLevel[], true],
      [[2, 2, 1] as BuildingLevel[], true],
      [[2, 2, 2] as BuildingLevel[], true],
      [[3, 2, 2] as BuildingLevel[], true],
      [[3, 3, 2] as BuildingLevel[], true],
      [[3, 3, 3] as BuildingLevel[], true],
      [[2, 0, 0] as BuildingLevel[], false],
      [[3, 1, 1] as BuildingLevel[], false],
      [[3, 1, 2] as BuildingLevel[], false],
      [[5, 3, 3] as BuildingLevel[], false],
    ])('%s → %s', (levels, expected) => {
      // @ts-expect-error método privado
      expect(service.validBuildingDistribution(levels)).toBe(expected);
    });
  });

  describe('canBuildHouse', () => {
    const edition = makeEdition();

    it.each([
      ['0-0-0', [0, 0, 0], 'a', true],
      ['1-0-0 solo en 0s', [1, 0, 0], 'a', false],
      ['1-0-0 solo en 0s', [1, 0, 0], 'b', true],
      ['1-1-0 solo en 0', [1, 1, 0], 'a', false],
      ['1-1-0 solo en 0', [1, 1, 0], 'c', true],
      ['1-1-1 en cualquiera', [1, 1, 1], 'b', true],
      ['2-1-1 solo en 1s', [2, 1, 1], 'a', false],
      ['2-1-1 solo en 1s', [2, 1, 1], 'b', true],
      ['2-2-1 solo en 1', [2, 2, 1], 'c', true],
      ['2-2-2 en cualquiera', [2, 2, 2], 'a', true],
    ])('%s (prop %s) → %s', (_label, houses, targetId, expected) => {
      const player = makePlayer([
        prop('a', houses[0]),
        prop('b', houses[1]),
        prop('c', houses[2]),
      ]);
      const result = service.canBuildHouse(player, edition, targetId);
      expect(result.available).toBe(expected);
    });

    it('bloquea sin dinero suficiente', () => {
      const player = makePlayer([prop('a', 0), prop('b', 0), prop('c', 0)], 30);
      const result = service.canBuildHouse(player, edition, 'a');
      expect(result.available).toBe(false);
      expect(result.reason).toContain('Dinero insuficiente');
    });

    it('bloquea si no se posee el grupo completo', () => {
      const player = makePlayer([prop('a', 0), prop('b', 0)]); // falta c
      const result = service.canBuildHouse(player, edition, 'a');
      expect(result.available).toBe(false);
      expect(result.reason).toContain('todas las propiedades');
    });

    it('bloquea si hay hipoteca en el grupo', () => {
      const player = makePlayer([prop('a', 0), prop('b', 0), prop('c', 0, false, true)]);
      const result = service.canBuildHouse(player, edition, 'a');
      expect(result.available).toBe(false);
      expect(result.reason).toContain('hipotecadas');
    });

    it('bloquea en propiedad con hotel', () => {
      const player = makePlayer([prop('a', 0, true), prop('b', 4), prop('c', 4)]);
      const result = service.canBuildHouse(player, edition, 'a');
      expect(result.available).toBe(false);
      expect(result.reason).toContain('hotel');
    });

    it('a 4 casas sugiere hotel', () => {
      const player = makePlayer([prop('a', 4), prop('b', 4), prop('c', 4)]);
      const result = service.canBuildHouse(player, edition, 'a');
      expect(result.available).toBe(false);
      expect(result.reason).toContain('hotel');
    });
  });

  describe('canBuildHotel', () => {
    const edition = makeEdition();

    it('permite cuando todo el grupo está a 4', () => {
      const player = makePlayer([prop('a', 4), prop('b', 4), prop('c', 4)], 200);
      const result = service.canBuildHotel(player, edition, 'a');
      expect(result.available).toBe(true);
    });

    it('permite segundo hotel manteniendo uniformidad (5-4-4 → 5-5-4)', () => {
      const player = makePlayer([prop('a', 0, true), prop('b', 4), prop('c', 4)], 200);
      const result = service.canBuildHotel(player, edition, 'b');
      expect(result.available).toBe(true);
    });

    it('bloquea si falta alguna propiedad a 4', () => {
      const player = makePlayer([prop('a', 4), prop('b', 3), prop('c', 4)], 200);
      const result = service.canBuildHotel(player, edition, 'a');
      expect(result.available).toBe(false);
      expect(result.reason).toContain('todo el grupo');
    });

    it('bloquea sin dinero', () => {
      const player = makePlayer([prop('a', 4), prop('b', 4), prop('c', 4)], 10);
      const result = service.canBuildHotel(player, edition, 'a');
      expect(result.available).toBe(false);
      expect(result.reason).toContain('Dinero insuficiente');
    });
  });

  describe('canSellHouse', () => {
    const edition = makeEdition();

    it.each([
      ['2-2-1 vende de 2 válido', [2, 2, 1], 'a', true],
      ['2-2-1 vende de 2 válido', [2, 2, 1], 'b', true],
      ['2-2-1 vende de 1 inválido', [2, 2, 1], 'c', false],
      ['2-1-1 vende de 2 válido', [2, 1, 1], 'a', true],
      ['1-1-1 vende de cualquiera válido', [1, 1, 1], 'b', true],
      ['3-2-2 vende del 3 válido', [3, 2, 2], 'a', true],
      ['3-2-2 vende del 2 inválido', [3, 2, 2], 'b', false],
    ])('%s', (_label, houses, targetId, expected) => {
      const player = makePlayer([
        prop('a', houses[0]),
        prop('b', houses[1]),
        prop('c', houses[2]),
      ]);
      const result = service.canSellHouse(player, edition, targetId);
      expect(result.available).toBe(expected);
    });

    it('bloquea venta de casa mientras hay hotel', () => {
      const player = makePlayer([prop('a', 0, true), prop('b', 4), prop('c', 4)]);
      const result = service.canSellHouse(player, edition, 'b');
      expect(result.available).toBe(false);
      expect(result.reason).toContain('Vende primero el hotel');
    });
  });

  describe('canSellHotel', () => {
    const edition = makeEdition();

    it('permite vender hotel que vuelve a 4 casas', () => {
      const player = makePlayer([prop('a', 0, true), prop('b', 4), prop('c', 4)]);
      const result = service.canSellHotel(player, edition, 'a');
      expect(result.available).toBe(true);
      expect(result.refund).toBe(25); // hotelCost 50 / 2
    });

    it('bloquea si no hay hotel', () => {
      const player = makePlayer([prop('a', 4), prop('b', 4), prop('c', 4)]);
      const result = service.canSellHotel(player, edition, 'a');
      expect(result.available).toBe(false);
    });
  });

  describe('reorganización', () => {
    const edition = makeEdition();

    it('acepta reorganización válida 2-1-1 → 1-2-1', () => {
      const player = makePlayer([prop('a', 2), prop('b', 1), prop('c', 1)]);
      const result = service.validateRearrangement(player, edition, 'G1', { a: 1, b: 2, c: 1 });
      expect(result.valid).toBe(true);
    });

    it('rechaza reorganización que cambia total de casas', () => {
      const player = makePlayer([prop('a', 2), prop('b', 1), prop('c', 1)]);
      const result = service.validateRearrangement(player, edition, 'G1', { a: 2, b: 2, c: 1 });
      expect(result.valid).toBe(false);
      expect(result.reason).toContain('cantidad total');
    });

    it('rechaza reorganización no uniforme', () => {
      const player = makePlayer([prop('a', 2), prop('b', 1), prop('c', 1)]);
      const result = service.validateRearrangement(player, edition, 'G1', { a: 3, b: 0, c: 1 });
      expect(result.valid).toBe(false);
      expect(result.reason).toContain('construcción uniforme');
    });

    it('rechaza reorganización con hoteles en el grupo', () => {
      const player = makePlayer([prop('a', 0, true), prop('b', 4), prop('c', 4)]);
      const result = service.validateRearrangement(player, edition, 'G1', { a: 0, b: 4, c: 4 });
      expect(result.valid).toBe(false);
      expect(result.reason).toContain('hoteles');
    });

    it('detecta alternativas en 1-1-1 (puede ir a 0-1-2)', () => {
      const player = makePlayer([prop('a', 1), prop('b', 1), prop('c', 1)]);
      expect(service.canRearrange(player, edition, 'G1').available).toBe(true);
    });

    it('detecta alternativas en 2-1-1', () => {
      const player = makePlayer([prop('a', 2), prop('b', 1), prop('c', 1)]);
      expect(service.canRearrange(player, edition, 'G1').available).toBe(true);
    });
  });

  describe('getAvailableActions', () => {
    const edition = makeEdition();

    it('devuelve acciones con razones contextuales', () => {
      const player = makePlayer([prop('a', 1), prop('b', 0), prop('c', 0)]);
      const actions = service.getAvailableActions(player, edition, 'a');
      expect(actions.find((a) => a.id === 'build-house')?.available).toBe(false);
      expect(actions.find((a) => a.id === 'build-house')?.reason).toContain('primero');
      expect(actions.find((a) => a.id === 'sell-house')?.available).toBe(true);
    });
  });
});
