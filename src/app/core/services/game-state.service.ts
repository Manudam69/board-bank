import { Injectable, inject, signal } from '@angular/core';
import { doc, onSnapshot, runTransaction, updateDoc, type Unsubscribe } from 'firebase/firestore';
import { FirebaseInitService } from './firebase-init.service';
import { cleanFirestoreData } from '../utils/clean-firestore-data';
import type { Room } from '../models';

const HEARTBEAT_INTERVAL_MS = 60_000;

@Injectable({ providedIn: 'root' })
export class GameStateService {
  private readonly firebase = inject(FirebaseInitService);
  private readonly db = this.firebase.db;
  private unsub?: Unsubscribe;
  private heartbeatTimer?: ReturnType<typeof setInterval>;

  readonly room = signal<Room | null>(null);
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  readonly connected = signal(false);

  subscribe(roomId: string): void {
    this.unsub?.();
    this.stopHeartbeat();
    this.loading.set(true);
    this.error.set(null);
    this.connected.set(false);

    const ref = doc(this.db, 'rooms', roomId);
    this.unsub = onSnapshot(
      ref,
      (snapshot) => {
        if (snapshot.exists()) {
          this.room.set(snapshot.data() as Room);
        } else {
          this.error.set('La sala ya no existe.');
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
    this.unsub?.();
    this.unsub = undefined;
    this.stopHeartbeat();
    this.room.set(null);
    this.connected.set(false);
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
