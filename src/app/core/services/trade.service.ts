import { Injectable, inject } from '@angular/core';
import type { Player, Room, TradeItems, TradeOffer, TransactionLogEntry } from '../models';
import { AuthService } from './auth.service';
import { GameStateService } from './game-state.service';
import { IdService } from './id.service';

@Injectable({ providedIn: 'root' })
export class TradeService {
  private readonly gameState = inject(GameStateService);
  private readonly id = inject(IdService);
  private readonly auth = inject(AuthService);

  private requirePlayer(room: Room, playerId: string): Player {
    const p = room.players.find((x) => x.id === playerId);
    if (!p) throw new Error('Jugador no encontrado');
    if (p.bankrupt) throw new Error('El jugador está en quiebra');
    return p;
  }

  private propertyIds(items: TradeItems[]): string[] {
    return items.flatMap((i) => i.propertyIds);
  }

  create(
    roomId: string,
    fromPlayerId: string,
    toPlayerId: string,
    fromItems: TradeItems,
    toItems: TradeItems,
  ): Promise<void> {
    if (fromPlayerId === toPlayerId) throw new Error('No puedes intercambiar contigo mismo');

    const uid = this.auth.userId();
    if (uid !== fromPlayerId) {
      throw new Error('Solo puedes proponer intercambios desde tu propio jugador');
    }

    return this.gameState.runInTransaction(roomId, (room) => {
      const offer: TradeOffer = {
        id: this.id.newId(),
        status: 'pending',
        fromPlayerId,
        toPlayerId,
        fromItems,
        toItems,
        createdAt: Date.now(),
      };
      return { ...room, trades: [...room.trades, offer] };
    });
  }

  accept(roomId: string, offerId: string): Promise<void> {
    return this.gameState.runInTransaction(roomId, (room) => {
      const offerIndex = room.trades.findIndex((t) => t.id === offerId);
      if (offerIndex === -1) throw new Error('Oferta no encontrada');
      const offer = room.trades[offerIndex];
      if (offer.status !== 'pending') throw new Error('La oferta ya fue resuelta');

      const uid = this.auth.userId();
      if (uid !== offer.toPlayerId) {
        throw new Error('Solo el destinatario puede aceptar la oferta');
      }

      const from = this.requirePlayer(room, offer.fromPlayerId);
      const to = this.requirePlayer(room, offer.toPlayerId);

      if (from.cash < offer.fromItems.cash) throw new Error(`${from.name} no tiene suficiente dinero`);
      if (to.cash < offer.toItems.cash) throw new Error(`${to.name} no tiene suficiente dinero`);

      for (const pid of offer.fromItems.propertyIds) {
        if (!from.properties.some((pp) => pp.propertyId === pid)) {
          throw new Error(`${from.name} no posee una propiedad de la oferta`);
        }
      }
      for (const pid of offer.toItems.propertyIds) {
        if (!to.properties.some((pp) => pp.propertyId === pid)) {
          throw new Error(`${to.name} no posee una propiedad de la oferta`);
        }
      }

      const players = room.players.map((p) => {
        if (p.id === from.id) {
          return {
            ...p,
            cash: p.cash - offer.fromItems.cash + offer.toItems.cash,
            properties: this.applyPropertyTransfer(
              p.properties,
              offer.fromItems.propertyIds,
              offer.toItems.propertyIds,
            ),
          };
        }
        if (p.id === to.id) {
          return {
            ...p,
            cash: p.cash - offer.toItems.cash + offer.fromItems.cash,
            properties: this.applyPropertyTransfer(
              p.properties,
              offer.toItems.propertyIds,
              offer.fromItems.propertyIds,
            ),
          };
        }
        return p;
      });

      const acceptedOffer: TradeOffer = { ...offer, status: 'accepted', resolvedAt: Date.now() };
      const trades = [...room.trades];
      trades[offerIndex] = acceptedOffer;

      const log: TransactionLogEntry = {
        id: this.id.newId(),
        timestamp: Date.now(),
        type: 'trade',
        amount: offer.fromItems.cash + offer.toItems.cash,
        description: `Intercambio aceptado entre ${from.name} y ${to.name}`,
        fromPlayerId: from.id,
        toPlayerId: to.id,
        propertyIds: this.propertyIds([offer.fromItems, offer.toItems]),
        metadata: { offerId: offer.id },
      };

      return { ...room, players, trades, log: [...room.log, log] };
    });
  }

  reject(roomId: string, offerId: string): Promise<void> {
    return this.gameState.runInTransaction(roomId, (room) => {
      const offerIndex = room.trades.findIndex((t) => t.id === offerId);
      if (offerIndex === -1) throw new Error('Oferta no encontrada');
      const offer = room.trades[offerIndex];
      if (offer.status !== 'pending') throw new Error('La oferta ya fue resuelta');

      const uid = this.auth.userId();
      if (uid !== offer.toPlayerId) {
        throw new Error('Solo el destinatario puede rechazar la oferta');
      }

      const trades = room.trades.map((t) =>
        t.id === offerId
          ? { ...t, status: 'rejected' as const, resolvedAt: Date.now() }
          : t,
      );
      return { ...room, trades };
    });
  }

  private applyPropertyTransfer(
    source: Player['properties'],
    outgoing: string[],
    incoming: string[],
  ): Player['properties'] {
    const kept = source.filter((pp) => !outgoing.includes(pp.propertyId));
    const added = incoming.map((id) => {
      const original = source.find((pp) => pp.propertyId === id);
      return original ? { ...original } : { propertyId: id, houses: 0, hasHotel: false, mortgaged: false };
    });
    return [...kept, ...added];
  }
}
