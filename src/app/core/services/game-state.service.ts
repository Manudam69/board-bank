import { Injectable, inject, signal } from '@angular/core';
import { doc, getDocFromServer, onSnapshot, runTransaction, updateDoc, type Unsubscribe } from 'firebase/firestore';
import { ActiveRoomService } from './active-room.service';
import { FirebaseInitService } from './firebase-init.service';
import { cleanFirestoreData } from '../utils/clean-firestore-data';
import type { Room } from '../models';

const HEARTBEAT_INTERVAL_MS = 60_000;

@Injectable({ providedIn: 'root' })
export class GameStateService {
  private readonly firebase = inject(FirebaseInitService);
  private readonly activeRoom = inject(ActiveRoomService);
  private readonly db = this.firebase.db;
  private unsub?: Unsubscribe;
  private heartbeatTimer?: ReturnType<typeof setInterval>;
  private subscribedRoomId?: string;
  private subscriptionVersion = 0;

  readonly room = signal<Room | null>(null);
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  readonly connected = signal(false);

  subscribe(roomId: string, preserveRoom = false): void {
    this.subscriptionVersion++;
    this.unsub?.();
    this.stopHeartbeat();
    this.loading.set(!preserveRoom);
    this.error.set(null);
    this.connected.set(false);
    this.subscribedRoomId = roomId;

    const ref = doc(this.db, 'rooms', roomId);
    this.unsub = onSnapshot(
      ref,
      (snapshot) => {
        if (snapshot.exists()) {
          const room = snapshot.data() as Room;
          if (room.status === 'finished') {
            this.activeRoom.clear(roomId);
          }
          this.room.set(room);
        } else {
          this.error.set('La sala ya no existe.');
          this.activeRoom.clear(roomId);
          this.room.set(null);
        }
        this.loading.set(false);
        this.connected.set(true);
      },
      (err) => {
        this.error.set(err.message ?? 'Error de conexión con la sala.');
        this.loading.set(false);
        this.connected.set(false);
      },
    );

    this.startHeartbeat(ref);
  }

  unsubscribe(): void {
    this.subscriptionVersion++;
    this.unsub?.();
    this.unsub = undefined;
    this.subscribedRoomId = undefined;
    this.stopHeartbeat();
    this.room.set(null);
    this.connected.set(false);
  }

  async refresh(): Promise<void> {
    const version = this.subscriptionVersion;
    const roomId = this.subscribedRoomId;
    if (!roomId) throw new Error('No hay una sala conectada para actualizar.');
    const snap = await getDocFromServer(doc(this.db, 'rooms', roomId));
    if (version !== this.subscriptionVersion) return;
    if (!snap.exists()) throw new Error('La sala ya no existe.');
    const room = snap.data() as Room;
    const current = this.room();
    if (!current || (room.updatedAt ?? 0) >= (current.updatedAt ?? 0)) {
      this.room.set(room);
    }
    this.error.set(null);
    this.loading.set(false);
    if (room.status === 'finished') this.activeRoom.clear(roomId);
    if (!this.connected()) this.subscribe(roomId, true);
  }

  private startHeartbeat(ref: ReturnType<typeof doc>): void {
    this.touch(ref);
    this.heartbeatTimer = setInterval(() => this.touch(ref), HEARTBEAT_INTERVAL_MS);
  }

  private stopHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = undefined;
    }
  }

  private touch(ref: ReturnType<typeof doc>): void {
    updateDoc(ref, { updatedAt: Date.now() }).catch(() => {
      // Ignore heartbeat failures (offline permissions, deleted room, etc.).
    });
  }

  async runInTransaction(
    roomId: string,
    mutator: (room: Room) => Room | null,
  ): Promise<void> {
    const ref = doc(this.db, 'rooms', roomId);
    await runTransaction(this.db, async (transaction) => {
      const snap = await transaction.get(ref);
      if (!snap.exists()) throw new Error('La sala no existe');

      const current = snap.data() as Room;
      const next = mutator(current);
      if (!next) return;

      const toSave = cleanFirestoreData({ ...next, updatedAt: Date.now() });
      transaction.update(ref, toSave);
    });
  }

  roomRef(roomId: string) {
    return doc(this.db, 'rooms', roomId);
  }
}
