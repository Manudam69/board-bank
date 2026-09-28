import { Injectable, inject } from '@angular/core';
import type { Edition, Player, PlayerProperty, Room, TransactionLogEntry } from '../models';
import { AuthService } from './auth.service';
import { BuildingRulesService } from './building-rules.service';
import { GameStateService } from './game-state.service';
import { IdService } from './id.service';

@Injectable({ providedIn: 'root' })
export class PropertyService {
  private readonly gameState = inject(GameStateService);
  private readonly id = inject(IdService);
  private readonly auth = inject(AuthService);
  private readonly rules = inject(BuildingRulesService);

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
      let player = this.requirePlayer(room, playerId);
      const meta = this.propertyMeta(edition, propertyId);

      // Validación paso a paso usando las reglas centralizadas.
      for (let i = 0; i < count; i++) {
        const check = this.rules.canBuildHouse(player, edition, propertyId);
        if (!check.available) {
          throw new Error(check.reason ?? 'No puedes construir aquí');
        }

        // Aplicamos el incremento sobre una copia para la siguiente iteración.
        const next = player.properties.map((pp) =>
          pp.propertyId === propertyId ? { ...pp, houses: pp.houses + 1 } : pp,
        ) as PlayerProperty[];
        player = { ...player, properties: next };
      }

      const cost = count * meta.houseCost;
      const players = room.players.map((p) =>
        p.id === playerId
          ? {
              ...p,
              cash: p.cash - cost,
              properties: player.properties,
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
        { buildKind: 'house', count },
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

      const check = this.rules.canBuildHotel(player, edition, propertyId);
      if (!check.available) {
        throw new Error(check.reason ?? 'No puedes construir un hotel aquí');
      }

      const players = room.players.map((p) =>
        p.id === playerId
          ? {
              ...p,
              cash: p.cash - meta.hotelCost,
              properties: p.properties.map((x) =>
                x.propertyId === propertyId ? { ...x, houses: 0, hasHotel: true } : x,
              ),
            }
          : p,
      );

      const log = this.buildLog(
        'build-houses',
        meta.hotelCost,
        `${player.name} construyó un hotel en ${meta.name}`,
        playerId,
        'bank',
        [propertyId],
        { buildKind: 'hotel' },
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
      let player = this.requirePlayer(room, playerId);
      const meta = this.propertyMeta(edition, propertyId);

      for (let i = 0; i < count; i++) {
        const check = this.rules.canSellHouse(player, edition, propertyId);
        if (!check.available) {
          throw new Error(check.reason ?? 'No puedes vender aquí');
        }

        const next = player.properties.map((pp) =>
          pp.propertyId === propertyId ? { ...pp, houses: pp.houses - 1 } : pp,
        ) as PlayerProperty[];
        player = { ...player, properties: next };
      }

      const refund = Math.round((count * meta.houseCost) / 2);
      const players = room.players.map((p) =>
        p.id === playerId
          ? {
              ...p,
              cash: p.cash + refund,
              properties: player.properties,
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
        { buildKind: 'house', count },
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

      const check = this.rules.canSellHotel(player, edition, propertyId);
      if (!check.available) {
        throw new Error(check.reason ?? 'No puedes vender el hotel');
      }

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
        { buildKind: 'hotel' },
      );

      return { ...room, players, log: [...room.log, log] };
    });
  }

  rearrangeHouses(
    roomId: string,
    edition: Edition,
    playerId: string,
    distribution: Record<string, number>,
  ): Promise<void> {
    this.requireActor(playerId);

    return this.gameState.runInTransaction(roomId, (room) => {
      const player = this.requirePlayer(room, playerId);
      const meta = this.propertyMeta(edition, Object.keys(distribution)[0]);

      const validation = this.rules.validateRearrangement(player, edition, meta.group, distribution);
      if (!validation.valid) {
        throw new Error(validation.reason ?? 'Reorganización inválida');
      }

      const before = player.properties
        .filter((pp) => distribution[pp.propertyId] !== undefined)
        .map((pp) => ({ propertyId: pp.propertyId, houses: pp.houses, hasHotel: pp.hasHotel }));
      const after = before.map((item) => ({ ...item, houses: distribution[item.propertyId] }));

      const players = room.players.map((p) =>
        p.id === playerId
          ? {
              ...p,
              properties: p.properties.map((x) =>
                distribution[x.propertyId] !== undefined
                  ? { ...x, houses: distribution[x.propertyId] }
                  : x,
              ),
            }
          : p,
      );

      const groupName = edition.properties.find((p) => p.id === meta.id)?.group ?? meta.group;
      const log = this.buildLog(
        'rearrange-houses',
        0,
        `${player.name} reorganizó las casas del grupo ${groupName}`,
        playerId,
        undefined,
        Object.keys(distribution),
        { buildKind: 'rearrange', before, after },
      );

      return { ...room, players, log: [...room.log, log] };
    });
  }
}
