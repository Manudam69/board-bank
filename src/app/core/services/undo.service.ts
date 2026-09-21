import { Injectable, inject } from '@angular/core';
import type { Edition, Player, Room, TransactionLogEntry } from '../models';
import { AuthService } from './auth.service';
import { GameStateService } from './game-state.service';
import { IdService } from './id.service';

export interface BuildKindMetadata {
  buildKind: 'house' | 'hotel';
  count?: number;
}

export type UndoableType =
  | 'transfer'
  | 'buy-property'
  | 'mortgage'
  | 'unmortgage'
  | 'build-houses'
  | 'sell-houses';

const UNDOABLE_TYPES = new Set<UndoableType>([
  'transfer',
  'buy-property',
  'mortgage',
  'unmortgage',
  'build-houses',
  'sell-houses',
]);

@Injectable({ providedIn: 'root' })
export class UndoService {
  private readonly gameState = inject(GameStateService);
  private readonly id = inject(IdService);
  private readonly auth = inject(AuthService);

  /** Returns the last real entry that can still be undone, or null. */
  undoableEntry(room: Room, userId: string): TransactionLogEntry | null {
    for (let i = room.log.length - 1; i >= 0; i--) {
      const entry = room.log[i];
      if (entry.type === 'undo' || entry.metadata?.['undone']) {
        continue;
      }
      if (!this.isUndoableType(entry.type)) {
        return null;
      }
      if (!this.isAuthor(entry, userId)) {
        return null;
      }
      return entry;
    }
    return null;
  }

  async undoLast(roomId: string): Promise<TransactionLogEntry> {
    const userId = this.auth.userId();
    if (!userId) throw new Error('Usuario no autenticado');

    let result: TransactionLogEntry | null = null;
    await this.gameState.runInTransaction(roomId, (room) => {
      const entry = this.undoableEntry(room, userId);
      if (!entry) {
        throw new Error('No hay ninguna acción tuya que se pueda deshacer');
      }

      result = this.buildUndoLog(entry, userId);
      return this.applyInverse(room, entry, userId);
    });
    if (!result) {
      throw new Error('No se pudo construir el registro de deshacer');
    }
    return result;
  }

  private isUndoableType(type: TransactionLogEntry['type']): type is UndoableType {
    return UNDOABLE_TYPES.has(type as UndoableType);
  }

  private isAuthor(entry: TransactionLogEntry, userId: string): boolean {
    switch (entry.type) {
      case 'transfer':
        // Salary is bank -> player; everything else is initiated by fromPlayerId.
        return entry.fromPlayerId === 'bank'
          ? entry.toPlayerId === userId
          : entry.fromPlayerId === userId;
      case 'buy-property':
      case 'unmortgage':
        return entry.fromPlayerId === userId;
      case 'mortgage':
      case 'sell-houses':
        return entry.toPlayerId === userId;
      case 'build-houses':
        return entry.fromPlayerId === userId;
      default:
        return false;
    }
  }

  private requirePlayer(room: Room, playerId: string): Player {
    const player = room.players.find((p) => p.id === playerId);
    if (!player) throw new Error('Jugador no encontrado');
    if (player.bankrupt) throw new Error('Jugador en quiebra');
    return player;
  }

  private requireOwnProperty(player: Player, propertyId: string): Player['properties'][number] {
    const pp = player.properties.find((p) => p.propertyId === propertyId);
    if (!pp) throw new Error('No posees esa propiedad');
    return pp;
  }

  private adjustCash(players: Player[], playerId: string, delta: number): Player[] {
    return players.map((p) => (p.id === playerId ? { ...p, cash: p.cash + delta } : p));
  }

  private markUndone(log: TransactionLogEntry[], entryId: string): TransactionLogEntry[] {
    return log.map((entry) => {
      if (entry.id !== entryId) return entry;
      return {
        ...entry,
        metadata: { ...entry.metadata, undone: true },
      };
    });
  }

  private buildUndoLog(entry: TransactionLogEntry, undoneBy: string): TransactionLogEntry {
    return {
      id: this.id.newId(),
      timestamp: Date.now(),
      type: 'undo',
      amount: entry.amount,
      description: `Deshecho: ${entry.description}`,
      fromPlayerId: entry.toPlayerId,
      toPlayerId: entry.fromPlayerId,
      propertyIds: entry.propertyIds,
      metadata: { undoesId: entry.id, undoneBy },
    };
  }

  private applyInverse(room: Room, entry: TransactionLogEntry, userId: string): Room {
    switch (entry.type) {
      case 'transfer':
        return this.applyTransferInverse(room, entry, userId);
      case 'buy-property':
        return this.applyBuyInverse(room, entry, userId);
      case 'mortgage':
        return this.applyMortgageInverse(room, entry, userId);
      case 'unmortgage':
        return this.applyUnmortgageInverse(room, entry, userId);
      case 'build-houses':
      case 'sell-houses':
        return this.applyBuildOrSellInverse(room, entry, userId);
      default:
        throw new Error('Tipo de operación no deshechible');
    }
  }

  private applyTransferInverse(room: Room, entry: TransactionLogEntry, userId: string): Room {
    const fromId = entry.fromPlayerId;
    const toId = entry.toPlayerId;
    const amount = entry.amount;

    if (toId !== undefined && toId !== 'bank') {
      const to = this.requirePlayer(room, toId);
      if (to.cash < amount) {
        throw new Error(`${to.name} ya no tiene suficiente dinero para devolver la operación`);
      }
    }

    let players = room.players;
    if (toId !== undefined && toId !== 'bank') {
      players = this.adjustCash(players, toId, -amount);
    }
    if (fromId !== undefined && fromId !== 'bank') {
      players = this.adjustCash(players, fromId, amount);
    }

    return {
      ...room,
      players,
      log: [...this.markUndone(room.log, entry.id), this.buildUndoLog(entry, userId)],
    };
  }

  private applyBuyInverse(room: Room, entry: TransactionLogEntry, userId: string): Room {
    const playerId = entry.fromPlayerId;
    if (!playerId || playerId === 'bank') throw new Error('Autor no válido');

    const player = this.requirePlayer(room, playerId);
    const propertyId = entry.propertyIds?.[0];
    if (!propertyId) throw new Error('Falta propertyId');

    const pp = this.requireOwnProperty(player, propertyId);
    if (pp.houses > 0 || pp.hasHotel || pp.mortgaged) {
      throw new Error('La propiedad ya no está en el estado original de compra');
    }

    const players = room.players.map((p) => {
      if (p.id !== playerId) return p;
      return {
        ...p,
        cash: p.cash + entry.amount,
        properties: p.properties.filter((x) => x.propertyId !== propertyId),
      };
    });

    return {
      ...room,
      players,
      log: [...this.markUndone(room.log, entry.id), this.buildUndoLog(entry, userId)],
    };
  }

  private applyMortgageInverse(room: Room, entry: TransactionLogEntry, userId: string): Room {
    const playerId = entry.toPlayerId;
    if (!playerId || playerId === 'bank') throw new Error('Autor no válido');

    const player = this.requirePlayer(room, playerId);
    const propertyId = entry.propertyIds?.[0];
    if (!propertyId) throw new Error('Falta propertyId');

    const pp = this.requireOwnProperty(player, propertyId);
    if (!pp.mortgaged) {
      throw new Error('La propiedad ya no está hipotecada');
    }
    if (pp.houses > 0 || pp.hasHotel) {
      throw new Error('La propiedad tiene edificios; no se puede deshacer la hipoteca');
    }
    if (player.cash < entry.amount) {
      throw new Error('No tienes suficiente dinero para devolver la hipoteca');
    }

    const players = room.players.map((p) => {
      if (p.id !== playerId) return p;
      return {
        ...p,
        cash: p.cash - entry.amount,
        properties: p.properties.map((x) =>
          x.propertyId === propertyId ? { ...x, mortgaged: false } : x,
        ),
      };
    });

    return {
      ...room,
      players,
      log: [...this.markUndone(room.log, entry.id), this.buildUndoLog(entry, userId)],
    };
  }

  private applyUnmortgageInverse(room: Room, entry: TransactionLogEntry, userId: string): Room {
    const playerId = entry.fromPlayerId;
    if (!playerId || playerId === 'bank') throw new Error('Autor no válido');

    const player = this.requirePlayer(room, playerId);
    const propertyId = entry.propertyIds?.[0];
    if (!propertyId) throw new Error('Falta propertyId');

    const pp = this.requireOwnProperty(player, propertyId);
    if (pp.mortgaged) {
      throw new Error('La propiedad ya está hipotecada');
    }
    if (pp.houses > 0 || pp.hasHotel) {
      throw new Error('La propiedad tiene edificios; no se puede deshacer la deshipoteca');
    }

    const players = room.players.map((p) => {
      if (p.id !== playerId) return p;
      return {
        ...p,
        cash: p.cash + entry.amount,
        properties: p.properties.map((x) =>
          x.propertyId === propertyId ? { ...x, mortgaged: true } : x,
        ),
      };
    });

    return {
      ...room,
      players,
      log: [...this.markUndone(room.log, entry.id), this.buildUndoLog(entry, userId)],
    };
  }

  private applyBuildOrSellInverse(room: Room, entry: TransactionLogEntry, userId: string): Room {
    const playerId = entry.type === 'build-houses' ? entry.fromPlayerId : entry.toPlayerId;
    if (!playerId || playerId === 'bank') throw new Error('Autor no válido');

    const player = this.requirePlayer(room, playerId);
    const propertyId = entry.propertyIds?.[0];
    if (!propertyId) throw new Error('Falta propertyId');

    const pp = this.requireOwnProperty(player, propertyId);
    const meta = entry.metadata as BuildKindMetadata | undefined;
    const kind = meta?.buildKind;

    let players: Player[];
    if (entry.type === 'build-houses') {
      if (kind === 'hotel') {
        if (!pp.hasHotel) throw new Error('Ya no hay hotel en la propiedad');
        players = room.players.map((p) => {
          if (p.id !== playerId) return p;
          return {
            ...p,
            cash: p.cash + entry.amount,
            properties: p.properties.map((x) =>
              x.propertyId === propertyId ? { ...x, hasHotel: false, houses: 4 } : x,
            ),
          };
        });
      } else {
        const count = kind === 'house' ? (meta?.count ?? 1) : 1;
        if (pp.houses < count) {
          throw new Error('Ya no quedan tantas casas en la propiedad');
        }
        players = room.players.map((p) => {
          if (p.id !== playerId) return p;
          return {
            ...p,
            cash: p.cash + entry.amount,
            properties: p.properties.map((x) =>
              x.propertyId === propertyId ? { ...x, houses: x.houses - count } : x,
            ),
          };
        });
      }
    } else {
      // sell-houses inverse
      if (kind === 'hotel') {
        if (pp.houses !== 4 || pp.hasHotel) {
          throw new Error('El hotel ya no se puede recomprar (estado distinto)');
        }
        if (player.cash < entry.amount) {
          throw new Error('No tienes suficiente dinero para recomprar el hotel');
        }
        players = room.players.map((p) => {
          if (p.id !== playerId) return p;
          return {
            ...p,
            cash: p.cash - entry.amount,
            properties: p.properties.map((x) =>
              x.propertyId === propertyId ? { ...x, hasHotel: true, houses: 0 } : x,
            ),
          };
        });
      } else {
        const count = kind === 'house' ? (meta?.count ?? 1) : 1;
        if (pp.houses + count > 4 || pp.hasHotel) {
          throw new Error('No caben tantas casas en la propiedad');
        }
        if (player.cash < entry.amount) {
          throw new Error('No tienes suficiente dinero para reconstruir las casas');
        }
        players = room.players.map((p) => {
          if (p.id !== playerId) return p;
          return {
            ...p,
            cash: p.cash - entry.amount,
            properties: p.properties.map((x) =>
              x.propertyId === propertyId ? { ...x, houses: x.houses + count } : x,
            ),
          };
        });
      }
    }

    return {
      ...room,
      players,
      log: [...this.markUndone(room.log, entry.id), this.buildUndoLog(entry, userId)],
    };
  }
}
