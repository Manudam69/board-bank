import { Service } from '@angular/core';
import type { Edition, Player, PlayerProperty, PropertyMetadata } from '../models';

/** Nivel efectivo de construcción: 0..4 casas, 5 hotel. */
export type BuildingLevel = 0 | 1 | 2 | 3 | 4 | 5;

export interface GroupPropertyState {
  meta: PropertyMetadata;
  owned?: PlayerProperty;
  /** Nivel efectivo: hasHotel ? 5 : houses */
  level: BuildingLevel;
}

export interface GroupBuildingState {
  group: string;
  color: string;
  /** True si el jugador posee todas las propiedades del grupo y ninguna está hipotecada. */
  canBuild: boolean;
  /** Razón si no se puede construir en el grupo. */
  groupReason?: string;
  properties: GroupPropertyState[];
}

export type BuildingActionId = 'build-house' | 'build-hotel' | 'sell-house' | 'sell-hotel';

export interface BuildingAction {
  id: BuildingActionId;
  label: string;
  available: boolean;
  /** Costo para acciones de compra (negativo = dinero que sale). */
  cost?: number;
  /** Reembolso para acciones de venta (positivo). */
  refund?: number;
  /** Explicación legible cuando la acción no está disponible. */
  reason?: string;
  /** Versión corta para mostrar en tarjetas compactas. */
  shortReason?: string;
}

/**
 * Servicio puro de reglas de construcción de Monopoly.
 * No tiene estado: toma un jugador y una edición y responde qué se puede construir,
 * vender o reorganizar y por qué no.
 */
@Service()
export class BuildingRulesService {
  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  levelOf(pp: PlayerProperty): BuildingLevel {
    return pp.hasHotel ? 5 : (pp.houses as BuildingLevel);
  }

  private ownsFullGroup(player: Player, edition: Edition, group: string): boolean {
    const groupProps = edition.properties.filter((p) => p.group === group);
    if (groupProps.length === 0) return false;

    for (const meta of groupProps) {
      const owned = player.properties.find((pp) => pp.propertyId === meta.id);
      if (!owned || owned.mortgaged) return false;
    }
    return true;
  }

  private isStreet(meta: PropertyMetadata): boolean {
    return !meta.isRailroad && !meta.isUtility;
  }

  private validBuildingDistribution(levels: BuildingLevel[]): boolean {
    if (levels.length === 0) return true;
    const min = Math.min(...levels);
    const max = Math.max(...levels);
    return max - min <= 1;
  }

  private groupLevels(state: GroupBuildingState): BuildingLevel[] {
    return state.properties.map((p) => p.level);
  }

  /** Simula un cambio de nivel en un índice y valida la distribución resultante. */
  private validAfterChange(state: GroupBuildingState, index: number, newLevel: BuildingLevel): boolean {
    const next = this.groupLevels(state).map((level, i) => (i === index ? newLevel : level));
    return this.validBuildingDistribution(next);
  }

  // ---------------------------------------------------------------------------
  // Estado del grupo
  // ---------------------------------------------------------------------------

  getGroupState(player: Player, edition: Edition, group: string): GroupBuildingState {
    const groupProps = edition.properties
      .filter((p) => p.group === group)
      .sort((a, b) => a.order - b.order);

    const properties: GroupPropertyState[] = groupProps.map((meta) => {
      const owned = player.properties.find((pp) => pp.propertyId === meta.id);
      return {
        meta,
        owned,
        level: owned ? this.levelOf(owned) : 0,
      };
    });

    const missing = properties.filter((p) => !p.owned).map((p) => p.meta.name);
    const mortgaged = properties
      .filter((p) => p.owned?.mortgaged)
      .map((p) => p.meta.name);

    let groupReason: string | undefined;
    if (missing.length > 0) {
      groupReason = `Necesitas todas las propiedades del grupo: te falta ${missing.join(', ')}`;
    } else if (mortgaged.length > 0) {
      groupReason = `No puedes construir con propiedades hipotecadas en el grupo: ${mortgaged.join(', ')}`;
    }

    return {
      group,
      color: groupProps[0]?.groupColor ?? '#000000',
      canBuild: !groupReason,
      groupReason,
      properties,
    };
  }

  /**
   * Devuelve los grupos del jugador que tienen al menos una propiedad
   * de calle (no ferrocarril/servicio). Incluye grupos incompletos para poder
   * mostrarlos con su razón de bloqueo.
   */
  getPlayerGroups(player: Player, edition: Edition): GroupBuildingState[] {
    const groups = new Set(
      edition.properties
        .filter((p) => this.isStreet(p))
        .map((p) => p.group),
    );

    return [...groups]
      .sort()
      .map((group) => this.getGroupState(player, edition, group))
      .filter((state) => state.properties.some((p) => p.owned));
  }

  // ---------------------------------------------------------------------------
  // Acciones unitarias
  // ---------------------------------------------------------------------------

  canBuildHouse(
    player: Player,
    edition: Edition,
    propertyId: string,
  ): { available: boolean; reason?: string; shortReason?: string; cost?: number } {
    const meta = edition.properties.find((p) => p.id === propertyId);
    if (!meta) return { available: false, reason: 'Propiedad no encontrada', shortReason: 'No disponible' };
    if (!this.isStreet(meta)) return { available: false, reason: 'No se puede construir en ferrocarriles ni servicios', shortReason: 'No disponible' };

    const state = this.getGroupState(player, edition, meta.group);
    if (!state.canBuild) return { available: false, reason: state.groupReason, shortReason: state.groupReason, cost: meta.houseCost };

    const index = state.properties.findIndex((p) => p.meta.id === propertyId);
    const target = state.properties[index];
    if (!target.owned) return { available: false, reason: 'No posees esta propiedad', shortReason: 'No disponible', cost: meta.houseCost };
    if (target.level === 5) return { available: false, reason: 'Ya hay un hotel aquí', shortReason: 'Hotel existente', cost: meta.houseCost };
    if (target.level === 4) {
      return { available: false, reason: 'Tienes 4 casas: el siguiente paso es construir un hotel', shortReason: 'Siguiente: hotel', cost: meta.houseCost };
    }

    const nextLevel = (target.level + 1) as BuildingLevel;
    if (!this.validAfterChange(state, index, nextLevel)) {
      const lower = state.properties
        .filter((p, i) => i !== index && p.level < nextLevel)
        .map((p) => p.meta.name);
      return {
        available: false,
        reason: `Construye primero en ${lower.join(' y ')} para mantener la construcción uniforme`,
        shortReason: `Primero en ${this.joinNames(lower)}`,
        cost: meta.houseCost,
      };
    }

    if (player.cash < meta.houseCost) {
      return {
        available: false,
        reason: `Dinero insuficiente: necesitas ${this.formatAmount(meta.houseCost)}`,
        shortReason: 'Dinero insuficiente',
        cost: meta.houseCost,
      };
    }

    return { available: true, cost: meta.houseCost };
  }

  canBuildHotel(
    player: Player,
    edition: Edition,
    propertyId: string,
  ): { available: boolean; reason?: string; shortReason?: string; cost?: number } {
    const meta = edition.properties.find((p) => p.id === propertyId);
    if (!meta) return { available: false, reason: 'Propiedad no encontrada', shortReason: 'No disponible' };
    if (!this.isStreet(meta)) return { available: false, reason: 'No se puede construir hoteles aquí', shortReason: 'No disponible' };

    const state = this.getGroupState(player, edition, meta.group);
    if (!state.canBuild) return { available: false, reason: state.groupReason, shortReason: state.groupReason, cost: meta.hotelCost };

    const index = state.properties.findIndex((p) => p.meta.id === propertyId);
    const target = state.properties[index];
    if (!target.owned) return { available: false, reason: 'No posees esta propiedad', shortReason: 'No disponible', cost: meta.hotelCost };
    if (target.level === 5) return { available: false, reason: 'Ya hay un hotel aquí', shortReason: 'Hotel existente', cost: meta.hotelCost };
    if (target.level < 4) {
      return {
        available: false,
        reason: `Requiere 4 casas en esta propiedad (tiene ${target.level})`,
        shortReason: 'Requiere 4 casas',
        cost: meta.hotelCost,
      };
    }

    if (!this.validAfterChange(state, index, 5)) {
      const missing = state.properties
        .filter((p, i) => i !== index && p.level < 4)
        .map((p) => p.meta.name);
      return {
        available: false,
        reason: `Requiere 4 casas en todo el grupo. Te falta nivelar: ${missing.join(', ')}`,
        shortReason: `Nivela: ${this.joinNames(missing)}`,
        cost: meta.hotelCost,
      };
    }

    if (player.cash < meta.hotelCost) {
      return {
        available: false,
        reason: `Dinero insuficiente: necesitas ${this.formatAmount(meta.hotelCost)}`,
        shortReason: 'Dinero insuficiente',
        cost: meta.hotelCost,
      };
    }

    return { available: true, cost: meta.hotelCost };
  }

  canSellHouse(
    player: Player,
    edition: Edition,
    propertyId: string,
  ): { available: boolean; reason?: string; shortReason?: string; refund?: number } {
    const meta = edition.properties.find((p) => p.id === propertyId);
    const houseCost = meta?.houseCost ?? 0;
    if (!meta) return { available: false, reason: 'Propiedad no encontrada', shortReason: 'No disponible', refund: Math.round(houseCost / 2) };
    if (!this.isStreet(meta)) return { available: false, reason: 'No se pueden vender casas aquí', shortReason: 'No disponible', refund: Math.round(houseCost / 2) };

    const state = this.getGroupState(player, edition, meta.group);
    const index = state.properties.findIndex((p) => p.meta.id === propertyId);
    const target = state.properties[index];
    if (!target?.owned) return { available: false, reason: 'No posees esta propiedad', shortReason: 'No disponible', refund: Math.round(houseCost / 2) };

    if (target.level === 0) {
      return { available: false, reason: 'No hay casas que vender', shortReason: 'Sin casas', refund: Math.round(houseCost / 2) };
    }
    if (state.properties.some((p) => p.owned?.hasHotel)) {
      return { available: false, reason: 'Vende primero el hotel', shortReason: 'Vende primero el hotel', refund: Math.round(houseCost / 2) };
    }

    const nextLevel = (target.level - 1) as BuildingLevel;
    if (!this.validAfterChange(state, index, nextLevel)) {
      const higher = state.properties
        .filter((p, i) => i !== index && p.level > target.level - 1)
        .map((p) => p.meta.name);
      return {
        available: false,
        reason: `Debes vender primero desde ${higher.join(' y ')} para mantener la construcción uniforme`,
        shortReason: `Vende antes en ${this.joinNames(higher)}`,
        refund: Math.round(houseCost / 2),
      };
    }

    return { available: true, refund: Math.round(houseCost / 2) };
  }

  canSellHotel(
    player: Player,
    edition: Edition,
    propertyId: string,
  ): { available: boolean; reason?: string; shortReason?: string; refund?: number } {
    const meta = edition.properties.find((p) => p.id === propertyId);
    const hotelCost = meta?.hotelCost ?? 0;
    if (!meta) return { available: false, reason: 'Propiedad no encontrada', shortReason: 'No disponible', refund: Math.round(hotelCost / 2) };
    if (!this.isStreet(meta)) return { available: false, reason: 'No hay hotel aquí', shortReason: 'No disponible', refund: Math.round(hotelCost / 2) };

    const state = this.getGroupState(player, edition, meta.group);
    const index = state.properties.findIndex((p) => p.meta.id === propertyId);
    const target = state.properties[index];
    if (!target?.owned) return { available: false, reason: 'No posees esta propiedad', shortReason: 'No disponible', refund: Math.round(hotelCost / 2) };
    if (target.level !== 5) {
      return { available: false, reason: 'No hay hotel en esta propiedad', shortReason: 'Sin hotel', refund: Math.round(hotelCost / 2) };
    }

    if (!this.validAfterChange(state, index, 4)) {
      return {
        available: false,
        reason: 'Vender el hotel rompería la construcción uniforme del grupo',
        shortReason: 'No disponible',
        refund: Math.round(hotelCost / 2),
      };
    }

    return { available: true, refund: Math.round(hotelCost / 2) };
  }

  // ---------------------------------------------------------------------------
  // Reorganización
  // ---------------------------------------------------------------------------

  /**
   * Valida una distribución objetivo para reorganizar casas dentro de un grupo.
   * Requisitos: mismo total de casas, cada propiedad 0..4, sin hoteles en el grupo,
   * distribución uniforme (max-min <= 1), grupo completo y sin hipotecas.
   */
  validateRearrangement(
    player: Player,
    edition: Edition,
    group: string,
    distribution: Record<string, number>,
  ): { valid: boolean; reason?: string } {
    const state = this.getGroupState(player, edition, group);
    if (!state.canBuild) return { valid: false, reason: state.groupReason };

    const levels: BuildingLevel[] = [];
    const currentTotal = state.properties.reduce((sum, p) => sum + (p.owned?.houses ?? 0), 0);
    let targetTotal = 0;

    for (const prop of state.properties) {
      const target = distribution[prop.meta.id];
      if (target === undefined) return { valid: false, reason: `Falta la distribución para ${prop.meta.name}` };
      if (!Number.isInteger(target) || target < 0 || target > 4) {
        return { valid: false, reason: `${prop.meta.name}: solo se permiten entre 0 y 4 casas` };
      }
      if (prop.owned?.hasHotel) {
        return { valid: false, reason: `${prop.meta.name}: no se pueden reorganizar hoteles` };
      }
      levels.push(target as BuildingLevel);
      targetTotal += target;
    }

    if (targetTotal !== currentTotal) {
      return {
        valid: false,
        reason: `La reorganización no puede cambiar la cantidad total de casas (${currentTotal} → ${targetTotal})`,
      };
    }

    if (!this.validBuildingDistribution(levels)) {
      return { valid: false, reason: 'La nueva distribución rompe la construcción uniforme (máx. diferencia de 1 casa)' };
    }

    return { valid: true };
  }

  canRearrange(player: Player, edition: Edition, group: string): { available: boolean; reason?: string } {
    const state = this.getGroupState(player, edition, group);
    if (!state.canBuild) return { available: false, reason: state.groupReason };

    if (state.properties.some((p) => p.owned?.hasHotel)) {
      return { available: false, reason: 'No se puede reorganizar mientras haya hoteles en el grupo' };
    }

    const totalHouses = state.properties.reduce((sum, p) => sum + (p.owned?.houses ?? 0), 0);
    if (totalHouses === 0) return { available: false, reason: 'No hay casas que reorganizar' };

    if (!this.hasAlternativeDistribution(state)) {
      return { available: false, reason: 'No existe otra distribución válida dentro del grupo' };
    }

    return { available: true };
  }

  private hasAlternativeDistribution(state: GroupBuildingState): boolean {
    const current = state.properties.map((p) => p.owned?.houses ?? 0);
    const total = current.reduce((a, b) => a + b, 0);
    const n = current.length;

    // Genera todas las distribuciones válidas con el mismo total y cuenta si hay > 1.
    // Los grupos de Monopoly son 2 o 3 propiedades, así que esto es trivial.
    const validConfigs: number[][] = [];

    const generate = (remaining: number, slots: number, min: number, max: number, acc: number[]) => {
      if (slots === 0) {
        if (remaining === 0) validConfigs.push([...acc]);
        return;
      }
      for (let v = min; v <= max; v++) {
        if (v > remaining) break;
        acc.push(v);
        generate(remaining - v, slots - 1, min, max, acc);
        acc.pop();
      }
    };

    generate(total, n, 0, 4, []);

    // Filtra las que sean permutaciones de la actual
    const sortedCurrent = [...current].sort().join(',');
    const distinct = validConfigs.filter((cfg) => cfg.sort().join(',') !== sortedCurrent);

    return distinct.length > 0;
  }

  // ---------------------------------------------------------------------------
  // Acciones agregadas para la UI
  // ---------------------------------------------------------------------------

  getAvailableActions(
    player: Player,
    edition: Edition,
    propertyId: string,
  ): BuildingAction[] {
    const meta = edition.properties.find((p) => p.id === propertyId);
    if (!meta) return [];
    if (!this.isStreet(meta)) return [];

    const state = this.getGroupState(player, edition, meta.group);
    const target = state.properties.find((p) => p.meta.id === propertyId);
    if (!target?.owned) return [];

    const buildHouse = this.canBuildHouse(player, edition, propertyId);
    const buildHotel = this.canBuildHotel(player, edition, propertyId);
    const sellHouse = this.canSellHouse(player, edition, propertyId);
    const sellHotel = this.canSellHotel(player, edition, propertyId);
    return [
      {
        id: 'build-house',
        label: '+ Casa',
        available: buildHouse.available,
        cost: buildHouse.cost,
        reason: buildHouse.reason,
        shortReason: buildHouse.shortReason,
      },
      {
        id: 'build-hotel',
        label: '+ Hotel',
        available: buildHotel.available,
        cost: buildHotel.cost,
        reason: buildHotel.reason,
        shortReason: buildHotel.shortReason,
      },
      {
        id: 'sell-house',
        label: '− Casa',
        available: sellHouse.available,
        refund: sellHouse.refund,
        reason: sellHouse.reason,
        shortReason: sellHouse.shortReason,
      },
      {
        id: 'sell-hotel',
        label: '− Hotel',
        available: sellHotel.available,
        refund: sellHotel.refund,
        reason: sellHotel.reason,
        shortReason: sellHotel.shortReason,
      },
    ];
  }

  // ---------------------------------------------------------------------------
  // Utilidades
  // ---------------------------------------------------------------------------

  private formatAmount(amount: number): string {
    return amount.toLocaleString('es-ES');
  }

  private joinNames(names: string[]): string {
    if (names.length <= 2) return names.join(' y ');
    return `${names.slice(0, 2).join(', ')}…`;
  }
}
