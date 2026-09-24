import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { ActiveRoomService, evaluateActiveRoom } from './active-room.service';
import { AuthService } from './auth.service';
import { FirebaseInitService } from './firebase-init.service';
import { ACTIVE_ROOM_TTL_MS } from './room-janitor.service';
import type { Room } from '../models';

const UID = 'uid-abc';

function makeRoom(overrides: Partial<Room> = {}): Room {
  return {
    id: 'ABCD1',
    editionId: 'classic-spain',
    hostId: UID,
    status: 'playing',
    players: [
      {
        id: UID,
        name: 'Ana',
        avatarColor: 'bg-red-500',
        cash: 1500,
        properties: [],
        bankrupt: false,
        host: true,
        joinedAt: 0,
      },
    ],
    log: [],
    trades: [],
    createdAt: 0,
    updatedAt: Date.now(),
    ...overrides,
  };
}

describe('evaluateActiveRoom', () => {
  it('returns rejoin for an active playing room where the uid is a player', () => {
    const room = makeRoom();
    const result = evaluateActiveRoom(room, UID, Date.now());
    expect(result).toEqual({ kind: 'rejoin', room });
  });

  it('drops if the room is missing', () => {
    const result = evaluateActiveRoom(null, UID, Date.now());
    expect(result).toEqual({ kind: 'drop', reason: 'missing' });
  });

  it('drops if the room is finished (already has a winner/ended)', () => {
    const room = makeRoom({ status: 'finished', finishedAt: Date.now() });
    const result = evaluateActiveRoom(room, UID, Date.now());
    expect(result).toEqual({ kind: 'drop', reason: 'finished' });
  });

  it('drops if the room is in lobby (only playing is rejoinable)', () => {
    const room = makeRoom({ status: 'lobby' });
    const result = evaluateActiveRoom(room, UID, Date.now());
    expect(result).toEqual({ kind: 'drop', reason: 'missing' });
  });

  it('drops if the uid is no longer a player in the room', () => {
    const room = makeRoom({
      players: [
        {
          id: 'other-uid',
          name: 'Otro',
          avatarColor: 'bg-blue-500',
          cash: 0,
          properties: [],
          bankrupt: false,
          host: true,
          joinedAt: 0,
        },
      ],
    });
    const result = evaluateActiveRoom(room, UID, Date.now());
    expect(result).toEqual({ kind: 'drop', reason: 'not-a-player' });
  });

  it('drops if the room has not been touched within the active TTL (expired)', () => {
    const now = Date.now();
    const room = makeRoom({ createdAt: now - ACTIVE_ROOM_TTL_MS - 1, updatedAt: now - ACTIVE_ROOM_TTL_MS - 1 });
    const result = evaluateActiveRoom(room, UID, now);
    expect(result).toEqual({ kind: 'drop', reason: 'stale' });
  });
});

describe('ActiveRoomService storage', () => {
  const store: Record<string, string> = {};

  beforeEach(() => {
    vi.stubGlobal('localStorage', {
      getItem(key: string) {
        return store[key] ?? null;
      },
      setItem(key: string, value: string) {
        store[key] = value;
      },
      removeItem(key: string) {
        delete store[key];
      },
      clear() {
        Object.keys(store).forEach((k) => delete store[k]);
      },
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  function setupService(uid: string | null) {
    const auth = { userId: signal(uid), ready: signal(true), error: signal(null) } as unknown as AuthService;
    const firebase = { db: {} } as unknown as FirebaseInitService;

    return TestBed.configureTestingModule({
      providers: [
        { provide: AuthService, useValue: auth },
        { provide: FirebaseInitService, useValue: firebase },
        ActiveRoomService,
      ],
    }).inject(ActiveRoomService);
  }

  it('records a room id and reads it back', () => {
    const service = setupService('uid-1');
    service.record('abcd1');
    expect(localStorage.getItem('boardbank-active-room')).toContain('"roomId":"ABCD1"');
  });

  it('clears the stored record for the same room', () => {
    const service = setupService('uid-1');
    service.record('abcd1');
    service.clear('abcd1');
    expect(localStorage.getItem('boardbank-active-room')).toBeNull();
  });

  it('does not clear a stored record of a different room', () => {
    const service = setupService('uid-1');
    service.record('room-a');
    service.clear('room-b');
    expect(localStorage.getItem('boardbank-active-room')).toContain('ROOM-A');
  });

  it('clears without a room id', () => {
    const service = setupService('uid-1');
    service.record('room-a');
    service.clear();
    expect(localStorage.getItem('boardbank-active-room')).toBeNull();
  });
});
