import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import {
  ACTIVE_ROOM_TTL_MS,
  FINISHED_ROOM_RETENTION_MS,
  RoomJanitorService,
  classifyRoom,
} from './room-janitor.service';
import { AuthService } from './auth.service';
import { FirebaseInitService } from './firebase-init.service';
import type { Room } from '../models';

const now = 1_700_000_000_000;

function makeRoom(partial: Partial<Room> & { id: string }): Room {
  return {
    editionId: 'ED',
    hostId: 'u1',
    status: 'lobby',
    players: [],
    log: [],
    trades: [],
    createdAt: now,
    updatedAt: now,
    ...partial,
  } as Room;
}

describe('RoomJanitorService', () => {
  let service: RoomJanitorService;
  let authUserId: string | null = 'u1';

  beforeEach(() => {
    authUserId = 'u1';

    const firebase = {
      db: {},
    } as unknown as FirebaseInitService;

    const auth = {
      userId: () => authUserId,
      ready: () => true,
      error: () => null,
    } as unknown as AuthService;

    TestBed.configureTestingModule({
      providers: [
        RoomJanitorService,
        { provide: FirebaseInitService, useValue: firebase },
        { provide: AuthService, useValue: auth },
      ],
    });

    service = TestBed.inject(RoomJanitorService);
  });

  it('does nothing when user is not authenticated', async () => {
    authUserId = null;
    await expect(service.cleanStaleRooms()).resolves.toBeUndefined();
  });

  describe('classifyRoom', () => {
    it('keeps a finished room within retention', () => {
      const room = makeRoom({
        id: 'r1',
        status: 'finished',
        finishedAt: now - FINISHED_ROOM_RETENTION_MS + 1000,
      });
      expect(classifyRoom(room, now)).toEqual({
        action: 'keep',
        reason: 'finished room within retention window',
      });
    });

    it('deletes a finished room past retention', () => {
      const room = makeRoom({
        id: 'r1',
        status: 'finished',
        finishedAt: now - FINISHED_ROOM_RETENTION_MS - 1,
      });
      expect(classifyRoom(room, now)).toEqual({
        action: 'delete',
        reason: 'finished room retention expired',
      });
    });

    it('deletes a never-started lobby past TTL', () => {
      const room = makeRoom({
        id: 'r1',
        status: 'lobby',
        createdAt: now - ACTIVE_ROOM_TTL_MS - 1,
        updatedAt: now - ACTIVE_ROOM_TTL_MS - 1,
        log: [],
      });
      expect(classifyRoom(room, now)).toEqual({
        action: 'delete',
        reason: 'never-started lobby older than active TTL',
      });
    });

    it('finishes an already-started lobby past TTL', () => {
      const room = makeRoom({
        id: 'r1',
        status: 'lobby',
        createdAt: now - ACTIVE_ROOM_TTL_MS - 1,
        updatedAt: now - ACTIVE_ROOM_TTL_MS - 1,
        log: [{ id: 'x', timestamp: 0, type: 'transfer', amount: 0, description: '' }],
      });
      expect(classifyRoom(room, now)).toEqual({
        action: 'finish',
        reason: 'inactive lobby older than active TTL',
      });
    });

    it('finishes an inactive playing room past TTL', () => {
      const room = makeRoom({
        id: 'r1',
        status: 'playing',
        createdAt: now - ACTIVE_ROOM_TTL_MS - 1,
        updatedAt: now - ACTIVE_ROOM_TTL_MS - 1,
      });
      expect(classifyRoom(room, now)).toEqual({
        action: 'finish',
        reason: 'inactive playing room older than active TTL',
      });
    });

    it('keeps a lobby within TTL', () => {
      const room = makeRoom({
        id: 'r1',
        status: 'lobby',
        createdAt: now - 1000,
        updatedAt: now - 1000,
      });
      expect(classifyRoom(room, now)).toEqual({
        action: 'keep',
        reason: 'lobby within active TTL',
      });
    });

    it('keeps a playing room within TTL', () => {
      const room = makeRoom({
        id: 'r1',
        status: 'playing',
        createdAt: now - 1000,
        updatedAt: now - 1000,
      });
      expect(classifyRoom(room, now)).toEqual({
        action: 'keep',
        reason: 'playing room within active TTL',
      });
    });

    it('uses lastTouch when finishedAt is missing', () => {
      const room = makeRoom({
        id: 'r1',
        status: 'finished',
        createdAt: now - FINISHED_ROOM_RETENTION_MS - 1,
        updatedAt: now - FINISHED_ROOM_RETENTION_MS - 1,
      });
      expect(classifyRoom(room, now)).toEqual({
        action: 'delete',
        reason: 'finished room retention expired',
      });
    });
  });
});
