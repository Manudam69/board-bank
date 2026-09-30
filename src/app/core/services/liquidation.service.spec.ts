import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { LiquidationService } from './liquidation.service';
import { GameStateService } from './game-state.service';
import { AuthService } from './auth.service';
import { IdService } from './id.service';
import { BuildingRulesService } from './building-rules.service';
import { CLASSIC_SPAIN } from '../constants/editions';
import type { PlayerProperty, Room } from '../models';

const p1 = CLASSIC_SPAIN.properties.find((p) => p.id === 'p1')!;
const p2 = CLASSIC_SPAIN.properties.find((p) => p.id === 'p2')!;
const p23 = CLASSIC_SPAIN.properties.find((p) => p.id === 'p23')!;
const p27 = CLASSIC_SPAIN.properties.find((p) => p.id === 'p27')!;

function makeRoom(ownedByU1: PlayerProperty[] = []): Room {
  return {
    id: 'ROOM',
    editionId: CLASSIC_SPAIN.id,
    hostId: 'u1',
    status: 'playing',
    players: [
      { id: 'u1', name: 'Ana', avatarColor: 'bg-red-500', cash: 500, properties: ownedByU1, bankrupt: false, host: true, joinedAt: 0 },
      { id: 'u2', name: 'Ben', avatarColor: 'bg-blue-500', cash: 500, properties: [], bankrupt: false, host: false, joinedAt: 0 },
    ],
    log: [],
    trades: [],
    createdAt: 0,
    updatedAt: 0,
  };
}

describe('LiquidationService', () => {
  let service: LiquidationService;
  let runInTransactionMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    runInTransactionMock = vi.fn(async (_roomId: string, mutator: (room: Room) => Room | null) => {
      const room = makeRoom();
      const next = mutator(room);
      if (next) Object.assign(room, next);
    });

    const auth = { userId: () => 'u1', ready: () => true, error: () => null } as unknown as AuthService;

    TestBed.configureTestingModule({
      providers: [
        LiquidationService,
        IdService,
        BuildingRulesService,
        { provide: GameStateService, useValue: { runInTransaction: runInTransactionMock } },
        { provide: AuthService, useValue: auth },
      ],
    });

    service = TestBed.inject(LiquidationService);
  });

  it('plans zero cash when player has no sellable assets', () => {
    const player = makeRoom([{ propertyId: p1.id, houses: 0, hasHotel: false, mortgaged: true }]).players[0];
    const plan = service.plan(player, CLASSIC_SPAIN);
    expect(plan.totalCash).toBe(0);
    expect(plan.housesSold).toBe(0);
    expect(plan.hotelsSold).toBe(0);
    expect(plan.mortgagedIds).toEqual([]);
  });

  it('plans mortgage value for an unmortgaged property with no buildings', () => {
    const player = makeRoom([{ propertyId: p1.id, houses: 0, hasHotel: false, mortgaged: false }]).players[0];
    const plan = service.plan(player, CLASSIC_SPAIN);
    expect(plan.totalCash).toBe(p1.mortgageValue);
    expect(plan.mortgagedIds).toEqual([p1.id]);
    expect(plan.properties[0].mortgaged).toBe(true);
  });

  it('plans house refunds and then mortgage', () => {
    const player = makeRoom([{ propertyId: p1.id, houses: 2, hasHotel: false, mortgaged: false }]).players[0];
    const plan = service.plan(player, CLASSIC_SPAIN);
    expect(plan.housesSold).toBe(2);
    expect(plan.totalCash).toBe(2 * Math.round(p1.houseCost / 2) + p1.mortgageValue);
    expect(plan.properties[0].houses).toBe(0);
    expect(plan.properties[0].mortgaged).toBe(true);
  });

  it('plans hotel sale (converts to 4 houses) and then sells houses + mortgages', () => {
    const player = makeRoom([
      { propertyId: p1.id, houses: 0, hasHotel: true, mortgaged: false },
      { propertyId: p2.id, houses: 4, hasHotel: false, mortgaged: false },
    ]).players[0];
    const plan = service.plan(player, CLASSIC_SPAIN);
    expect(plan.hotelsSold).toBe(1);
    expect(plan.housesSold).toBe(8);
    expect(plan.properties.find((pp) => pp.propertyId === p1.id)?.hasHotel).toBe(false);
    expect(plan.properties.find((pp) => pp.propertyId === p1.id)?.houses).toBe(0);
    expect(plan.properties.every((pp) => pp.mortgaged)).toBe(true);
    const expected =
      Math.round(p1.hotelCost / 2) +
      8 * Math.round(p1.houseCost / 2) +
      p1.mortgageValue +
      p2.mortgageValue;
    expect(plan.totalCash).toBe(expected);
  });

  it('respects uniform building rules and skips blocked sales', () => {
    const player = makeRoom([
      { propertyId: p1.id, houses: 5, hasHotel: true, mortgaged: false },
      { propertyId: p2.id, houses: 0, hasHotel: false, mortgaged: false },
    ]).players[0];
    const plan = service.plan(player, CLASSIC_SPAIN);
    // p1 hotel cannot be sold because lowering to 4 breaks uniformity with p2 at 0.
    expect(plan.hotelsSold).toBe(0);
    expect(plan.housesSold).toBe(0);
    // p2 can still be mortgaged because it has no buildings.
    expect(plan.mortgagedIds).toEqual([p2.id]);
    expect(plan.totalCash).toBe(p2.mortgageValue);
  });

  it('mortgages railroads and utilities with no buildings', () => {
    const player = makeRoom([
      { propertyId: p23.id, houses: 0, hasHotel: false, mortgaged: false },
      { propertyId: p27.id, houses: 0, hasHotel: false, mortgaged: false },
    ]).players[0];
    const plan = service.plan(player, CLASSIC_SPAIN);
    expect(plan.mortgagedIds).toEqual([p23.id, p27.id]);
    expect(plan.totalCash).toBe(p23.mortgageValue + p27.mortgageValue);
  });

  it('executes liquidation in a single transaction', async () => {
    let savedRoom: Room | undefined;
    runInTransactionMock.mockImplementationOnce(async (_roomId: string, mutator: (room: Room) => Room | null) => {
      const room = makeRoom([
        { propertyId: p1.id, houses: 1, hasHotel: false, mortgaged: false },
        { propertyId: p23.id, houses: 0, hasHotel: false, mortgaged: false },
      ]);
      const next = mutator(room);
      if (next) Object.assign(room, next);
      savedRoom = room;
    });

    const plan = await service.liquidateAll('ROOM', CLASSIC_SPAIN, 'u1');
    const player = savedRoom?.players.find((p) => p.id === 'u1');
    const log = savedRoom?.log.at(-1);

    expect(plan.totalCash).toBe(Math.round(p1.houseCost / 2) + p1.mortgageValue + p23.mortgageValue);
    expect(player?.cash).toBe(500 + plan.totalCash);
    expect(player?.properties.find((pp) => pp.propertyId === p1.id)?.mortgaged).toBe(true);
    expect(player?.properties.find((pp) => pp.propertyId === p1.id)?.houses).toBe(0);
    expect(log?.type).toBe('liquidation');
    expect(log?.metadata).toMatchObject({ bankAction: 'liquidation' });
  });

  it('throws when there is nothing to liquidate', async () => {
    runInTransactionMock.mockImplementationOnce(async (_roomId: string, mutator: (room: Room) => Room | null) => {
      const room = makeRoom();
      const next = mutator(room);
      if (next) Object.assign(room, next);
    });
    await expect(service.liquidateAll('ROOM', CLASSIC_SPAIN, 'u1')).rejects.toThrow('No tienes activos para liquidar');
  });

  it('rejects liquidation for another player', () => {
    expect(() => service.liquidateAll('ROOM', CLASSIC_SPAIN, 'u2')).toThrow(
      'No puedes gestionar las propiedades de otro jugador',
    );
  });

  it('keeps ownership after liquidation', async () => {
    let savedRoom: Room | undefined;
    runInTransactionMock.mockImplementationOnce(async (_roomId: string, mutator: (room: Room) => Room | null) => {
      const room = makeRoom([{ propertyId: p1.id, houses: 0, hasHotel: false, mortgaged: false }]);
      const next = mutator(room);
      if (next) Object.assign(room, next);
      savedRoom = room;
    });

    await service.liquidateAll('ROOM', CLASSIC_SPAIN, 'u1');
    const player = savedRoom?.players.find((p) => p.id === 'u1');
    expect(player?.properties).toHaveLength(1);
    expect(player?.properties[0].propertyId).toBe(p1.id);
  });
});
