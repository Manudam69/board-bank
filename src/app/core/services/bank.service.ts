import { Injectable, inject } from '@angular/core';
import type { Player, Room, TransactionLogEntry } from '../models';
import { AuthService } from './auth.service';
import { GameStateService } from './game-state.service';
import { IdService } from './id.service';

@Injectable({ providedIn: 'root' })
export class BankService {
  private readonly gameState = inject(GameStateService);
  private readonly id = inject(IdService);
  private readonly auth = inject(AuthService);

  private buildLog(
    type: TransactionLogEntry['type'],
    amount: number,
    description: string,
    from?: string | 'bank',
    to?: string | 'bank',
    propertyIds?: string[],
    metadata?: Record<string, unknown>,
  ): TransactionLogEntry {
    return {
      id: this.id.newId(),
      timestamp: Date.now(),
      type,
      amount,
      description,
      fromPlayerId: from,
      toPlayerId: to,
      propertyIds,
      metadata,
    };
  }

  private requirePlayer(room: Room, playerId: string): Player {
    const p = room.players.find((x) => x.id === playerId);
    if (!p) throw new Error('Jugador no encontrado');
    if (p.bankrupt) throw new Error('El jugador está en quiebra');
    return p;
  }

  private ensureActor(playerId: string | 'bank' | undefined): void {
    if (playerId === 'bank' || playerId === undefined) return;
    const uid = this.auth.userId();
    if (uid !== playerId) {
      throw new Error('No puedes realizar operaciones sobre la cartera de otro jugador');
    }
  }

  transfer(
    roomId: string,
    fromId: string | 'bank',
    toId: string | 'bank',
    amount: number,
    reason: string,
    metadata?: Record<string, unknown>,
  ): Promise<void> {
    if (amount <= 0) throw new Error('La cantidad debe ser mayor que cero');
    if (fromId === toId) throw new Error('Origen y destino no pueden ser iguales');
    this.ensureActor(fromId);

    return this.gameState.runInTransaction(roomId, (room) => {
      const from = fromId === 'bank' ? undefined : this.requirePlayer(room, fromId);
      const to = toId === 'bank' ? undefined : this.requirePlayer(room, toId);

      if (from && from.cash < amount) {
        throw new Error(`${from.name} no tiene suficiente dinero`);
      }

      const players = room.players.map((p) => {
        if (from && p.id === from.id) return { ...p, cash: p.cash - amount };
        if (to && p.id === to.id) return { ...p, cash: p.cash + amount };
        return p;
      });

      const log = this.buildLog('transfer', amount, reason, fromId, toId, undefined, metadata);
      return { ...room, players, log: [...room.log, log] };
    });
  }

  payTax(
    roomId: string,
    playerId: string,
    amount: number,
    taxName: string,
    metadata?: Record<string, unknown>,
  ): Promise<void> {
    this.ensureActor(playerId);
    return this.transfer(roomId, playerId, 'bank', amount, `Impuesto: ${taxName}`, metadata);
  }

  payToBank(
    roomId: string,
    playerId: string,
    amount: number,
    description: string,
  ): Promise<void> {
    this.ensureActor(playerId);
    return this.transfer(roomId, playerId, 'bank', amount, description);
  }

  payFromBank(
    roomId: string,
    playerId: string,
    amount: number,
    description: string,
    metadata?: Record<string, unknown>,
  ): Promise<void> {
    this.ensureActor(playerId);
    return this.transfer(roomId, 'bank', playerId, amount, description, metadata);
  }

  declareBankruptcy(roomId: string, playerId: string): Promise<void> {
    this.ensureActor(playerId);
    return this.gameState.runInTransaction(roomId, (room) => {
      const player = this.requirePlayer(room, playerId);
      const players = room.players.map((p) =>
        p.id === playerId ? { ...p, cash: 0, bankrupt: true } : p,
      );
      const log = this.buildLog(
        'bankruptcy',
        0,
        `${player.name} se ha declarado en quiebra`,
        playerId,
        'bank',
        player.properties.map((pp) => pp.propertyId),
        { bankAction: 'bankruptcy' },
      );
      return { ...room, players, log: [...room.log, log] };
    });
  }
}
