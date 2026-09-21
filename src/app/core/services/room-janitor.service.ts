import { Injectable, inject } from '@angular/core';
import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  query,
  updateDoc,
  where,
} from 'firebase/firestore';
import { FirebaseInitService } from './firebase-init.service';
import { AuthService } from './auth.service';
import type { Room, RoomStatus } from '../models';

/** Inactivity TTL for active rooms before they are marked finished (ms). */
export const ACTIVE_ROOM_TTL_MS = 24 * 60 * 60 * 1000;

/** Retention window for finished rooms before deletion (ms). */
export const FINISHED_ROOM_RETENTION_MS = 7 * 24 * 60 * 60 * 1000;

export type RoomClassification =
  | { action: 'keep'; reason: string }
  | { action: 'finish' | 'delete'; reason: string };

export interface JanitorOptions {
  activeTtlMs?: number;
  finishedRetentionMs?: number;
}

@Injectable({ providedIn: 'root' })
export class RoomJanitorService {
  private readonly firebase = inject(FirebaseInitService);
  private readonly auth = inject(AuthService);
  private readonly db = this.firebase.db;

  private roomsCol() {
    return collection(this.db, 'rooms');
  }

  /**
   * Client-only janitor run. Classifies every room and applies the decided action.
   * Failures for individual rooms are logged and swallowed so that one stale room
   * does not block the rest.
   */
  async cleanStaleRooms(options: JanitorOptions = {}): Promise<void> {
    const uid = this.auth.userId();
    if (!uid) return;

    const activeTtlMs = options.activeTtlMs ?? ACTIVE_ROOM_TTL_MS;
    const finishedRetentionMs = options.finishedRetentionMs ?? FINISHED_ROOM_RETENTION_MS;
    const now = Date.now();

    const snapshot = await getDocs(this.roomsCol());
    const results = await Promise.allSettled(
      snapshot.docs.map(async (d) => {
        const room = { id: d.id, ...(d.data() as Omit<Room, 'id'>) } as Room;
        const classification = classifyRoom(room, now, activeTtlMs, finishedRetentionMs);

        if (classification.action === 'keep') {
          return { roomId: d.id, action: 'keep' as const };
        }

        const ref = doc(this.db, 'rooms', d.id);
        if (classification.action === 'delete') {
          await deleteDoc(ref);
        } else {
          await updateDoc(ref, {
            status: 'finished',
            finishedAt: Date.now(),
            updatedAt: Date.now(),
          });
        }
        return { roomId: d.id, action: classification.action, reason: classification.reason };
      }),
    );

    for (const result of results) {
      if (result.status === 'rejected') {
        // eslint-disable-next-line no-console
        console.error('Room janitor failed for a room:', result.reason);
      }
    }
  }
}

export function classifyRoom(
  room: Pick<Room, 'status' | 'createdAt' | 'updatedAt' | 'finishedAt' | 'log'>,
  now: number,
  activeTtlMs = ACTIVE_ROOM_TTL_MS,
  finishedRetentionMs = FINISHED_ROOM_RETENTION_MS,
): RoomClassification {
  const status = room.status as RoomStatus;
  const lastTouch = Math.max(room.updatedAt ?? 0, room.createdAt ?? 0);

  if (status === 'finished') {
    const finishedAt = room.finishedAt ?? lastTouch;
    if (now - finishedAt >= finishedRetentionMs) {
      return { action: 'delete', reason: 'finished room retention expired' };
    }
    return { action: 'keep', reason: 'finished room within retention window' };
  }

  if (status === 'lobby') {
    const neverStarted = (room.log?.length ?? 0) === 0;
    if (neverStarted && now - lastTouch >= activeTtlMs) {
      return { action: 'delete', reason: 'never-started lobby older than active TTL' };
    }
    if (now - lastTouch >= activeTtlMs) {
      return { action: 'finish', reason: 'inactive lobby older than active TTL' };
    }
    return { action: 'keep', reason: 'lobby within active TTL' };
  }

  // status === 'playing'
  if (now - lastTouch >= activeTtlMs) {
    return { action: 'finish', reason: 'inactive playing room older than active TTL' };
  }
  return { action: 'keep', reason: 'playing room within active TTL' };
}
