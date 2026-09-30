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

export type DebtActionType = 'sell-house' | 'sell-hotel' | 'mortgage-property';

export interface DebtAction {
  id: string;
  type: DebtActionType;
  propertyId: string;
  propertyName: string;
  groupColor: string;
  amount: number;
}

export interface EvaluatedDebtAction extends DebtAction {
  selected: boolean;
  available: boolean;
  reason?: string;
}

export interface DebtOptions {
  /** Acciones de venta de edificios en orden canónico legal. */
  sellActions: EvaluatedDebtAction[];
  /** Hipotecas disponibles con la selección actual. */
  mortgageActions: EvaluatedDebtAction[];
  /** Propiedades bloqueadas para hipotecar (edificios / ya hipotecada). */
  blockedMortgages: EvaluatedDebtAction[];
  /** Recuperación máxima posible (todas las acciones). */
  totalRecovery: number;
  /** Recuperación de la selección actual (solo acciones válidas). */
  selectedRecovery: number;
}

export interface ExecutedLiquidation {
  totalCash: number;
  housesSold: number;
  hotelsSold: number;
  mortgagedIds: string[];
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

  private metaFor(edition: Edition, propertyId: string): Edition['properties'][number] | undefined {
    return edition.properties.find((p) => p.id === propertyId);
  }

  /**
   * Simula la venta de TODOS los edificios en orden canónico (hoteles primero,
   * luego casas respetando la construcción uniforme) y devuelve cada paso
   * individual junto con el estado final de las propiedades.
   */
  private enumerateSellActions(player: Player, edition: Edition): {
    actions: DebtAction[];
    finalProps: PlayerProperty[];
  } {
    const workingProps = player.properties.map((pp) => ({ ...pp }));
    const actions: DebtAction[] = [];
    const houseCounts = new Map<string, number>();

    const workingPlayer = (): Player => ({ ...player, properties: workingProps });

    let progress = true;
    while (progress) {
      progress = false;

      // 1. Vender hoteles primero (las reglas impiden vender casas mientras haya un hotel en el grupo).
      for (const pp of workingProps) {
        const meta = this.metaFor(edition, pp.propertyId);
        if (!meta || !this.isStreet(meta) || !pp.hasHotel) continue;

        const check = this.rules.canSellHotel(workingPlayer(), edition, pp.propertyId);
        if (check.available) {
          const count = (houseCounts.get(pp.propertyId) ?? 0) + 1;
          houseCounts.set(pp.propertyId, count);
          actions.push({
            id: `sell-hotel:${pp.propertyId}:${count}`,
            type: 'sell-hotel',
            propertyId: pp.propertyId,
            propertyName: meta.name,
            groupColor: meta.groupColor,
            amount: check.refund ?? Math.round(meta.hotelCost / 2),
          });
          pp.houses = 4;
          pp.hasHotel = false;
          progress = true;
        }
      }

      // 2. Vender casas una a una respetando la construcción uniforme.
      for (const pp of workingProps) {
        const meta = this.metaFor(edition, pp.propertyId);
        if (!meta || !this.isStreet(meta)) continue;

        while (true) {
          const check = this.rules.canSellHouse(workingPlayer(), edition, pp.propertyId);
          if (!check.available) break;

          const count = (houseCounts.get(pp.propertyId) ?? 0) + 1;
          houseCounts.set(pp.propertyId, count);
          actions.push({
            id: `sell-house:${pp.propertyId}:${count}`,
            type: 'sell-house',
            propertyId: pp.propertyId,
            propertyName: meta.name,
            groupColor: meta.groupColor,
            amount: check.refund ?? Math.round(meta.houseCost / 2),
          });
          pp.houses--;
          progress = true;
        }
      }
    }

    return { actions, finalProps: workingProps };
  }

  /**
   * Devuelve TODAS las acciones de liquidación posibles para el jugador,
   * marcando cuáles están seleccionadas y cuáles disponibles dado el estado
   * simulado de la selección. Las reglas se evalúan con BuildingRulesService.
   */
  enumerateActions(player: Player, edition: Edition, selectedIds: Set<string> = new Set()): DebtOptions {
    // 1. Secuencia canónica de ventas y estado tras vender TODO.
    const { actions: allSellActions, finalProps: allSellsFinal } = this.enumerateSellActions(player, edition);

    // 2. Aplicar la selección sobre una copia de trabajo para calcular disponibilidad dinámica.
    const workingProps = player.properties.map((pp) => ({ ...pp }));
    const selectedSet = new Set<string>();
    let selectedRecovery = 0;

    const workingPlayer = (): Player => ({ ...player, properties: workingProps });

    for (const action of allSellActions) {
      if (!selectedIds.has(action.id)) continue;

      const meta = this.metaFor(edition, action.propertyId);
      const check =
        action.type === 'sell-hotel'
          ? this.rules.canSellHotel(workingPlayer(), edition, action.propertyId)
          : this.rules.canSellHouse(workingPlayer(), edition, action.propertyId);

      if (check.available && meta) {
        selectedSet.add(action.id);
        selectedRecovery += check.refund ?? action.amount;
        if (action.type === 'sell-hotel') {
          const pp = workingProps.find((p) => p.propertyId === action.propertyId)!;
          pp.houses = 4;
          pp.hasHotel = false;
        } else {
          const pp = workingProps.find((p) => p.propertyId === action.propertyId)!;
          pp.houses--;
        }
      }
    }

    // 3. Re-evaluar disponibilidad de cada venta con la selección aplicada.
    const sellActions: EvaluatedDebtAction[] = allSellActions.map((action) => {
      const isSelected = selectedSet.has(action.id);
      const check =
        action.type === 'sell-hotel'
          ? this.rules.canSellHotel(workingPlayer(), edition, action.propertyId)
          : this.rules.canSellHouse(workingPlayer(), edition, action.propertyId);

      return {
        ...action,
        selected: isSelected,
        available: !isSelected && check.available,
        reason: !isSelected && !check.available ? check.reason : undefined,
      };
    });

    // 4. Hipotecas contra el estado simulado (o contra el estado final si todo se vendiera).
    const mortgageActions: EvaluatedDebtAction[] = [];
    const blockedMortgages: EvaluatedDebtAction[] = [];

    for (const pp of workingProps) {
      const meta = this.metaFor(edition, pp.propertyId);
      if (!meta) continue;

      const isSelected = selectedIds.has(`mortgage:${pp.propertyId}`);
      const canMortgage = pp.houses === 0 && !pp.hasHotel && !pp.mortgaged;

      const base: DebtAction = {
        id: `mortgage:${pp.propertyId}`,
        type: 'mortgage-property',
        propertyId: pp.propertyId,
        propertyName: meta.name,
        groupColor: meta.groupColor,
        amount: meta.mortgageValue,
      };

      if (pp.mortgaged) {
        blockedMortgages.push({ ...base, selected: false, available: false, reason: 'Ya hipotecada' });
      } else if (!canMortgage) {
        blockedMortgages.push({ ...base, selected: false, available: false, reason: 'Vende primero las construcciones' });
      } else {
        if (isSelected) {
          selectedSet.add(base.id);
          selectedRecovery += base.amount;
        }
        mortgageActions.push({
          ...base,
          selected: isSelected,
          available: !isSelected,
        });
      }
    }

    // 5. Recuperación máxima posible si se seleccionara todo lo legal.
    const maxSellRecovery = allSellActions.reduce((sum, a) => sum + a.amount, 0);
    const maxMortgageRecovery = allSellsFinal
      .filter((pp) => !pp.mortgaged && pp.houses === 0 && !pp.hasHotel)
      .reduce((sum, pp) => sum + (this.metaFor(edition, pp.propertyId)?.mortgageValue ?? 0), 0);
    const totalRecovery = maxSellRecovery + maxMortgageRecovery;

    return { sellActions, mortgageActions, blockedMortgages, totalRecovery, selectedRecovery };
  }

  /**
   * Calcula cuánto efectivo puede recuperar un jugador vendiendo construcciones
   * e hipotecando propiedades, sin modificar el estado real.
   * Respeta exactamente las reglas de BuildingRulesService.
   */
  plan(player: Player, edition: Edition): LiquidationPlan {
    const { actions: sellActions, finalProps } = this.enumerateSellActions(player, edition);
    let totalCash = sellActions.reduce((sum, a) => sum + a.amount, 0);
    const housesSold = sellActions.filter((a) => a.type === 'sell-house').length;
    const hotelsSold = sellActions.filter((a) => a.type === 'sell-hotel').length;

    const mortgagedIds: string[] = [];
    for (const pp of finalProps) {
      if (pp.houses === 0 && !pp.hasHotel && !pp.mortgaged) {
        const meta = this.metaFor(edition, pp.propertyId);
        if (meta) {
          pp.mortgaged = true;
          totalCash += meta.mortgageValue;
          mortgagedIds.push(pp.propertyId);
        }
      }
    }

    return {
      properties: finalProps,
      totalCash,
      housesSold,
      hotelsSold,
      mortgagedIds,
      propertyCount: player.properties.length,
    };
  }

  /**
   * Ejecuta un subconjunto de acciones de liquidación en una sola transacción,
   * re-validando cada paso contra el estado fresco de la sala. Si alguna acción
   * ya no es válida (cambió el estado), lanza un error descriptivo y no se
   * aplica nada.
   */
  executeActions(
    roomId: string,
    edition: Edition,
    playerId: string,
    actionIds: string[],
  ): Promise<ExecutedLiquidation> {
    this.requireActor(playerId);

    let result: ExecutedLiquidation | null = null;

    return this.gameState.runInTransaction(roomId, (room) => {
      const player = this.requirePlayer(room, playerId);
      const allOptions = this.enumerateActions(player, edition, new Set(actionIds));

      // Determinar qué acciones son realmente válidas y en qué orden.
      const selectedSells = allOptions.sellActions.filter((a) => a.selected);
      const selectedMortgages = allOptions.mortgageActions.filter((a) => a.selected);

      if (selectedSells.length === 0 && selectedMortgages.length === 0) {
        throw new Error('No hay acciones válidas para aplicar');
      }

      // Cada acción seleccionada se re-valida justo antes de aplicarla; si el
      // estado cambió, lanzamos un error descriptivo y la transacción aborta.
      let workingProps = player.properties.map((pp) => ({ ...pp }));
      let cash = player.cash;
      let housesSold = 0;
      let hotelsSold = 0;
      const mortgagedIds: string[] = [];
      const soldPropertyIds = new Set<string>();
      const mortgagedPropertyIds = new Set<string>();

      const workingPlayer = (): Player => ({ ...player, properties: workingProps });

      // 1. Ventas en orden canónico.
      for (const action of selectedSells) {
        const meta = this.metaFor(edition, action.propertyId);
        if (!meta) throw new Error('Propiedad no encontrada en la edición');

        const check =
          action.type === 'sell-hotel'
            ? this.rules.canSellHotel(workingPlayer(), edition, action.propertyId)
            : this.rules.canSellHouse(workingPlayer(), edition, action.propertyId);

        if (!check.available) {
          throw new Error(check.reason ?? `No se puede vender en ${meta.name}`);
        }

        const pp = workingProps.find((p) => p.propertyId === action.propertyId);
        if (!pp) throw new Error(`No eres dueño de ${meta.name}`);

        if (action.type === 'sell-hotel') {
          pp.houses = 4;
          pp.hasHotel = false;
          hotelsSold++;
        } else {
          pp.houses--;
          housesSold++;
        }
        cash += check.refund ?? action.amount;
        soldPropertyIds.add(action.propertyId);
      }

      // 2. Hipotecas seleccionadas.
      for (const action of selectedMortgages) {
        const meta = this.metaFor(edition, action.propertyId);
        if (!meta) throw new Error('Propiedad no encontrada en la edición');

        const pp = workingProps.find((p) => p.propertyId === action.propertyId);
        if (!pp) throw new Error(`No eres dueño de ${meta.name}`);
        if (pp.mortgaged) throw new Error(`${meta.name} ya está hipotecada`);
        if (pp.houses > 0 || pp.hasHotel) {
          throw new Error(`Debes vender las construcciones de ${meta.name} antes de hipotecar`);
        }

        pp.mortgaged = true;
        cash += meta.mortgageValue;
        mortgagedIds.push(action.propertyId);
        mortgagedPropertyIds.add(action.propertyId);
      }

      // 3. Aplicar al jugador.
      const players = room.players.map((p) =>
        p.id === playerId ? { ...p, cash, properties: workingProps } : p,
      );

      const log = this.buildLog(
        'liquidation',
        cash - player.cash,
        `${player.name} liquidó activos para cubrir un pago`,
        'bank',
        playerId,
        [...soldPropertyIds, ...mortgagedPropertyIds],
        {
          bankAction: 'liquidation',
          debtAssist: true,
          housesSold,
          hotelsSold,
          mortgagedCount: mortgagedIds.length,
          totalCash: cash - player.cash,
        },
      );

      result = { totalCash: cash - player.cash, housesSold, hotelsSold, mortgagedIds };
      return { ...room, players, log: [...room.log, log] };
    }).then(() => {
      if (!result) throw new Error('No se pudo completar la liquidación');
      return result;
    });
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
