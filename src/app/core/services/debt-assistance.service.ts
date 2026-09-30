import { Service, inject } from '@angular/core';
import type { Edition, Player } from '../models';
import { BankService } from './bank.service';
import { LiquidationService, type DebtOptions, type EvaluatedDebtAction } from './liquidation.service';
import { PropertyService } from './property.service';

export interface DebtPayment {
  kind: 'rent' | 'transfer' | 'transfer-multi' | 'tax-income' | 'tax-luxury' | 'jail-fine' | 'buy';
  /** Total a pagar (para transfer-multi: amountPerPlayer × toIds.length). */
  amount: number;
  /** Texto descriptivo para la UI del asistente. */
  label: string;
  toId?: string | 'bank';
  toIds?: (string | 'bank')[];
  amountPerPlayer?: number;
  reason?: string;
  propertyId?: string;
}

export interface DebtPlan {
  shortfall: number;
  availableRecovery: number;
  selectedRecovery: number;
  suggestedActionIds: string[];
  canPay: boolean;
  remainingCash: number;
}

@Service()
export class DebtAssistanceService {
  private readonly liquidation = inject(LiquidationService);
  private readonly bank = inject(BankService);
  private readonly properties = inject(PropertyService);

  calculateShortfall(paymentAmount: number, cash: number): number {
    return Math.max(0, paymentAmount - cash);
  }

  needsAssistance(player: Player, paymentAmount: number): boolean {
    return !player.bankrupt && paymentAmount > player.cash;
  }

  getLiquidationOptions(player: Player, edition: Edition, selectedIds: Set<string> = new Set()): DebtOptions {
    return this.liquidation.enumerateActions(player, edition, selectedIds);
  }

  /**
   * Construye un plan sugerido: elige la menor cantidad de acciones posible
   * cubriendo el déficit, evitando liquidar más de lo necesario.
   *
   * Heurística greedy con disponibilidad dinámica:
   * - mientras falte cubrir, entre las acciones disponibles elige la que cubra
   *   el faltante con el mínimo excedente; si ninguna cubre sola, toma la mayor.
   * - re-evalúa después de cada selección (vender un hotel desbloquea 4 casas
   *   y posiblemente la hipoteca de esa propiedad).
   */
  buildSuggestedPlan(paymentAmount: number, player: Player, edition: Edition): DebtPlan {
    const shortfall = this.calculateShortfall(paymentAmount, player.cash);
    const emptyOptions = this.liquidation.enumerateActions(player, edition, new Set());

    if (shortfall <= 0) {
      return {
        shortfall: 0,
        availableRecovery: emptyOptions.totalRecovery,
        selectedRecovery: 0,
        suggestedActionIds: [],
        canPay: true,
        remainingCash: player.cash - paymentAmount,
      };
    }

    const selected = new Set<string>();
    let selectedRecovery = 0;

    while (selectedRecovery < shortfall) {
      const options = this.liquidation.enumerateActions(player, edition, selected);
      const candidates: EvaluatedDebtAction[] = [
        ...options.sellActions.filter((a) => a.available),
        ...options.mortgageActions.filter((a) => a.available),
      ];

      if (candidates.length === 0) break;

      const remaining = shortfall - selectedRecovery;
      const covering = candidates.filter((a) => a.amount >= remaining);

      const pick =
        covering.length > 0
          ? covering.reduce((best, a) => (a.amount < best.amount ? a : best))
          : candidates.reduce((best, a) => (a.amount > best.amount ? a : best));

      selected.add(pick.id);
      selectedRecovery += pick.amount;
    }

    const canPay = selectedRecovery >= shortfall;
    const remainingCash = player.cash + selectedRecovery - paymentAmount;

    return {
      shortfall,
      availableRecovery: emptyOptions.totalRecovery,
      selectedRecovery,
      suggestedActionIds: [...selected],
      canPay,
      remainingCash,
    };
  }

  /**
   * Aplica el plan de liquidación y, si tiene éxito, completa el pago original
   * a través del servicio correspondiente. Cada operación usa su propia
   * transacción, validando fondos/estado de forma independiente.
   */
  async applyPlanAndPay(
    roomId: string,
    edition: Edition,
    playerId: string,
    actionIds: string[],
    payment: DebtPayment,
  ): Promise<void> {
    // 1. Liquidación atómica (re-valida todo dentro de la transacción).
    await this.liquidation.executeActions(roomId, edition, playerId, actionIds);

    // 2. Pago original usando el servicio existente (vuelve a validar fondos).
    switch (payment.kind) {
      case 'rent': {
        await this.bank.transfer(roomId, playerId, payment.toId!, payment.amount, payment.label);
        break;
      }
      case 'transfer': {
        await this.bank.transfer(
          roomId,
          playerId,
          payment.toId!,
          payment.amount,
          payment.reason ?? payment.label,
        );
        break;
      }
      case 'transfer-multi': {
        await this.bank.transferMulti(
          roomId,
          playerId,
          payment.toIds!,
          payment.amountPerPlayer!,
          payment.reason ?? payment.label,
        );
        break;
      }
      case 'tax-income': {
        await this.bank.payTax(roomId, playerId, payment.amount, 'Impuesto sobre la renta', {
          bankAction: 'income-tax',
        });
        break;
      }
      case 'tax-luxury': {
        await this.bank.payTax(roomId, playerId, payment.amount, 'Impuesto de lujo', {
          bankAction: 'luxury-tax',
        });
        break;
      }
      case 'jail-fine': {
        await this.bank.payJailFine(roomId, playerId, payment.amount);
        break;
      }
      case 'buy': {
        await this.properties.buyProperty(roomId, edition, playerId, payment.propertyId!);
        break;
      }
    }
  }
}
