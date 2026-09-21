import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { BankService } from './bank.service';
import { GameStateService } from './game-state.service';
import { AuthService } from './auth.service';
import { IdService } from './id.service';
import type { Room } from '../models';

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

describe('BankService guards', () => {
  let service: BankService;
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
        BankService,
        IdService,
        { provide: GameStateService, useValue: { runInTransaction: runInTransactionMock } },
        { provide: AuthService, useValue: auth },
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
});
