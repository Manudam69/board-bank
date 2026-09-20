import { Injectable, inject } from '@angular/core';
import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';
import { FirebaseInitService } from './firebase-init.service';
import { IdService } from './id.service';
import { AuthService } from './auth.service';
import type { Player, Room } from '../models';

@Injectable({ providedIn: 'root' })
export class RoomService {
  private readonly firebase = inject(FirebaseInitService);
  private readonly id = inject(IdService);
  private readonly auth = inject(AuthService);
  private readonly db = this.firebase.db;

  private roomsCol() {
    return 'rooms';
  }

  private currentUid(): string {
    const uid = this.auth.userId();
    if (!uid) throw new Error('Debes estar conectado para realizar esta acción');
    return uid;
  }

  async createRoom(editionId: string, hostName: string): Promise<Room> {
    const hostId = this.currentUid();
    const roomId = this.id.roomCode();
    const host: Player = {
      id: hostId,
      name: hostName,
      avatarColor: this.pickColor(0),
      cash: 0,
      properties: [],
      bankrupt: false,
      host: true,
      joinedAt: Date.now(),
    };

    const room: Room = {
      id: roomId,
      editionId,
      hostId,
      status: 'lobby',
      players: [host],
      log: [],
      trades: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    await setDoc(doc(this.db, this.roomsCol(), roomId), room);
    return room;
  }

  async joinRoom(roomId: string, playerName: string): Promise<Room> {
    const roomRef = doc(this.db, this.roomsCol(), roomId.toUpperCase());
    const snap = await getDoc(roomRef);
    if (!snap.exists()) {
      throw new Error('Sala no encontrada. Revisa el código.');
    }

    const room = snap.data() as Room;
    if (room.status !== 'lobby') {
      throw new Error('La partida ya ha comenzado o ha terminado.');
    }

    const uid = this.currentUid();
    const existing = room.players.find((p) => p.id === uid);
    if (existing) {
      return room;
    }

    if (room.players.some((p) => p.name.toLowerCase() === playerName.toLowerCase())) {
      throw new Error('Ya existe un jugador con ese nombre.');
    }
    if (room.players.length >= 8) {
      throw new Error('La sala está completa (máx. 8 jugadores).');
    }

    const newPlayer: Player = {
      id: uid,
      name: playerName,
      avatarColor: this.pickColor(room.players.length),
      cash: 0,
      properties: [],
      bankrupt: false,
      host: false,
      joinedAt: Date.now(),
    };

    const updatedPlayers = [...room.players, newPlayer];
    await updateDoc(roomRef, { players: updatedPlayers });

    return { ...room, players: updatedPlayers };
  }

  async startGame(roomId: string, editionStartingMoney: number): Promise<void> {
    const uid = this.currentUid();
    const roomRef = doc(this.db, this.roomsCol(), roomId);
    const snap = await getDoc(roomRef);
    const room = snap.data() as Room;

    if (room.hostId !== uid) {
      throw new Error('Solo el host puede empezar la partida');
    }

    const players = room.players.map((p) => ({
      ...p,
      cash: editionStartingMoney,
    }));

    await updateDoc(roomRef, { status: 'playing', players });
  }

  async leaveRoom(roomId: string, playerId: string): Promise<void> {
    const uid = this.currentUid();
    if (uid !== playerId) {
      throw new Error('No puedes expulsar a otro jugador');
    }

    const roomRef = doc(this.db, this.roomsCol(), roomId);
    const snap = await getDoc(roomRef);
    const room = snap.data() as Room;

    const remaining = room.players.filter((p) => p.id !== playerId);
    if (remaining.length === 0) {
      await updateDoc(roomRef, { status: 'finished' });
      return;
    }

    if (room.hostId === playerId) {
      remaining[0].host = true;
    }
    await updateDoc(roomRef, {
      players: remaining,
      hostId: remaining[0].id,
    });
  }

  private pickColor(index: number): string {
    const colors = [
      'bg-red-500',
      'bg-blue-500',
      'bg-green-500',
      'bg-yellow-500',
      'bg-purple-500',
      'bg-pink-500',
      'bg-indigo-500',
      'bg-orange-500',
    ];
    return colors[index % colors.length];
  }
}
