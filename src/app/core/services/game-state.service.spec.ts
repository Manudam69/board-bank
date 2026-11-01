import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GameStateService } from './game-state.service';
import { ActiveRoomService } from './active-room.service';
import { FirebaseInitService } from './firebase-init.service';
import type { Room } from '../models';

const firestore = vi.hoisted(() => ({
  getDocFromServer: vi.fn(),
  onSnapshot: vi.fn(),
  updateDoc: vi.fn(),
}));
vi.mock('firebase/firestore', () => ({
  doc: (_db: unknown, _collection: string, id: string) => ({ id }),
  getDocFromServer: firestore.getDocFromServer,
  onSnapshot: firestore.onSnapshot,
  updateDoc: firestore.updateDoc,
  runTransaction: vi.fn(),
}));

describe('GameStateService refresh', () => {
  let service: GameStateService;
  const room: Room = {
    id: 'ROOM1', editionId: 'classic-spain', hostId: 'u1', status: 'playing',
    players: [], log: [], trades: [], createdAt: 1, updatedAt: 10,
  };

  beforeEach(() => {
    firestore.getDocFromServer.mockReset();
    firestore.onSnapshot.mockReset().mockReturnValue(vi.fn());
    firestore.updateDoc.mockReset().mockResolvedValue(undefined);
    TestBed.configureTestingModule({
      providers: [
        { provide: FirebaseInitService, useValue: { db: {} } },
        { provide: ActiveRoomService, useValue: { clear: vi.fn() } },
      ],
    });
    service = TestBed.inject(GameStateService);
  });

  afterEach(() => service.unsubscribe());

  it('reads from the server without clearing room data or entering the loading screen', async () => {
    service.subscribe('ROOM1');
    service.room.set(room);
    service.loading.set(false);
    service.connected.set(true);
    const updated = { ...room, updatedAt: 20 };
    firestore.getDocFromServer.mockResolvedValue({ exists: () => true, data: () => updated });
    await service.refresh();
    expect(service.room()).toEqual(updated);
    expect(service.loading()).toBe(false);
    expect(firestore.onSnapshot).toHaveBeenCalledOnce();
  });

  it('does not overwrite more recent realtime data', async () => {
    service.subscribe('ROOM1');
    service.room.set({ ...room, updatedAt: 30 });
    service.connected.set(true);
    firestore.getDocFromServer.mockResolvedValue({ exists: () => true, data: () => room });
    await service.refresh();
    expect(service.room()?.updatedAt).toBe(30);
  });

  it('ignores old refresh results after leaving and rejoining the same room', async () => {
    service.subscribe('ROOM1');
    let finish: (value: unknown) => void = () => {};
    firestore.getDocFromServer.mockImplementation(() => new Promise((resolve) => { finish = resolve; }));
    const pending = service.refresh();
    service.unsubscribe();
    service.subscribe('ROOM1');
    finish({ exists: () => true, data: () => room });
    await pending;
    expect(service.room()).toBeNull();
  });

  it('propagates offline and missing-room errors and preserves displayed data', async () => {
    service.subscribe('ROOM1');
    service.room.set(room);
    firestore.getDocFromServer.mockRejectedValue(new Error('Sin conexión'));
    await expect(service.refresh()).rejects.toThrow('Sin conexión');
    firestore.getDocFromServer.mockResolvedValue({ exists: () => false });
    await expect(service.refresh()).rejects.toThrow('La sala ya no existe.');
    expect(service.room()).toEqual(room);
  });

  it('reconnects a failed listener without hiding the page', async () => {
    service.subscribe('ROOM1');
    service.room.set(room);
    firestore.getDocFromServer.mockResolvedValue({ exists: () => true, data: () => room });
    await service.refresh();
    expect(firestore.onSnapshot).toHaveBeenCalledTimes(2);
    expect(service.loading()).toBe(false);
  });
});
