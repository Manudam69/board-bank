import { Service, inject, signal } from '@angular/core';
import { doc, getDoc } from 'firebase/firestore';

import { AuthService } from './auth.service';
import { FirebaseInitService } from './firebase-init.service';
import { ACTIVE_ROOM_TTL_MS } from './room-janitor.service';
import type { Room } from '../models';

const STORAGE_KEY = 'boardbank-active-room';

export interface ActiveRoomRecord {
  roomId: string;
}

export type ActiveRoomStatus =
  | { kind: 'rejoin'; room: Room }
  | { kind: 'drop'; reason: 'missing' | 'finished' | 'not-a-player' | 'stale' };

@Service()
export class ActiveRoomService {
  private readonly auth = inject(AuthService);
  private readonly firebase = inject(FirebaseInitService);
  private readonly db = this.firebase.db;

  readonly activeRoom = signal<Room | null>(null);
  readonly checking = signal(false);

  record(roomId: string): void {
    if (!roomId) return;
    try {
      const payload: ActiveRoomRecord = { roomId: roomId.toUpperCase() };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    } catch {
      // ignore storage errors (private mode, quota, etc.)
    }
  }

  clear(roomId?: string): void {
    if (roomId) {
      const stored = this.readRecord();
      if (!stored || stored.roomId !== roomId.toUpperCase()) return;
    }
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // ignore
    }
  }

  async check(): Promise<void> {
    if (this.checking()) return;

    const uid = this.auth.userId();
    const record = this.readRecord();
    if (!uid || !record) {
      this.activeRoom.set(null);
      return;
    }

    this.checking.set(true);
    try {
      const snap = await getDoc(doc(this.db, 'rooms', record.roomId));
      const room = snap.exists() ? (snap.data() as Room) : null;
      const status = evaluateActiveRoom(room, uid, Date.now());

      if (status.kind === 'drop') {
        this.clear(record.roomId);
        this.activeRoom.set(null);
      } else {
        this.activeRoom.set(status.room);
      }
    } catch {
      // On read errors (offline, permissions) don't clear the record; the user
      // may recover later. Just don't show the banner this time.
      this.activeRoom.set(null);
    } finally {
      this.checking.set(false);
    }
  }

  private readRecord(): ActiveRoomRecord | null {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw) as ActiveRoomRecord;
      return parsed.roomId ? parsed : null;
    } catch {
      return null;
    }
  }
}

export function evaluateActiveRoom(
  room: Room | null,
  uid: string | null,
  now: number,
): ActiveRoomStatus {
  if (!room || !uid) {
    return { kind: 'drop', reason: 'missing' };
  }

  if (room.status === 'finished') {
    return { kind: 'drop', reason: 'finished' };
  }

  if (room.status !== 'playing') {
    return { kind: 'drop', reason: 'missing' };
  }

  if (!room.players.some((player) => player.id === uid)) {
    return { kind: 'drop', reason: 'not-a-player' };
  }

  const lastTouch = Math.max(room.updatedAt ?? 0, room.createdAt ?? 0);
  if (now - lastTouch >= ACTIVE_ROOM_TTL_MS) {
    return { kind: 'drop', reason: 'stale' };
  }

  return { kind: 'rejoin', room };
}
