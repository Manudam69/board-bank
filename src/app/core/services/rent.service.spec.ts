import { RentService } from './rent.service';
import { CLASSIC_SPAIN, MILLIONAIRE } from '../constants/editions';
import type { Player, Room } from '../models';

function makeRoom(players: Player[]): Room {
  return {
    id: 'ROOM',
    editionId: CLASSIC_SPAIN.id,
    hostId: players[0]?.id ?? '',
    status: 'playing',
    players,
    log: [],
    trades: [],
    createdAt: 0,
    updatedAt: 0,
  };
}

describe('RentService', () => {
  const service = new RentService();

  it('returns 0 when property has no owner', () => {
    const room = makeRoom([]);
    const result = service.calculate(room, CLASSIC_SPAIN, 'p1');
    expect(result.amount).toBe(0);
  });

  it('doubles base rent when owner has full color group without houses', () => {
    const owner: Player = {
      id: '1',
      name: 'Ana',
      avatarColor: 'bg-red-500',
      cash: 0,
      bankrupt: false,
      host: true,
      joinedAt: 0,
      properties: [
        { propertyId: 'p1', houses: 0, hasHotel: false, mortgaged: false },
        { propertyId: 'p2', houses: 0, hasHotel: false, mortgaged: false },
      ],
    };
    const room = makeRoom([owner]);
    const base = CLASSIC_SPAIN.properties.find((p) => p.id === 'p1')!.rents[0];
    expect(service.calculate(room, CLASSIC_SPAIN, 'p1').amount).toBe(base * 2);
  });

  it('returns railroad rent based on owned railroad count', () => {
    const owner: Player = {
      id: '1',
      name: 'Ana',
      avatarColor: 'bg-red-500',
      cash: 0,
      bankrupt: false,
      host: true,
      joinedAt: 0,
      properties: [
        { propertyId: 'p23', houses: 0, hasHotel: false, mortgaged: false },
        { propertyId: 'p24', houses: 0, hasHotel: false, mortgaged: false },
      ],
    };
    const room = makeRoom([owner]);
    expect(service.calculate(room, CLASSIC_SPAIN, 'p23').amount).toBe(50);
  });

  it('returns utility rent based on dice sum', () => {
    const owner: Player = {
      id: '1',
      name: 'Ana',
      avatarColor: 'bg-red-500',
      cash: 0,
      bankrupt: false,
      host: true,
      joinedAt: 0,
      properties: [
        { propertyId: 'p27', houses: 0, hasHotel: false, mortgaged: false },
        { propertyId: 'p28', houses: 0, hasHotel: false, mortgaged: false },
      ],
    };
    const room = makeRoom([owner]);
    expect(service.calculate(room, CLASSIC_SPAIN, 'p27', 8).amount).toBe(80);
  });

  it('returns millions-scale utility rent based on edition rents', () => {
    const owner: Player = {
      id: '1',
      name: 'Ana',
      avatarColor: 'bg-red-500',
      cash: 0,
      bankrupt: false,
      host: true,
      joinedAt: 0,
      properties: [{ propertyId: 'm27', houses: 0, hasHotel: false, mortgaged: false }],
    };
    const room = makeRoom([owner]);
    expect(service.calculate(room, MILLIONAIRE, 'm27', 8).amount).toBe(320_000);
  });

  it('doubles millions-scale utility rent when both utilities are owned', () => {
    const owner: Player = {
      id: '1',
      name: 'Ana',
      avatarColor: 'bg-red-500',
      cash: 0,
      bankrupt: false,
      host: true,
      joinedAt: 0,
      properties: [
        { propertyId: 'm27', houses: 0, hasHotel: false, mortgaged: false },
        { propertyId: 'm28', houses: 0, hasHotel: false, mortgaged: false },
      ],
    };
    const room = makeRoom([owner]);
    expect(service.calculate(room, MILLIONAIRE, 'm27', 8).amount).toBe(800_000);
  });

  it('returns hotel rent', () => {
    const owner: Player = {
      id: '1',
      name: 'Ana',
      avatarColor: 'bg-red-500',
      cash: 0,
      bankrupt: false,
      host: true,
      joinedAt: 0,
      properties: [{ propertyId: 'p1', houses: 0, hasHotel: true, mortgaged: false }],
    };
    const room = makeRoom([owner]);
    expect(service.calculate(room, CLASSIC_SPAIN, 'p1').amount).toBe(
      CLASSIC_SPAIN.properties.find((p) => p.id === 'p1')!.rents[5],
    );
  });
});
