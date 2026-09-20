import { Injectable } from '@angular/core';
import type { Edition, Player, PlayerProperty, PropertyMetadata, Room } from '../models';

@Injectable({ providedIn: 'root' })
export class RentService {
  calculate(
    room: Room,
    edition: Edition,
    propertyId: string,
    diceSum?: number,
  ): { amount: number; reason: string } {
    const owner = room.players.find((p) =>
      p.properties.some((pp) => pp.propertyId === propertyId),
    );
    if (!owner) return { amount: 0, reason: 'Sin dueño: no se paga alquiler' };

    const meta = edition.properties.find((p) => p.id === propertyId);
    if (!meta) return { amount: 0, reason: 'Propiedad no encontrada en la edición' };

    const pp = owner.properties.find((x) => x.propertyId === propertyId)!;
    if (pp.mortgaged) return { amount: 0, reason: 'La propiedad está hipotecada' };

    if (meta.isRailroad) {
      const railroads = this.countGroupOwned(owner, edition, 'Ferrocarril');
      const rent = meta.rents[Math.min(railroads - 1, 3)] ?? 0;
      return { amount: rent, reason: `${railroads} ferrocarril(es) poseídos` };
    }

    if (meta.isUtility) {
      const utilities = this.countGroupOwned(owner, edition, 'Servicio');
      const multiplier = utilities === 2 ? 10 : 4;
      const safeDice = diceSum ?? 7;
      return {
        amount: safeDice * multiplier,
        reason: `${utilities} servicio(s) poseído(s) × dados ${safeDice}`,
      };
    }

    if (pp.hasHotel) {
      return { amount: meta.rents[5], reason: 'Hotel' };
    }

    const houses = pp.houses;
    const rent = meta.rents[Math.min(houses, 4)] ?? meta.rents[0];

    if (houses === 0 && this.ownsFullGroup(owner, edition, meta.group)) {
      return { amount: rent * 2, reason: 'Monopolio sin construir' };
    }

    return { amount: rent, reason: houses === 0 ? 'Alquiler base' : `${houses} casa(s)` };
  }

  private countGroupOwned(owner: Player, edition: Edition, group: string): number {
    const groupIds = edition.properties.filter((p) => p.group === group).map((p) => p.id);
    return owner.properties.filter((pp) =>
      groupIds.includes(pp.propertyId) && !pp.mortgaged,
    ).length;
  }

  ownsFullGroup(owner: Player, edition: Edition, group: string): boolean {
    const groupProps = edition.properties.filter((p) =>
      p.group === group && !p.isRailroad && !p.isUtility,
    );
    if (groupProps.length === 0) return false;
    const owned = owner.properties.filter((pp) =>
      groupProps.some((gp) => gp.id === pp.propertyId) && !pp.mortgaged,
    );
    return owned.length === groupProps.length;
  }

  canBuildMore(owner: Player, edition: Edition, target: PropertyMetadata): boolean {
    const groupProps = edition.properties.filter((p) => p.group === target.group);
    const owned = groupProps
      .map((p) => owner.properties.find((pp) => pp.propertyId === p.id))
      .filter((pp): pp is PlayerProperty => !!pp && !pp.mortgaged);
    if (owned.length < groupProps.length) return false;

    const targetHouses = owned.find((pp) => pp.propertyId === target.id)?.houses ?? 0;
    const minHouses = Math.min(...owned.map((pp) => pp.houses));
    return targetHouses <= minHouses;
  }
}
