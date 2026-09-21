import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { UndoService } from './undo.service';
import { GameStateService } from './game-state.service';
import { AuthService } from './auth.service';
import { IdService } from './id.service';
import type { PlayerProperty, Room, TransactionLogEntry } from '../models';

let idCounter = 1;

function newId(): string {
  return `id-${idCounter++}`;
}

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

describe('UndoService', () => {
  let service: UndoService;
  let authUserId = 'u1';
  let lastRoom: Room | null = null;
  let runInTransactionMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    idCounter = 1;
    authUserId = 'u1';
    lastRoom = null;

    runInTransactionMock = vi.fn(async (_roomId: string, mutator: (room: Room) => Room | null) => {
      const room = makeRoom();
      if (lastRoom) {
        Object.assign(room, JSON.parse(JSON.stringify(lastRoom)));
      }
      const next = mutator(room);
      if (next) {
        Object.assign(room, JSON.parse(JSON.stringify(next)));
        lastRoom = room;
      }
    });

    const auth = {
      userId: () => authUserId,
      ready: () => true,
      error: () => null,
    } as unknown as AuthService;

    TestBed.configureTestingModule({
      providers: [
        UndoService,
        { provide: IdService, useValue: { newId } },
        { provide: GameStateService, useValue: { runInTransaction: runInTransactionMock } },
        { provide: AuthService, useValue: auth },
      ],
    });

    service = TestBed.inject(UndoService);
  });

  function addProperty(room: Room, playerId: string, propertyId: string, state: Partial<PlayerProperty> = {}): void {
    const player = room.players.find((p) => p.id === playerId)!;
    player.properties.push({
      propertyId,
      houses: 0,
      hasHotel: false,
      mortgaged: false,
      ...state,
    });
  }

  function makeEntry(partial: Partial<TransactionLogEntry>): TransactionLogEntry {
    return {
      id: newId(),
      timestamp: Date.now(),
      type: 'transfer',
      amount: 0,
      description: '',
      ...partial,
    };
  }

  it('returns null undoable entry for an empty log', () => {
    const room = makeRoom();
    expect(service.undoableEntry(room, 'u1')).toBeNull();
  });

  it('reverses a transfer from player to player', async () => {
    lastRoom = makeRoom();
    lastRoom.log.push(makeEntry({ type: 'transfer', fromPlayerId: 'u1', toPlayerId: 'u2', amount: 100, description: 'Pago' }));
    lastRoom.players[0].cash = 1400;
    lastRoom.players[1].cash = 1100;

    await service.undoLast('ROOM');

    expect(lastRoom!.players[0].cash).toBe(1500);
    expect(lastRoom!.players[1].cash).toBe(1000);
    expect(lastRoom!.log[0].metadata?.['undone']).toBe(true);
    expect(lastRoom!.log[1].type).toBe('undo');
    expect(lastRoom!.log[1].fromPlayerId).toBe('u2');
    expect(lastRoom!.log[1].toPlayerId).toBe('u1');
  });

  it('marks the original entry as undone and appends an undo entry with undoneBy metadata', async () => {
    lastRoom = makeRoom();
    lastRoom.log.push(makeEntry({ type: 'transfer', fromPlayerId: 'u1', toPlayerId: 'u2', amount: 100, description: 'Pago' }));
    lastRoom.players[0].cash = 1400;
    lastRoom.players[1].cash = 1100;

    await service.undoLast('ROOM');

    expect(lastRoom!.log[0].metadata?.['undone']).toBe(true);
    expect(lastRoom!.log[1].type).toBe('undo');
    expect(lastRoom!.log[1].metadata?.['undoesId']).toBe(lastRoom!.log[0].id);
    expect(lastRoom!.log[1].metadata?.['undoneBy']).toBe('u1');
    expect(lastRoom!.log[1].description).toBe('Deshecho: Pago');
  });

  it('reverses a salary from bank to player', async () => {
    lastRoom = makeRoom();
    lastRoom.log.push(makeEntry({ type: 'transfer', fromPlayerId: 'bank', toPlayerId: 'u1', amount: 200, description: 'Sueldo' }));
    lastRoom.players[0].cash = 1700;

    await service.undoLast('ROOM');

    expect(lastRoom!.players[0].cash).toBe(1500);
  });

  it('reverses a tax from player to bank', async () => {
    lastRoom = makeRoom();
    lastRoom.log.push(makeEntry({ type: 'transfer', fromPlayerId: 'u1', toPlayerId: 'bank', amount: 200, description: 'Impuesto' }));
    lastRoom.players[0].cash = 1300;

    await service.undoLast('ROOM');

    expect(lastRoom!.players[0].cash).toBe(1500);
  });

  it('reverses a property purchase', async () => {
    lastRoom = makeRoom();
    addProperty(lastRoom, 'u1', 'p1');
    lastRoom.players[0].cash = 1300;
    lastRoom.log.push(makeEntry({ type: 'buy-property', fromPlayerId: 'u1', toPlayerId: 'bank', amount: 200, description: 'Compra', propertyIds: ['p1'] }));

    await service.undoLast('ROOM');

    expect(lastRoom!.players[0].cash).toBe(1500);
    expect(lastRoom!.players[0].properties).toHaveLength(0);
  });

  it('reverses a mortgage', async () => {
    lastRoom = makeRoom();
    addProperty(lastRoom, 'u1', 'p1', { mortgaged: true });
    lastRoom.players[0].cash = 1700;
    lastRoom.log.push(makeEntry({ type: 'mortgage', fromPlayerId: 'bank', toPlayerId: 'u1', amount: 200, description: 'Hipoteca', propertyIds: ['p1'] }));

    await service.undoLast('ROOM');

    expect(lastRoom!.players[0].cash).toBe(1500);
    expect(lastRoom!.players[0].properties[0].mortgaged).toBe(false);
  });

  it('reverses an unmortgage', async () => {
    lastRoom = makeRoom();
    addProperty(lastRoom, 'u1', 'p1', { mortgaged: false });
    lastRoom.players[0].cash = 1280;
    lastRoom.log.push(makeEntry({ type: 'unmortgage', fromPlayerId: 'u1', toPlayerId: 'bank', amount: 220, description: 'Deshipoteca', propertyIds: ['p1'] }));

    await service.undoLast('ROOM');

    expect(lastRoom!.players[0].cash).toBe(1500);
    expect(lastRoom!.players[0].properties[0].mortgaged).toBe(true);
  });

  it('reverses building a house', async () => {
    lastRoom = makeRoom();
    addProperty(lastRoom, 'u1', 'p1', { houses: 1 });
    lastRoom.players[0].cash = 1400;
    lastRoom.log.push(makeEntry({ type: 'build-houses', fromPlayerId: 'u1', toPlayerId: 'bank', amount: 100, description: 'Casa', propertyIds: ['p1'], metadata: { buildKind: 'house', count: 1 } }));

    await service.undoLast('ROOM');

    expect(lastRoom!.players[0].cash).toBe(1500);
    expect(lastRoom!.players[0].properties[0].houses).toBe(0);
  });

  it('reverses building a hotel', async () => {
    lastRoom = makeRoom();
    addProperty(lastRoom, 'u1', 'p1', { houses: 0, hasHotel: true });
    lastRoom.players[0].cash = 1200;
    lastRoom.log.push(makeEntry({ type: 'build-houses', fromPlayerId: 'u1', toPlayerId: 'bank', amount: 300, description: 'Hotel', propertyIds: ['p1'], metadata: { buildKind: 'hotel' } }));

    await service.undoLast('ROOM');

    expect(lastRoom!.players[0].cash).toBe(1500);
    expect(lastRoom!.players[0].properties[0].hasHotel).toBe(false);
    expect(lastRoom!.players[0].properties[0].houses).toBe(4);
  });

  it('reverses selling a house', async () => {
    lastRoom = makeRoom();
    addProperty(lastRoom, 'u1', 'p1', { houses: 0 });
    lastRoom.players[0].cash = 1550;
    lastRoom.log.push(makeEntry({ type: 'sell-houses', fromPlayerId: 'bank', toPlayerId: 'u1', amount: 50, description: 'Venta casa', propertyIds: ['p1'], metadata: { buildKind: 'house', count: 1 } }));

    await service.undoLast('ROOM');

    expect(lastRoom!.players[0].cash).toBe(1500);
    expect(lastRoom!.players[0].properties[0].houses).toBe(1);
  });

  it('reverses selling a hotel', async () => {
    lastRoom = makeRoom();
    addProperty(lastRoom, 'u1', 'p1', { houses: 4, hasHotel: false });
    lastRoom.players[0].cash = 1650;
    lastRoom.log.push(makeEntry({ type: 'sell-houses', fromPlayerId: 'bank', toPlayerId: 'u1', amount: 150, description: 'Venta hotel', propertyIds: ['p1'], metadata: { buildKind: 'hotel' } }));

    await service.undoLast('ROOM');

    expect(lastRoom!.players[0].cash).toBe(1500);
    expect(lastRoom!.players[0].properties[0].hasHotel).toBe(true);
    expect(lastRoom!.players[0].properties[0].houses).toBe(0);
  });

  it('chains multiple undos in order', async () => {
    lastRoom = makeRoom();
    lastRoom.log.push(makeEntry({ type: 'transfer', fromPlayerId: 'bank', toPlayerId: 'u1', amount: 200, description: 'Sueldo' }));
    lastRoom.log.push(makeEntry({ type: 'transfer', fromPlayerId: 'u1', toPlayerId: 'u2', amount: 100, description: 'Pago' }));
    lastRoom.players[0].cash = 1600;
    lastRoom.players[1].cash = 1100;

    await service.undoLast('ROOM');
    expect(lastRoom!.players[0].cash).toBe(1700);
    expect(lastRoom!.players[1].cash).toBe(1000);

    await service.undoLast('ROOM');
    expect(lastRoom!.players[0].cash).toBe(1500);
    expect(lastRoom!.players[1].cash).toBe(1000);
  });

  it('blocks undo when another player acted after', async () => {
    lastRoom = makeRoom();
    lastRoom.log.push(makeEntry({ type: 'transfer', fromPlayerId: 'u1', toPlayerId: 'u2', amount: 100, description: 'Pago' }));
    lastRoom.log.push(makeEntry({ type: 'transfer', fromPlayerId: 'u2', toPlayerId: 'u1', amount: 50, description: 'Devolución' }));

    await expect(service.undoLast('ROOM')).rejects.toThrow('No hay ninguna acción tuya que se pueda deshacer');
  });

  it('blocks undo of another player\'s action', async () => {
    authUserId = 'u2';
    lastRoom = makeRoom();
    lastRoom.log.push(makeEntry({ type: 'transfer', fromPlayerId: 'u1', toPlayerId: 'u2', amount: 100, description: 'Pago' }));

    await expect(service.undoLast('ROOM')).rejects.toThrow('No hay ninguna acción tuya que se pueda deshacer');
  });

  it('fails undo of transfer when recipient no longer has funds', async () => {
    lastRoom = makeRoom();
    lastRoom.log.push(makeEntry({ type: 'transfer', fromPlayerId: 'u1', toPlayerId: 'u2', amount: 100, description: 'Pago' }));
    lastRoom.players[0].cash = 1400;
    lastRoom.players[1].cash = 50;

    await expect(service.undoLast('ROOM')).rejects.toThrow('ya no tiene suficiente dinero');
  });

  it('does not undo unsupported types (e.g. bankruptcy)', async () => {
    lastRoom = makeRoom();
    lastRoom.log.push(makeEntry({ type: 'bankruptcy', fromPlayerId: 'u1', toPlayerId: 'bank', amount: 0, description: 'Quiebra' }));

    await expect(service.undoLast('ROOM')).rejects.toThrow('No hay ninguna acción tuya que se pueda deshacer');
  });
});
