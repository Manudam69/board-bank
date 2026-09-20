import { Injectable, inject } from '@angular/core';
import type { Edition, Player, PlayerProperty, Room, TransactionLogEntry } from '../models';
import { AuthService } from './auth.service';
import { GameStateService } from './game-state.service';
import { IdService } from './id.service';

@Injectable({ providedIn: 'root' })
export class PropertyService {
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
    };
  }

  private requirePlayer(room: Room, playerId: string): Player {
    const p = room.players.find((x) => x.id === playerId);
    if (!p) throw new Error('Jugador no encontrado');
    if (p.bankrupt) throw new Error('El jugador está en quiebra');
    return p;
  }

  private requireActor(playerId: string): void {
    const uid = this.auth.userId();
    if (uid !== playerId) {
      throw new Error('No puedes gestionar las propiedades de otro jugador');
    }
  }

  private propertyMeta(edition: Edition, propertyId: string) {
    const meta = edition.properties.find((p) => p.id === propertyId);
    if (!meta) throw new Error('Propiedad no encontrada en esta edición');
    return meta;
  }

  buyProperty(
    roomId: string,
    edition: Edition,
    playerId: string,
    propertyId: string,
  ): Promise<void> {
    this.requireActor(playerId);

    return this.gameState.runInTransaction(roomId, (room) => {
      const player = this.requirePlayer(room, playerId);
      const meta = this.propertyMeta(edition, propertyId);

      const owner = room.players.find((p) =>
        p.properties.some((pp) => pp.propertyId === propertyId),
      );
      if (owner) throw new Error('La propiedad ya tiene dueño');
      if (player.cash < meta.price) throw new Error('Dinero insuficiente');

      const newProperty: PlayerProperty = {
        propertyId,
        houses: 0,
        hasHotel: false,
        mortgaged: false,
      };

      const players = room.players.map((p) =>
        p.id === playerId
          ? { ...p, cash: p.cash - meta.price, properties: [...p.properties, newProperty] }
          : p,
      );

      const log = this.buildLog(
        'buy-property',
        meta.price,
        `${player.name} compró ${meta.name}`,
        playerId,
        'bank',
        [propertyId],
      );

      return { ...room, players, log: [...room.log, log] };
    });
  }

  mortgage(
    roomId: string,
    edition: Edition,
    playerId: string,
    propertyId: string,
  ): Promise<void> {
    this.requireActor(playerId);

    return this.gameState.runInTransaction(roomId, (room) => {
      const player = this.requirePlayer(room, playerId);
      const meta = this.propertyMeta(edition, propertyId);
      const pp = player.properties.find((x) => x.propertyId === propertyId);
      if (!pp) throw new Error('No posees esa propiedad');
      if (pp.mortgaged) throw new Error('La propiedad ya está hipotecada');
      if (pp.houses > 0 || pp.hasHotel) {
        throw new Error('Debes vender edificios antes de hipotecar');
      }

      const players = room.players.map((p) =>
        p.id === playerId
          ? {
              ...p,
              cash: p.cash + meta.mortgageValue,
              properties: p.properties.map((x) =>
                x.propertyId === propertyId ? { ...x, mortgaged: true } : x,
              ),
            }
          : p,
      );

      const log = this.buildLog(
        'mortgage',
        meta.mortgageValue,
        `${player.name} hipotecó ${meta.name}`,
        'bank',
        playerId,
        [propertyId],
      );

      return { ...room, players, log: [...room.log, log] };
    });
  }

  unmortgage(
    roomId: string,
    edition: Edition,
    playerId: string,
    propertyId: string,
  ): Promise<void> {
    this.requireActor(playerId);

    return this.gameState.runInTransaction(roomId, (room) => {
      const player = this.requirePlayer(room, playerId);
      const meta = this.propertyMeta(edition, propertyId);
      const pp = player.properties.find((x) => x.propertyId === propertyId);
      if (!pp) throw new Error('No posees esa propiedad');
      if (!pp.mortgaged) throw new Error('La propiedad no está hipotecada');

      const cost = Math.round(meta.mortgageValue * 1.1);
      if (player.cash < cost) throw new Error('Dinero insuficiente para deshipotecar');

      const players = room.players.map((p) =>
        p.id === playerId
          ? {
              ...p,
              cash: p.cash - cost,
              properties: p.properties.map((x) =>
                x.propertyId === propertyId ? { ...x, mortgaged: false } : x,
              ),
            }
          : p,
      );

      const log = this.buildLog(
        'unmortgage',
        cost,
        `${player.name} deshipotecó ${meta.name}`,
        playerId,
        'bank',
        [propertyId],
      );

      return { ...room, players, log: [...room.log, log] };
    });
  }

  buildHouses(
    roomId: string,
    edition: Edition,
    playerId: string,
    propertyId: string,
    count: number,
  ): Promise<void> {
    this.requireActor(playerId);
    if (count <= 0) throw new Error('Debe construir al menos una casa');

    return this.gameState.runInTransaction(roomId, (room) => {
      const player = this.requirePlayer(room, playerId);
      const meta = this.propertyMeta(edition, propertyId);
      const pp = player.properties.find((x) => x.propertyId === propertyId);
      if (!pp || pp.mortgaged) throw new Error('No puedes construir en esta propiedad');
      if (pp.hasHotel) throw new Error('Ya hay hotel');
      if (pp.houses + count > 4) throw new Error('Máximo 4 casas antes de hotel');

      const cost = count * meta.houseCost;
      if (player.cash < cost) throw new Error('Dinero insuficiente');

      const players = room.players.map((p) =>
        p.id === playerId
          ? {
              ...p,
              cash: p.cash - cost,
              properties: p.properties.map((x) =>
                x.propertyId === propertyId ? { ...x, houses: x.houses + count } : x,
              ),
            }
          : p,
      );

      const log = this.buildLog(
        'build-houses',
        cost,
        `${player.name} construyó ${count} casa(s) en ${meta.name}`,
        playerId,
        'bank',
        [propertyId],
      );

      return { ...room, players, log: [...room.log, log] };
    });
  }

  buildHotel(
    roomId: string,
    edition: Edition,
    playerId: string,
    propertyId: string,
  ): Promise<void> {
    this.requireActor(playerId);

    return this.gameState.runInTransaction(roomId, (room) => {
      const player = this.requirePlayer(room, playerId);
      const meta = this.propertyMeta(edition, propertyId);
      const pp = player.properties.find((x) => x.propertyId === propertyId);
      if (!pp || pp.mortgaged) throw new Error('No puedes construir en esta propiedad');
      if (pp.hasHotel) throw new Error('Ya hay hotel');
      if (pp.houses < 4) throw new Error('Necesitas 4 casas para construir hotel');

      const cost = meta.hotelCost;
      if (player.cash < cost) throw new Error('Dinero insuficiente');

      const players = room.players.map((p) =>
        p.id === playerId
          ? {
              ...p,
              cash: p.cash - cost,
              properties: p.properties.map((x) =>
                x.propertyId === propertyId ? { ...x, houses: 0, hasHotel: true } : x,
              ),
            }
          : p,
      );

      const log = this.buildLog(
        'build-houses',
        cost,
        `${player.name} construyó un hotel en ${meta.name}`,
        playerId,
        'bank',
        [propertyId],
      );

      return { ...room, players, log: [...room.log, log] };
    });
  }

  sellHouses(
    roomId: string,
    edition: Edition,
    playerId: string,
    propertyId: string,
    count: number,
  ): Promise<void> {
    this.requireActor(playerId);
    if (count <= 0) throw new Error('Debe vender al menos una casa');

    return this.gameState.runInTransaction(roomId, (room) => {
      const player = this.requirePlayer(room, playerId);
      const meta = this.propertyMeta(edition, propertyId);
      const pp = player.properties.find((x) => x.propertyId === propertyId);
      if (!pp) throw new Error('No posees esa propiedad');
      if (pp.hasHotel) throw new Error('Vende el hotel primero');
      if (pp.houses < count) throw new Error('No tienes tantas casas');

      const refund = Math.round((count * meta.houseCost) / 2);

      const players = room.players.map((p) =>
        p.id === playerId
          ? {
              ...p,
              cash: p.cash + refund,
              properties: p.properties.map((x) =>
                x.propertyId === propertyId ? { ...x, houses: x.houses - count } : x,
              ),
            }
          : p,
      );

      const log = this.buildLog(
        'sell-houses',
        refund,
        `${player.name} vendió ${count} casa(s) de ${meta.name}`,
        'bank',
        playerId,
        [propertyId],
      );

      return { ...room, players, log: [...room.log, log] };
    });
  }

  sellHotel(
    roomId: string,
    edition: Edition,
    playerId: string,
    propertyId: string,
  ): Promise<void> {
    this.requireActor(playerId);

    return this.gameState.runInTransaction(roomId, (room) => {
      const player = this.requirePlayer(room, playerId);
      const meta = this.propertyMeta(edition, propertyId);
      const pp = player.properties.find((x) => x.propertyId === propertyId);
      if (!pp || !pp.hasHotel) throw new Error('No hay hotel en esta propiedad');

      const refund = Math.round(meta.hotelCost / 2);
      const players = room.players.map((p) =>
        p.id === playerId
          ? {
              ...p,
              cash: p.cash + refund,
              properties: p.properties.map((x) =>
                x.propertyId === propertyId ? { ...x, houses: 4, hasHotel: false } : x,
              ),
            }
          : p,
      );

      const log = this.buildLog(
        'sell-houses',
        refund,
        `${player.name} vendió el hotel de ${meta.name}`,
        'bank',
        playerId,
        [propertyId],
      );

      return { ...room, players, log: [...room.log, log] };
    });
  }
}
