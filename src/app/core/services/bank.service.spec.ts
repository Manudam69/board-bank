import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { BankService } from './bank.service';
import { GameStateService } from './game-state.service';
import { AuthService } from './auth.service';
import { IdService } from './id.service';
import { LiquidationService } from './liquidation.service';
import type { Edition, Room } from '../models';

function makeRoom(): Room {
  return {
    id: 'ROOM',
    editionId: 'ED',
    hostId: 'u1',
    status: 'playing',
    players: [
      { id: 'u1', name: 'Ana', avatarColor: 'bg-red-500', cash: 1500, properties: [], bankrupt: false, host: true, joinedAt: 0 },
      { id: 'u2', name: 'Ben', avatarColor: 'bg-blue-500', cash: 1000, properties: [], bankrupt: false, host: false, joinedAt: 0 },
    ],
    log: [],
    trades: [],
    createdAt: 0,
    updatedAt: 0,
  };
}

function makeEdition(): Edition {
  return {
    id: 'ED',
    name: 'Test Edition',
    currency: { code: 'USD', symbol: '$', scale: 'units' },
    startingMoney: 1500,
    goSalary: 200,
    jailFine: 50,
    incomeTax: 200,
    luxuryTax: 75,
    properties: [],
  };
}

describe('BankService guards', () => {
  let service: BankService;
  let runInTransactionMock: ReturnType<typeof vi.fn>;
  let authUserId = 'u1';
  let liquidationPlan: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    authUserId = 'u1';
    liquidationPlan = vi.fn();
    runInTransactionMock = vi.fn(async (_roomId: string, mutator: (room: Room) => Room | null) => {
      const room = makeRoom();
      const next = mutator(room);
      if (next) Object.assign(room, next);
    });

    const auth = { userId: () => authUserId, ready: () => true, error: () => null } as unknown as AuthService;
    const liquidation = { plan: liquidationPlan } as unknown as LiquidationService;

    TestBed.configureTestingModule({
      providers: [
        BankService,
        IdService,
        { provide: GameStateService, useValue: { runInTransaction: runInTransactionMock } },
        { provide: AuthService, useValue: auth },
        { provide: LiquidationService, useValue: liquidation },
      ],
    });

    service = TestBed.inject(BankService);
  });

  it('allows a player to transfer their own money', async () => {
    await service.transfer('ROOM', 'u1', 'u2', 100, 'prueba');
    expect(runInTransactionMock).toHaveBeenCalled();
  });

  it('rejects transfer from another player\'s wallet', () => {
    expect(() => service.transfer('ROOM', 'u2', 'u1', 100, 'prueba')).toThrow(
      'No puedes realizar operaciones sobre la cartera de otro jugador',
    );
  });

  it('allows paying own tax', async () => {
    await service.payTax('ROOM', 'u1', 200, 'Renta');
    expect(runInTransactionMock).toHaveBeenCalled();
  });

  it('rejects paying tax for another player', () => {
    expect(() => service.payTax('ROOM', 'u2', 200, 'Renta')).toThrow(
      'No puedes realizar operaciones sobre la cartera de otro jugador',
    );
  });

  it('allows claiming own salary', async () => {
    await service.payFromBank('ROOM', 'u1', 200, 'Sueldo');
    expect(runInTransactionMock).toHaveBeenCalled();
  });

  it('includes metadata in salary log entry', async () => {
    let savedLog: unknown | undefined;
    runInTransactionMock.mockImplementationOnce(async (_roomId: string, mutator: (room: Room) => Room | null) => {
      const room = makeRoom();
      const next = mutator(room);
      if (next) Object.assign(room, next);
      savedLog = room.log.at(-1);
    });
    await service.payFromBank('ROOM', 'u1', 200, 'Sueldo', { bankAction: 'salary' });
    expect(savedLog).toMatchObject({ metadata: { bankAction: 'salary' }, type: 'transfer' });
  });

  it('includes metadata in tax log entry', async () => {
    let savedLog: unknown | undefined;
    runInTransactionMock.mockImplementationOnce(async (_roomId: string, mutator: (room: Room) => Room | null) => {
      const room = makeRoom();
      const next = mutator(room);
      if (next) Object.assign(room, next);
      savedLog = room.log.at(-1);
    });
    await service.payTax('ROOM', 'u1', 200, 'Renta', { bankAction: 'income-tax' });
    expect(savedLog).toMatchObject({ metadata: { bankAction: 'income-tax' }, type: 'transfer' });
  });

  describe('payJailFine', () => {
    it('allows paying own jail fine and logs it as bank-fee', async () => {
      let savedRoom: Room | undefined;
      runInTransactionMock.mockImplementationOnce(async (_roomId: string, mutator: (room: Room) => Room | null) => {
        const room = makeRoom();
        const next = mutator(room);
        if (next) Object.assign(room, next);
        savedRoom = room;
      });
      await service.payJailFine('ROOM', 'u1', 50);
      const ana = savedRoom?.players.find((p) => p.id === 'u1');
      const log = savedRoom?.log.at(-1);
      expect(ana?.cash).toBe(1450);
      expect(log).toMatchObject({
        type: 'bank-fee',
        amount: 50,
        description: 'Fianza de cárcel',
        fromPlayerId: 'u1',
        toPlayerId: 'bank',
        metadata: { bankAction: 'jail-fine' },
      });
    });

    it('rejects paying jail fine for another player', () => {
      expect(() => service.payJailFine('ROOM', 'u2', 50)).toThrow(
        'No puedes realizar operaciones sobre la cartera de otro jugador',
      );
    });

    it('rejects when player has insufficient funds', async () => {
      let savedRoom: Room | undefined;
      runInTransactionMock.mockImplementationOnce(async (_roomId: string, mutator: (room: Room) => Room | null) => {
        const room = makeRoom();
        room.players[0].cash = 30;
        savedRoom = room;
        const next = mutator(room);
        if (next) Object.assign(room, next);
      });
      await expect(service.payJailFine('ROOM', 'u1', 50)).rejects.toThrow(
        'Ana no tiene suficiente dinero',
      );
      expect(savedRoom?.players[0].cash).toBe(30);
      expect(savedRoom?.log.length).toBe(0);
    });

    it('rejects non-positive or non-integer amounts', () => {
      expect(() => service.payJailFine('ROOM', 'u1', 0)).toThrow(
        'La fianza debe ser un número entero mayor que cero',
      );
      expect(() => service.payJailFine('ROOM', 'u1', -10)).toThrow(
        'La fianza debe ser un número entero mayor que cero',
      );
      expect(() => service.payJailFine('ROOM', 'u1', 50.5)).toThrow(
        'La fianza debe ser un número entero mayor que cero',
      );
    });
  });

  it('includes metadata in bankruptcy log entry', async () => {
    let savedRoom: Room | undefined;
    runInTransactionMock.mockImplementationOnce(async (_roomId: string, mutator: (room: Room) => Room | null) => {
      const room = makeRoom();
      const next = mutator(room);
      if (next) Object.assign(room, next);
      savedRoom = room;
    });
    await service.declareBankruptcy('ROOM', 'u1');
    const bankruptcyLog = savedRoom?.log.find((entry) => entry.type === 'bankruptcy');
    expect(bankruptcyLog).toMatchObject({ metadata: { bankAction: 'bankruptcy' }, type: 'bankruptcy' });
  });

  it('returns all properties to the bank when declaring bankruptcy', async () => {
    let savedRoom: Room | undefined;
    runInTransactionMock.mockImplementationOnce(async (_roomId: string, mutator: (room: Room) => Room | null) => {
      const room: Room = {
        ...makeRoom(),
        players: [
          { id: 'u1', name: 'Ana', avatarColor: 'bg-red-500', cash: 1500, properties: [{ propertyId: 'p1', houses: 2, hasHotel: false, mortgaged: true }], bankrupt: false, host: true, joinedAt: 0 },
          { id: 'u2', name: 'Ben', avatarColor: 'bg-blue-500', cash: 1000, properties: [], bankrupt: false, host: false, joinedAt: 0 },
        ],
      };
      const next = mutator(room);
      if (next) Object.assign(room, next);
      savedRoom = room;
    });
    await service.declareBankruptcy('ROOM', 'u1');
    const bankrupt = savedRoom?.players.find((p) => p.id === 'u1');
    expect(bankrupt?.properties).toEqual([]);
    expect(bankrupt?.cash).toBe(0);
    expect(bankrupt?.bankrupt).toBe(true);
  });

  it('cancels pending trades involving the bankrupt player', async () => {
    let savedRoom: Room | undefined;
    runInTransactionMock.mockImplementationOnce(async (_roomId: string, mutator: (room: Room) => Room | null) => {
      const room: Room = {
        ...makeRoom(),
        trades: [
          { id: 't1', status: 'pending', fromPlayerId: 'u1', toPlayerId: 'u2', fromItems: { cash: 0, propertyIds: [] }, toItems: { cash: 0, propertyIds: [] }, createdAt: 0 },
          { id: 't2', status: 'pending', fromPlayerId: 'u2', toPlayerId: 'u1', fromItems: { cash: 0, propertyIds: [] }, toItems: { cash: 0, propertyIds: [] }, createdAt: 0 },
          { id: 't3', status: 'pending', fromPlayerId: 'u2', toPlayerId: 'bank', fromItems: { cash: 0, propertyIds: [] }, toItems: { cash: 0, propertyIds: [] }, createdAt: 0 },
        ],
      };
      const next = mutator(room);
      if (next) Object.assign(room, next);
      savedRoom = room;
    });
    await service.declareBankruptcy('ROOM', 'u1');
    expect(savedRoom?.trades.find((t) => t.id === 't1')?.status).toBe('cancelled');
    expect(savedRoom?.trades.find((t) => t.id === 't2')?.status).toBe('cancelled');
    expect(savedRoom?.trades.find((t) => t.id === 't3')?.status).toBe('pending');
  });

  it('finishes the game when bankruptcy leaves only one player standing', async () => {
    let savedRoom: Room | undefined;
    runInTransactionMock.mockImplementationOnce(async (_roomId: string, mutator: (room: Room) => Room | null) => {
      const room = makeRoom();
      const next = mutator(room);
      if (next) Object.assign(room, next);
      savedRoom = room;
    });
    await service.declareBankruptcy('ROOM', 'u1');
    expect(savedRoom?.status).toBe('finished');
    expect(savedRoom?.finishedAt).toBeGreaterThan(0);
    const lastLog = savedRoom?.log.at(-1);
    expect(lastLog?.type).toBe('game-end');
    expect(lastLog?.description).toContain('Ben gana la partida');
    expect(lastLog?.toPlayerId).toBe('u2');
  });

  it('does not finish the game when more than one player remains standing', async () => {
    let savedRoom: Room | undefined;
    runInTransactionMock.mockImplementationOnce(async (_roomId: string, mutator: (room: Room) => Room | null) => {
      const room: Room = {
        ...makeRoom(),
        players: [
          { id: 'u1', name: 'Ana', avatarColor: 'bg-red-500', cash: 1500, properties: [], bankrupt: false, host: true, joinedAt: 0 },
          { id: 'u2', name: 'Ben', avatarColor: 'bg-blue-500', cash: 1000, properties: [], bankrupt: false, host: false, joinedAt: 0 },
          { id: 'u3', name: 'Cora', avatarColor: 'bg-green-500', cash: 1200, properties: [], bankrupt: false, host: false, joinedAt: 0 },
        ],
      };
      const next = mutator(room);
      if (next) Object.assign(room, next);
      savedRoom = room;
    });
    await service.declareBankruptcy('ROOM', 'u1');
    expect(savedRoom?.status).toBe('playing');
    expect(savedRoom?.finishedAt).toBeUndefined();
    expect(savedRoom?.log.some((entry) => entry.type === 'game-end')).toBe(false);
  });

  it('does not auto-finish a game already finished or in lobby', async () => {
    let savedRoom: Room | undefined;
    runInTransactionMock.mockImplementationOnce(async (_roomId: string, mutator: (room: Room) => Room | null) => {
      const room = { ...makeRoom(), status: 'lobby' as const };
      const next = mutator(room);
      if (next) Object.assign(room, next);
      savedRoom = room;
    });
    await service.declareBankruptcy('ROOM', 'u1');
    expect(savedRoom?.status).toBe('lobby');
    expect(savedRoom?.finishedAt).toBeUndefined();
  });

  describe('declareBankruptcy with settlement', () => {
    it('liquidates all assets and pays a single creditor everything available', async () => {
      let savedRoom: Room | undefined;
      runInTransactionMock.mockImplementationOnce(async (_roomId: string, mutator: (room: Room) => Room | null) => {
        const room: Room = {
          ...makeRoom(),
          players: [
            { id: 'u1', name: 'Ana', avatarColor: 'bg-red-500', cash: 200, properties: [{ propertyId: 'p1', houses: 0, hasHotel: false, mortgaged: false }], bankrupt: false, host: true, joinedAt: 0 },
            { id: 'u2', name: 'Ben', avatarColor: 'bg-blue-500', cash: 1000, properties: [], bankrupt: false, host: false, joinedAt: 0 },
          ],
        };
        liquidationPlan.mockReturnValue({
          properties: [{ propertyId: 'p1', houses: 0, hasHotel: false, mortgaged: true }],
          totalCash: 400,
          housesSold: 0,
          hotelsSold: 0,
          mortgagedIds: ['p1'],
          propertyCount: 1,
        });
        const next = mutator(room);
        if (next) Object.assign(room, next);
        savedRoom = room;
      });

      await service.declareBankruptcy('ROOM', 'u1', { edition: makeEdition(), creditors: [{ playerId: 'u2', owed: 1000 }] });

      const ana = savedRoom?.players.find((p) => p.id === 'u1');
      const ben = savedRoom?.players.find((p) => p.id === 'u2');
      const log = savedRoom?.log.find((entry) => entry.type === 'bankruptcy');

      expect(ana?.cash).toBe(0);
      expect(ana?.bankrupt).toBe(true);
      expect(ana?.properties).toEqual([]);
      expect(ben?.cash).toBe(1600);
      expect(log?.amount).toBe(600);
      expect(log?.metadata).toMatchObject({ settledTotal: 600, payments: [{ playerId: 'u2', amount: 600 }] });
    });

    it('distributes available cash proportionally among several creditors', async () => {
      let savedRoom: Room | undefined;
      runInTransactionMock.mockImplementationOnce(async (_roomId: string, mutator: (room: Room) => Room | null) => {
        const room: Room = {
          ...makeRoom(),
          players: [
            { id: 'u1', name: 'Ana', avatarColor: 'bg-red-500', cash: 100, properties: [], bankrupt: false, host: true, joinedAt: 0 },
            { id: 'u2', name: 'Ben', avatarColor: 'bg-blue-500', cash: 1000, properties: [], bankrupt: false, host: false, joinedAt: 0 },
            { id: 'u3', name: 'Cora', avatarColor: 'bg-green-500', cash: 1000, properties: [], bankrupt: false, host: false, joinedAt: 0 },
          ],
        };
        liquidationPlan.mockReturnValue({
          properties: [],
          totalCash: 200,
          housesSold: 0,
          hotelsSold: 0,
          mortgagedIds: [],
          propertyCount: 0,
        });
        const next = mutator(room);
        if (next) Object.assign(room, next);
        savedRoom = room;
      });

      await service.declareBankruptcy('ROOM', 'u1', {
        edition: makeEdition(),
        creditors: [
          { playerId: 'u2', owed: 300 },
          { playerId: 'u3', owed: 100 },
        ],
      });

      const ben = savedRoom?.players.find((p) => p.id === 'u2');
      const cora = savedRoom?.players.find((p) => p.id === 'u3');
      expect(ben?.cash).toBe(1225); // 1000 + 225
      expect(cora?.cash).toBe(1075); // 1000 + 75
      expect(savedRoom?.log.find((entry) => entry.type === 'bankruptcy')?.metadata).toMatchObject({
        settledTotal: 300,
        payments: expect.arrayContaining([
          { playerId: 'u2', amount: 225 },
          { playerId: 'u3', amount: 75 },
        ]),
      });
    });

    it('ignores bankrupt creditors and redistributes their share', async () => {
      let savedRoom: Room | undefined;
      runInTransactionMock.mockImplementationOnce(async (_roomId: string, mutator: (room: Room) => Room | null) => {
        const room: Room = {
          ...makeRoom(),
          players: [
            { id: 'u1', name: 'Ana', avatarColor: 'bg-red-500', cash: 100, properties: [], bankrupt: false, host: true, joinedAt: 0 },
            { id: 'u2', name: 'Ben', avatarColor: 'bg-blue-500', cash: 1000, properties: [], bankrupt: true, host: false, joinedAt: 0 },
            { id: 'u3', name: 'Cora', avatarColor: 'bg-green-500', cash: 1000, properties: [], bankrupt: false, host: false, joinedAt: 0 },
          ],
        };
        liquidationPlan.mockReturnValue({
          properties: [],
          totalCash: 200,
          housesSold: 0,
          hotelsSold: 0,
          mortgagedIds: [],
          propertyCount: 0,
        });
        const next = mutator(room);
        if (next) Object.assign(room, next);
        savedRoom = room;
      });

      await service.declareBankruptcy('ROOM', 'u1', {
        edition: makeEdition(),
        creditors: [
          { playerId: 'u2', owed: 300 },
          { playerId: 'u3', owed: 300 },
        ],
      });

      const ben = savedRoom?.players.find((p) => p.id === 'u2');
      const cora = savedRoom?.players.find((p) => p.id === 'u3');
      expect(ben?.cash).toBe(1000);
      expect(cora?.cash).toBe(1300);
    });

    it('keeps available cash when no valid creditors are provided', async () => {
      let savedRoom: Room | undefined;
      runInTransactionMock.mockImplementationOnce(async (_roomId: string, mutator: (room: Room) => Room | null) => {
        const room: Room = {
          ...makeRoom(),
          players: [
            { id: 'u1', name: 'Ana', avatarColor: 'bg-red-500', cash: 500, properties: [], bankrupt: false, host: true, joinedAt: 0 },
            { id: 'u2', name: 'Ben', avatarColor: 'bg-blue-500', cash: 1000, properties: [], bankrupt: false, host: false, joinedAt: 0 },
          ],
        };
        liquidationPlan.mockReturnValue({
          properties: [],
          totalCash: 0,
          housesSold: 0,
          hotelsSold: 0,
          mortgagedIds: [],
          propertyCount: 0,
        });
        const next = mutator(room);
        if (next) Object.assign(room, next);
        savedRoom = room;
      });

      await service.declareBankruptcy('ROOM', 'u1', { edition: makeEdition(), creditors: [] });

      const ana = savedRoom?.players.find((p) => p.id === 'u1');
      expect(ana?.cash).toBe(0);
      expect(savedRoom?.log.find((entry) => entry.type === 'bankruptcy')?.amount).toBe(0);
    });
  });

  describe('transferMulti', () => {
    it('distributes per-player amount to each recipient and deducts total from sender', async () => {
      let savedRoom: Room | undefined;
      runInTransactionMock.mockImplementationOnce(async (_roomId: string, mutator: (room: Room) => Room | null) => {
        const room: Room = {
          ...makeRoom(),
          players: [
            { id: 'u1', name: 'Ana', avatarColor: 'bg-red-500', cash: 1500, properties: [], bankrupt: false, host: true, joinedAt: 0 },
            { id: 'u2', name: 'Ben', avatarColor: 'bg-blue-500', cash: 1000, properties: [], bankrupt: false, host: false, joinedAt: 0 },
            { id: 'u3', name: 'Cora', avatarColor: 'bg-green-500', cash: 1000, properties: [], bankrupt: false, host: false, joinedAt: 0 },
          ],
        };
        const next = mutator(room);
        if (next) Object.assign(room, next);
        savedRoom = room;
      });

      await service.transferMulti('ROOM', 'u1', ['u2', 'u3'], 100, 'Reparto');

      expect(savedRoom?.players.find((p) => p.id === 'u1')?.cash).toBe(1300);
      expect(savedRoom?.players.find((p) => p.id === 'u2')?.cash).toBe(1100);
      expect(savedRoom?.players.find((p) => p.id === 'u3')?.cash).toBe(1100);
      const transferLogs = savedRoom?.log.filter((entry) => entry.type === 'transfer');
      expect(transferLogs).toHaveLength(2);
      expect(transferLogs?.[0].metadata?.['transferGroupId']).toBe(transferLogs?.[1].metadata?.['transferGroupId']);
      expect(transferLogs?.[0].amount).toBe(100);
      expect(transferLogs?.[1].amount).toBe(100);
    });

    it('rejects multi-transfer when total exceeds available cash', () => {
      let savedRoom: Room | undefined;
      runInTransactionMock.mockImplementationOnce(async (_roomId: string, mutator: (room: Room) => Room | null) => {
        const room: Room = {
          ...makeRoom(),
          players: [
            { id: 'u1', name: 'Ana', avatarColor: 'bg-red-500', cash: 1500, properties: [], bankrupt: false, host: true, joinedAt: 0 },
            { id: 'u2', name: 'Ben', avatarColor: 'bg-blue-500', cash: 1000, properties: [], bankrupt: false, host: false, joinedAt: 0 },
            { id: 'u3', name: 'Cora', avatarColor: 'bg-green-500', cash: 1000, properties: [], bankrupt: false, host: false, joinedAt: 0 },
          ],
        };
        const next = mutator(room);
        if (next) Object.assign(room, next);
        savedRoom = room;
      });

      return expect(service.transferMulti('ROOM', 'u1', ['u2', 'u3'], 1000, 'Reparto')).rejects.toThrow(
        'Ana no tiene suficiente dinero',
      );
    });

    it('rejects empty recipients', () => {
      expect(() => service.transferMulti('ROOM', 'u1', [], 100, 'X')).toThrow('Debe haber al menos un destinatario');
    });

    it('rejects duplicate recipients', () => {
      expect(() => service.transferMulti('ROOM', 'u1', ['u2', 'u2'], 100, 'X')).toThrow(
        'Los destinatarios no pueden repetirse',
      );
    });

    it('rejects transfer to self within the group', () => {
      expect(() => service.transferMulti('ROOM', 'u1', ['u2', 'u1'], 100, 'X')).toThrow(
        'Origen y destino no pueden ser iguales',
      );
    });

    it('rejects transfer from another players wallet', () => {
      expect(() => service.transferMulti('ROOM', 'u2', ['u3'], 100, 'X')).toThrow(
        'No puedes realizar operaciones sobre la cartera de otro jugador',
      );
    });

    it('rejects bankrupt recipients', () => {
      let savedRoom: Room | undefined;
      runInTransactionMock.mockImplementationOnce(async (_roomId: string, mutator: (room: Room) => Room | null) => {
        const room: Room = {
          ...makeRoom(),
          players: [
            { id: 'u1', name: 'Ana', avatarColor: 'bg-red-500', cash: 1500, properties: [], bankrupt: false, host: true, joinedAt: 0 },
            { id: 'u2', name: 'Ben', avatarColor: 'bg-blue-500', cash: 1000, properties: [], bankrupt: true, host: false, joinedAt: 0 },
          ],
        };
        const next = mutator(room);
        if (next) Object.assign(room, next);
        savedRoom = room;
      });

      return expect(service.transferMulti('ROOM', 'u1', ['u2'], 100, 'X')).rejects.toThrow('El jugador está en quiebra');
    });
  });

  describe('bankPayTo', () => {
    it('adds cash to the recipient and logs a bank-payment entry', async () => {
      let savedRoom: Room | undefined;
      runInTransactionMock.mockImplementationOnce(async (_roomId: string, mutator: (room: Room) => Room | null) => {
        const room = makeRoom();
        const next = mutator(room);
        if (next) Object.assign(room, next);
        savedRoom = room;
      });

      await service.bankPayTo('ROOM', 'u2', 500, 'Premio del Banco');

      const u2 = savedRoom?.players.find((p) => p.id === 'u2');
      expect(u2?.cash).toBe(1500);
      const log = savedRoom?.log.at(-1);
      expect(log).toMatchObject({
        type: 'bank-payment',
        amount: 500,
        description: 'Premio del Banco',
        fromPlayerId: 'bank',
        toPlayerId: 'u2',
        metadata: { bankAction: 'bank-payment', actorId: 'u1' },
      });
    });

    it('uses a default description when none is provided', async () => {
      let savedRoom: Room | undefined;
      runInTransactionMock.mockImplementationOnce(async (_roomId: string, mutator: (room: Room) => Room | null) => {
        const room = makeRoom();
        const next = mutator(room);
        if (next) Object.assign(room, next);
        savedRoom = room;
      });

      await service.bankPayTo('ROOM', 'u2', 300, '');
      expect(savedRoom?.log.at(-1)?.description).toBe('Pago del Banco');
    });

    it('rejects non-positive or non-integer amounts', () => {
      expect(() => service.bankPayTo('ROOM', 'u2', 0, 'X')).toThrow('La cantidad debe ser un número entero mayor que cero');
      expect(() => service.bankPayTo('ROOM', 'u2', -100, 'X')).toThrow('La cantidad debe ser un número entero mayor que cero');
      expect(() => service.bankPayTo('ROOM', 'u2', 1.5, 'X')).toThrow('La cantidad debe ser un número entero mayor que cero');
    });

    it('rejects paying an unknown player', () => {
      return expect(service.bankPayTo('ROOM', 'u99', 100, 'X')).rejects.toThrow('Jugador no encontrado');
    });

    it('rejects paying a bankrupt player', () => {
      let savedRoom: Room | undefined;
      runInTransactionMock.mockImplementationOnce(async (_roomId: string, mutator: (room: Room) => Room | null) => {
        const room: Room = {
          ...makeRoom(),
          players: [
            { id: 'u1', name: 'Ana', avatarColor: 'bg-red-500', cash: 1500, properties: [], bankrupt: false, host: true, joinedAt: 0 },
            { id: 'u2', name: 'Ben', avatarColor: 'bg-blue-500', cash: 1000, properties: [], bankrupt: true, host: false, joinedAt: 0 },
          ],
        };
        const next = mutator(room);
        if (next) Object.assign(room, next);
        savedRoom = room;
      });

      return expect(service.bankPayTo('ROOM', 'u2', 100, 'X')).rejects.toThrow('El jugador está en quiebra');
    });

    it('allows a non-host to pay to themselves', async () => {
      authUserId = 'u2';
      let savedRoom: Room | undefined;
      runInTransactionMock.mockImplementationOnce(async (_roomId: string, mutator: (room: Room) => Room | null) => {
        const room = makeRoom();
        const next = mutator(room);
        if (next) Object.assign(room, next);
        savedRoom = room;
      });

      await service.bankPayTo('ROOM', 'u2', 500, 'Bono');

      const u2 = savedRoom?.players.find((p) => p.id === 'u2');
      const log = savedRoom?.log.at(-1);
      expect(u2?.cash).toBe(1500);
      expect(log).toMatchObject({
        type: 'bank-payment',
        amount: 500,
        toPlayerId: 'u2',
        metadata: { bankAction: 'bank-payment', actorId: 'u2' },
      });
    });

    it('rejects a non-host trying to pay another player', () => {
      authUserId = 'u2';
      let savedRoom: Room | undefined;
      runInTransactionMock.mockImplementationOnce(async (_roomId: string, mutator: (room: Room) => Room | null) => {
        const room = makeRoom();
        const next = mutator(room);
        if (next) Object.assign(room, next);
        savedRoom = room;
      });

      return expect(service.bankPayTo('ROOM', 'u1', 100, 'X')).rejects.toThrow(
        'Solo el anfitrión puede enviar dinero del Banco a otros jugadores',
      );
    });

    it('rejects an actor that is not a player in the room', () => {
      authUserId = 'u99';
      let savedRoom: Room | undefined;
      runInTransactionMock.mockImplementationOnce(async (_roomId: string, mutator: (room: Room) => Room | null) => {
        const room = makeRoom();
        const next = mutator(room);
        if (next) Object.assign(room, next);
        savedRoom = room;
      });

      return expect(service.bankPayTo('ROOM', 'u1', 100, 'X')).rejects.toThrow('No estás en esta sala');
    });
  });
});
