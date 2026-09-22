import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { TradeService } from './trade.service';
import { GameStateService } from './game-state.service';
import { AuthService } from './auth.service';
import { IdService } from './id.service';
import { CLASSIC_SPAIN } from '../constants/editions';
import type { PlayerProperty, Room, TradeOffer } from '../models';

const p1 = CLASSIC_SPAIN.properties.find((p) => p.id === 'p1')!;
const p2 = CLASSIC_SPAIN.properties.find((p) => p.id === 'p2')!;

function makeRoom(props: {
  u1Properties?: PlayerProperty[];
  u2Properties?: PlayerProperty[];
  offers?: TradeOffer[];
  u1Cash?: number;
  u2Cash?: number;
} = {}): Room {
  return {
    id: 'ROOM',
    editionId: CLASSIC_SPAIN.id,
    hostId: 'u1',
    status: 'playing',
    players: [
      {
        id: 'u1',
        name: 'Ana',
        avatarColor: 'bg-red-500',
        cash: props.u1Cash ?? 500,
        properties: props.u1Properties ?? [],
        bankrupt: false,
        host: true,
        joinedAt: 0,
      },
      {
        id: 'u2',
        name: 'Ben',
        avatarColor: 'bg-blue-500',
        cash: props.u2Cash ?? 500,
        properties: props.u2Properties ?? [],
        bankrupt: false,
        host: false,
        joinedAt: 0,
      },
    ],
    log: [],
    trades: props.offers ?? [],
    createdAt: 0,
    updatedAt: 0,
  };
}

describe('TradeService building guard', () => {
  let service: TradeService;
  let runInTransactionMock: ReturnType<typeof vi.fn>;
  let currentUser: string;
  let room: Room;

  beforeEach(() => {
    currentUser = 'u1';
    runInTransactionMock = vi.fn(async (_roomId: string, mutator: (r: Room) => Room | null) => {
      const next = mutator(room);
      if (next) Object.assign(room, next);
    });

    const auth = {
      userId: () => currentUser,
      ready: () => true,
      error: () => null,
    } as unknown as AuthService;

    TestBed.configureTestingModule({
      providers: [
        TradeService,
        IdService,
        { provide: GameStateService, useValue: { runInTransaction: runInTransactionMock } },
        { provide: AuthService, useValue: auth },
      ],
    });

    service = TestBed.inject(TradeService);
  });

  it('rejects creating an offer with a property that has houses', async () => {
    room = makeRoom({
      u1Properties: [{ propertyId: p1.id, houses: 1, hasHotel: false, mortgaged: false }],
    });

    await expect(
      service.create('ROOM', 'u1', 'u2', { cash: 0, propertyIds: [p1.id] }, { cash: 0, propertyIds: [] }),
    ).rejects.toThrow('No puedes intercambiar una propiedad con edificaciones');
  });

  it('rejects creating an offer with a property that has a hotel', async () => {
    room = makeRoom({
      u2Properties: [{ propertyId: p2.id, houses: 0, hasHotel: true, mortgaged: false }],
    });

    await expect(
      service.create('ROOM', 'u1', 'u2', { cash: 0, propertyIds: [] }, { cash: 0, propertyIds: [p2.id] }),
    ).rejects.toThrow('No puedes intercambiar una propiedad con edificaciones');
  });

  it('accepts creating an offer when no properties have buildings', async () => {
    room = makeRoom({
      u1Properties: [{ propertyId: p1.id, houses: 0, hasHotel: false, mortgaged: false }],
      u2Properties: [{ propertyId: p2.id, houses: 0, hasHotel: false, mortgaged: false }],
    });

    await service.create('ROOM', 'u1', 'u2', { cash: 0, propertyIds: [p1.id] }, { cash: 0, propertyIds: [p2.id] });
    expect(room.trades).toHaveLength(1);
  });

  it('rejects accepting an offer if a from property gained buildings after creation', async () => {
    room = makeRoom({
      u1Properties: [{ propertyId: p1.id, houses: 0, hasHotel: false, mortgaged: false }],
      u2Properties: [{ propertyId: p2.id, houses: 0, hasHotel: false, mortgaged: false }],
      offers: [
        {
          id: 'OFFER',
          status: 'pending',
          fromPlayerId: 'u1',
          toPlayerId: 'u2',
          fromItems: { cash: 0, propertyIds: [p1.id] },
          toItems: { cash: 0, propertyIds: [p2.id] },
          createdAt: 0,
        },
      ],
    });

    room.players[0].properties[0].houses = 2;
    currentUser = 'u2';

    await expect(service.accept('ROOM', 'OFFER')).rejects.toThrow('No puedes intercambiar una propiedad con edificaciones');
    expect(room.trades[0].status).toBe('pending');
  });

  it('rejects accepting an offer if a to property gained a hotel after creation', async () => {
    room = makeRoom({
      u1Properties: [{ propertyId: p1.id, houses: 0, hasHotel: false, mortgaged: false }],
      u2Properties: [{ propertyId: p2.id, houses: 0, hasHotel: false, mortgaged: false }],
      offers: [
        {
          id: 'OFFER',
          status: 'pending',
          fromPlayerId: 'u1',
          toPlayerId: 'u2',
          fromItems: { cash: 0, propertyIds: [p1.id] },
          toItems: { cash: 0, propertyIds: [p2.id] },
          createdAt: 0,
        },
      ],
    });

    room.players[1].properties[0].hasHotel = true;
    currentUser = 'u2';

    await expect(service.accept('ROOM', 'OFFER')).rejects.toThrow('No puedes intercambiar una propiedad con edificaciones');
    expect(room.trades[0].status).toBe('pending');
  });

  it('transfers properties when accepted without buildings', async () => {
    room = makeRoom({
      u1Properties: [{ propertyId: p1.id, houses: 0, hasHotel: false, mortgaged: false }],
      u2Properties: [{ propertyId: p2.id, houses: 0, hasHotel: false, mortgaged: false }],
      u1Cash: 100,
      u2Cash: 200,
      offers: [
        {
          id: 'OFFER',
          status: 'pending',
          fromPlayerId: 'u1',
          toPlayerId: 'u2',
          fromItems: { cash: 50, propertyIds: [p1.id] },
          toItems: { cash: 25, propertyIds: [p2.id] },
          createdAt: 0,
        },
      ],
    });

    currentUser = 'u2';

    await service.accept('ROOM', 'OFFER');

    const u1 = room.players.find((p) => p.id === 'u1')!;
    const u2 = room.players.find((p) => p.id === 'u2')!;

    expect(u1.cash).toBe(75);
    expect(u2.cash).toBe(225);
    expect(u1.properties.map((pp) => pp.propertyId)).toContain(p2.id);
    expect(u2.properties.map((pp) => pp.propertyId)).toContain(p1.id);
    expect(u1.properties.find((pp) => pp.propertyId === p2.id)).toEqual(
      expect.objectContaining({ houses: 0, hasHotel: false }),
    );
    expect(u2.properties.find((pp) => pp.propertyId === p1.id)).toEqual(
      expect.objectContaining({ houses: 0, hasHotel: false }),
    );
    expect(room.trades[0].status).toBe('accepted');
  });
});
