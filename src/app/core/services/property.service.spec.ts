import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { PropertyService } from './property.service';
import { GameStateService } from './game-state.service';
import { AuthService } from './auth.service';
import { IdService } from './id.service';
import { BuildingRulesService } from './building-rules.service';
import { CLASSIC_SPAIN } from '../constants/editions';
import type { PlayerProperty, Room } from '../models';

const p1 = CLASSIC_SPAIN.properties.find((p) => p.id === 'p1')!;

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

describe('PropertyService guards', () => {
  let service: PropertyService;
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
        PropertyService,
        IdService,
        BuildingRulesService,
        { provide: GameStateService, useValue: { runInTransaction: runInTransactionMock } },
        { provide: AuthService, useValue: auth },
      ],
    });

    service = TestBed.inject(PropertyService);
  });

  it('allows buying for self', async () => {
    await service.buyProperty('ROOM', CLASSIC_SPAIN, 'u1', p1.id);
    expect(runInTransactionMock).toHaveBeenCalled();
  });

  it('rejects buying for another player', () => {
    expect(() => service.buyProperty('ROOM', CLASSIC_SPAIN, 'u2', p1.id)).toThrow(
      'No puedes gestionar las propiedades de otro jugador',
    );
  });

  it('allows mortgaging own property', async () => {
    runInTransactionMock.mockImplementation(async (_roomId: string, mutator: (room: Room) => Room | null) => {
      const room = makeRoom([{ propertyId: p1.id, houses: 0, hasHotel: false, mortgaged: false }]);
      const next = mutator(room);
      if (next) Object.assign(room, next);
    });

    await service.mortgage('ROOM', CLASSIC_SPAIN, 'u1', p1.id);
    expect(runInTransactionMock).toHaveBeenCalled();
  });

  it('rejects mortgaging another player\'s property', () => {
    expect(() => service.mortgage('ROOM', CLASSIC_SPAIN, 'u2', p1.id)).toThrow(
      'No puedes gestionar las propiedades de otro jugador',
    );
  });

  describe('building rules', () => {
    const p2 = CLASSIC_SPAIN.properties.find((p) => p.id === 'p2')!;

    it('rejects building when it would break even-build rule', async () => {
      runInTransactionMock.mockImplementation(async (_roomId: string, mutator: (room: Room) => Room | null) => {
        const room = makeRoom([
          { propertyId: p1.id, houses: 1, hasHotel: false, mortgaged: false },
          { propertyId: p2.id, houses: 0, hasHotel: false, mortgaged: false },
        ]);
        room.players[0].cash = 500;
        const next = mutator(room);
        if (next) Object.assign(room, next);
      });

      await expect(service.buildHouses('ROOM', CLASSIC_SPAIN, 'u1', p1.id, 1)).rejects.toThrow('construcción uniforme');
    });

    it('allows building on the lowest property', async () => {
      runInTransactionMock.mockImplementation(async (_roomId: string, mutator: (room: Room) => Room | null) => {
        const room = makeRoom([
          { propertyId: p1.id, houses: 1, hasHotel: false, mortgaged: false },
          { propertyId: p2.id, houses: 0, hasHotel: false, mortgaged: false },
        ]);
        room.players[0].cash = 500;
        const next = mutator(room);
        if (next) Object.assign(room, next);
      });

      await expect(service.buildHouses('ROOM', CLASSIC_SPAIN, 'u1', p2.id, 1)).resolves.toBeUndefined();
    });

    it('rejects selling when it would break even-build rule', async () => {
      runInTransactionMock.mockImplementation(async (_roomId: string, mutator: (room: Room) => Room | null) => {
        const room = makeRoom([
          { propertyId: p1.id, houses: 2, hasHotel: false, mortgaged: false },
          { propertyId: p2.id, houses: 1, hasHotel: false, mortgaged: false },
        ]);
        room.players[0].cash = 500;
        const next = mutator(room);
        if (next) Object.assign(room, next);
      });

      await expect(service.sellHouses('ROOM', CLASSIC_SPAIN, 'u1', p2.id, 1)).rejects.toThrow('construcción uniforme');
    });

    it('requires 4 houses on every property of the group to build a hotel', async () => {
      runInTransactionMock.mockImplementation(async (_roomId: string, mutator: (room: Room) => Room | null) => {
        const room = makeRoom([
          { propertyId: p1.id, houses: 4, hasHotel: false, mortgaged: false },
          { propertyId: p2.id, houses: 3, hasHotel: false, mortgaged: false },
        ]);
        room.players[0].cash = 500;
        const next = mutator(room);
        if (next) Object.assign(room, next);
      });

      await expect(service.buildHotel('ROOM', CLASSIC_SPAIN, 'u1', p1.id)).rejects.toThrow('todo el grupo');
    });
  });

  describe('rearrangeHouses', () => {
    const p2 = CLASSIC_SPAIN.properties.find((p) => p.id === 'p2')!;

    it('rearranges houses within a group for free', async () => {
      let latestRoom: Room | undefined;
      runInTransactionMock.mockImplementation(async (_roomId: string, mutator: (room: Room) => Room | null) => {
        const room = makeRoom([
          { propertyId: p1.id, houses: 2, hasHotel: false, mortgaged: false },
          { propertyId: p2.id, houses: 1, hasHotel: false, mortgaged: false },
        ]);
        room.players[0].cash = 500;
        const next = mutator(room);
        if (next) Object.assign(room, next);
        latestRoom = room;
      });

      await service.rearrangeHouses('ROOM', CLASSIC_SPAIN, 'u1', { [p1.id]: 1, [p2.id]: 2 });

      const updated = latestRoom!;
      const pp1 = updated.players[0].properties.find((p) => p.propertyId === p1.id)!;
      const pp2 = updated.players[0].properties.find((p) => p.propertyId === p2.id)!;
      expect(pp1.houses).toBe(1);
      expect(pp2.houses).toBe(2);
      expect(updated.players[0].cash).toBe(500);
      expect(updated.log[updated.log.length - 1].type).toBe('rearrange-houses');
    });

    it('rejects rearrangements that break the uniform rule', async () => {
      runInTransactionMock.mockImplementation(async (_roomId: string, mutator: (room: Room) => Room | null) => {
        const room = makeRoom([
          { propertyId: p1.id, houses: 2, hasHotel: false, mortgaged: false },
          { propertyId: p2.id, houses: 1, hasHotel: false, mortgaged: false },
        ]);
        room.players[0].cash = 500;
        const next = mutator(room);
        if (next) Object.assign(room, next);
      });

      await expect(service.rearrangeHouses('ROOM', CLASSIC_SPAIN, 'u1', { [p1.id]: 3, [p2.id]: 0 })).rejects.toThrow(
        'construcción uniforme',
      );
    });
  });
});
