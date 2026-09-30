import { Injectable, inject } from '@angular/core';
import type { Edition, Player, PlayerProperty, Room, TransactionLogEntry } from '../models';
import { AuthService } from './auth.service';
import { BuildingRulesService } from './building-rules.service';
import { GameStateService } from './game-state.service';
import { IdService } from './id.service';

export interface LiquidationPlan {
  /** Estado final de las propiedades del jugador tras liquidar. */
  properties: PlayerProperty[];
  /** Efectivo total a recibir (ventas + hipotecas). */
  totalCash: number;
  /** Casas vendidas individualmente. */
  housesSold: number;
  /** Hoteles vendidos. */
  hotelsSold: number;
  /** ids de propiedades hipotecadas en esta operación. */
  mortgagedIds: string[];
  /** Total de propiedades del jugador. */
  propertyCount: number;
}

@Injectable({ providedIn: 'root' })
export class LiquidationService {
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

  private isStreet(meta: Edition['properties'][number]): boolean {
    return !meta.isRailroad && !meta.isUtility;
  }

  /**
   * Calcula cuánto efectivo puede recuperar un jugador vendiendo construcciones
   * e hipotecando propiedades, sin modificar el estado real.
   * Respeta exactamente las reglas de BuildingRulesService.
   */
  plan(player: Player, edition: Edition): LiquidationPlan {
    const workingProps = player.properties.map((pp) => ({ ...pp }));
    let totalCash = 0;
    let housesSold = 0;
    let hotelsSold = 0;

    const workingPlayer = (): Player => ({ ...player, properties: workingProps });

    let progress = true;
    while (progress) {
      progress = false;

      // 1. Vender hoteles primero (las reglas impiden vender casas mientras haya un hotel en el grupo).
      for (const pp of workingProps) {
        const meta = edition.properties.find((p) => p.id === pp.propertyId);
        if (!meta || !this.isStreet(meta) || !pp.hasHotel) continue;

        const check = this.rules.canSellHotel(workingPlayer(), edition, pp.propertyId);
        if (check.available) {
          pp.houses = 4;
          pp.hasHotel = false;
          totalCash += check.refund ?? Math.round(meta.hotelCost / 2);
          hotelsSold++;
          progress = true;
        }
      }

      // 2. Vender casas una a una respetando la construcción uniforme.
      for (const pp of workingProps) {
        const meta = edition.properties.find((p) => p.id === pp.propertyId);
        if (!meta || !this.isStreet(meta)) continue;

        while (true) {
          const check = this.rules.canSellHouse(workingPlayer(), edition, pp.propertyId);
          if (!check.available) break;

          pp.houses--;
          totalCash += check.refund ?? Math.round(meta.houseCost / 2);
          housesSold++;
          progress = true;
        }
      }
    }

    // 3. Hipotecar todo lo que esté libre de construcciones.
    const mortgagedIds: string[] = [];
    for (const pp of workingProps) {
      if (pp.houses === 0 && !pp.hasHotel && !pp.mortgaged) {
        const meta = edition.properties.find((p) => p.id === pp.propertyId);
        if (meta) {
          pp.mortgaged = true;
          totalCash += meta.mortgageValue;
          mortgagedIds.push(pp.propertyId);
        }
      }
    }

    return {
      properties: workingProps,
      totalCash,
      housesSold,
      hotelsSold,
      mortgagedIds,
      propertyCount: player.properties.length,
    };
  }

  /**
   * Ejecuta la liquidación en una sola transacción: vende construcciones,
   * hipoteca propiedades y abona el efectivo. El jugador sigue siendo dueño.
   * Recalcula el plan dentro de la transacción para evitar pagos dobles o
   * inconsistencias por carreras.
   */
  liquidateAll(roomId: string, edition: Edition, playerId: string): Promise<LiquidationPlan> {
    this.requireActor(playerId);

    let result: LiquidationPlan | null = null;

    return this.gameState.runInTransaction(roomId, (room) => {
      const player = this.requirePlayer(room, playerId);
      const plan = this.plan(player, edition);

      if (plan.totalCash === 0 && plan.mortgagedIds.length === 0 && plan.housesSold === 0 && plan.hotelsSold === 0) {
        throw new Error('No tienes activos para liquidar');
      }

      const players = room.players.map((p) =>
        p.id === playerId
          ? { ...p, cash: p.cash + plan.totalCash, properties: plan.properties }
          : p,
      );

      const log = this.buildLog(
        'liquidation',
        plan.totalCash,
        `${player.name} liquidó sus activos`,
        'bank',
        playerId,
        player.properties.map((pp) => pp.propertyId),
        {
          bankAction: 'liquidation',
          housesSold: plan.housesSold,
          hotelsSold: plan.hotelsSold,
          mortgagedCount: plan.mortgagedIds.length,
          totalCash: plan.totalCash,
        },
      );

      result = plan;
      return { ...room, players, log: [...room.log, log] };
    }).then(() => {
      if (!result) throw new Error('No se pudo completar la liquidación');
      return result;
    });
  }
}
