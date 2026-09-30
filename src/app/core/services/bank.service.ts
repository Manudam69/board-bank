import { Injectable, inject } from '@angular/core';
import type { Player, Room, TransactionLogEntry } from '../models';
import { AuthService } from './auth.service';
import { GameStateService } from './game-state.service';
import { IdService } from './id.service';

export interface TransferMultiMetadata {
  transferGroupId: string;
  transferMulti: true;
  perPlayerAmount: number;
  recipientCount: number;
  totalAmount: number;
}

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

  transferMulti(
    roomId: string,
    fromId: string | 'bank',
    toIds: Array<string | 'bank'>,
    amountPerPlayer: number,
    reason: string,
  ): Promise<void> {
    if (amountPerPlayer <= 0) throw new Error('La cantidad debe ser mayor que cero');
    if (toIds.length === 0) throw new Error('Debe haber al menos un destinatario');
    if (new Set(toIds).size !== toIds.length) throw new Error('Los destinatarios no pueden repetirse');
    if (toIds.includes(fromId)) throw new Error('Origen y destino no pueden ser iguales');
    this.ensureActor(fromId);

    return this.gameState.runInTransaction(roomId, (room) => {
      const from = fromId === 'bank' ? undefined : this.requirePlayer(room, fromId);
      const total = amountPerPlayer * toIds.length;

      if (from && from.cash < total) {
        throw new Error(`${from.name} no tiene suficiente dinero`);
      }

      for (const toId of toIds) {
        if (toId !== 'bank') {
          this.requirePlayer(room, toId);
        }
      }

      const toSet = new Set(toIds);
      const players = room.players.map((p) => {
        if (from && p.id === from.id) return { ...p, cash: p.cash - total };
        if (toSet.has(p.id)) return { ...p, cash: p.cash + amountPerPlayer };
        return p;
      });

      const groupId = this.id.newId();
      const metadata: Record<string, unknown> = {
        transferGroupId: groupId,
        transferMulti: true,
        perPlayerAmount: amountPerPlayer,
        recipientCount: toIds.length,
        totalAmount: total,
      };

      const logs = toIds.map((toId) =>
        this.buildLog('transfer', amountPerPlayer, reason, fromId, toId, undefined, metadata),
      );

      return { ...room, players, log: [...room.log, ...logs] };
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

  payJailFine(roomId: string, playerId: string, amount: number): Promise<void> {
    if (!Number.isFinite(amount) || amount <= 0 || !Number.isInteger(amount)) {
      throw new Error('La fianza debe ser un número entero mayor que cero');
    }
    this.ensureActor(playerId);

    return this.gameState.runInTransaction(roomId, (room) => {
      const player = this.requirePlayer(room, playerId);

      if (player.cash < amount) {
        throw new Error(`${player.name} no tiene suficiente dinero`);
      }

      const players = room.players.map((p) =>
        p.id === player.id ? { ...p, cash: p.cash - amount } : p,
      );

      const log = this.buildLog(
        'bank-fee',
        amount,
        'Fianza de cárcel',
        playerId,
        'bank',
        undefined,
        { bankAction: 'jail-fine' },
      );

      return { ...room, players, log: [...room.log, log] };
    });
  }

  bankPayTo(
    roomId: string,
    toPlayerId: string,
    amount: number,
    description: string,
    metadata?: Record<string, unknown>,
  ): Promise<void> {
    if (!Number.isFinite(amount) || amount <= 0 || !Number.isInteger(amount)) {
      throw new Error('La cantidad debe ser un número entero mayor que cero');
    }

    const actorId = this.auth.userId();
    if (!actorId) throw new Error('No estás autenticado');

    return this.gameState.runInTransaction(roomId, (room) => {
      const to = this.requirePlayer(room, toPlayerId);

      const players = room.players.map((p) =>
        p.id === to.id ? { ...p, cash: p.cash + amount } : p,
      );

      const log = this.buildLog(
        'bank-payment',
        amount,
        description || 'Pago del Banco',
        'bank',
        toPlayerId,
        undefined,
        { ...(metadata ?? {}), bankAction: 'bank-payment', actorId },
      );

      return { ...room, players, log: [...room.log, log] };
    });
  }

  private cancelPendingTrades(room: Room, playerId: string): Room['trades'] {
    return room.trades.map((trade) =>
      trade.status === 'pending' &&
      (trade.fromPlayerId === playerId || trade.toPlayerId === playerId)
        ? { ...trade, status: 'cancelled' as const, resolvedAt: Date.now() }
        : trade,
    );
  }

  declareBankruptcy(roomId: string, playerId: string): Promise<void> {
    this.ensureActor(playerId);
    return this.gameState.runInTransaction(roomId, (room) => {
      const player = this.requirePlayer(room, playerId);
      const returnedPropertyIds = player.properties.map((pp) => pp.propertyId);
      const players = room.players.map((p) =>
        p.id === playerId
          ? { ...p, cash: 0, bankrupt: true, properties: [] }
          : p,
      );
      const trades = this.cancelPendingTrades(room, playerId);

      const bankruptcyLog = this.buildLog(
        'bankruptcy',
        0,
        `${player.name} se ha declarado en quiebra`,
        playerId,
        'bank',
        returnedPropertyIds,
        { bankAction: 'bankruptcy', returnedPropertyCount: returnedPropertyIds.length },
      );

      const activePlayers = players.filter((p) => !p.bankrupt);
      const shouldFinish = room.status === 'playing' && activePlayers.length === 1;
      const winner = shouldFinish ? activePlayers[0] : undefined;

      const nextRoom: Room = { ...room, players, trades, log: [...room.log, bankruptcyLog] };

      if (!shouldFinish) {
        return nextRoom;
      }

      const finishLog = this.buildLog(
        'game-end',
        0,
        winner ? `${winner.name} gana la partida` : 'La partida ha terminado',
        undefined,
        winner?.id,
        undefined,
        { gameEndReason: 'last-standing' },
      );

      return {
        ...nextRoom,
        status: 'finished',
        finishedAt: Date.now(),
        log: [...nextRoom.log, finishLog],
      };
    });
  }
}
