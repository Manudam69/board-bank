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

  it('rejects claiming salary for another player', () => {
    expect(() => service.payFromBank('ROOM', 'u2', 200, 'Sueldo')).toThrow(
      'No puedes realizar operaciones sobre la cartera de otro jugador',
    );
  });
});
