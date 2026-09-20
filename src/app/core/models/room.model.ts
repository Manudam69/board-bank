import type { Player } from './player.model';
import type { TransactionLogEntry } from './transaction.model';
import type { TradeOffer } from './trade.model';

export type RoomStatus = 'lobby' | 'playing' | 'finished';

export interface Room {
  id: string;
  /** Edición de Monopoly en juego. */
  editionId: string;
  hostId: string;
  status: RoomStatus;
  players: Player[];
  /** Log append-only de todas las operaciones. */
  log: TransactionLogEntry[];
  /** Ofertas pendientes/aceptadas/rechazadas de intercambio. */
  trades: TradeOffer[];
  /** Para retomar o bloquear edición mientras dure la partida. */
  createdAt: number;
  updatedAt: number;
}
