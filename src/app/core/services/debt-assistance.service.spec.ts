import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { DebtAssistanceService } from './debt-assistance.service';
import { LiquidationService } from './liquidation.service';
import { BankService } from './bank.service';
import { PropertyService } from './property.service';
import { GameStateService } from './game-state.service';
import { AuthService } from './auth.service';
import { IdService } from './id.service';
import { BuildingRulesService } from './building-rules.service';
import { CLASSIC_SPAIN } from '../constants/editions';
import type { Player, Room } from '../models';

const p1 = CLASSIC_SPAIN.properties.find((p) => p.id === 'p1')!;
const p2 = CLASSIC_SPAIN.properties.find((p) => p.id === 'p2')!;
const p3 = CLASSIC_SPAIN.properties.find((p) => p.id === 'p3')!;
const p23 = CLASSIC_SPAIN.properties.find((p) => p.id === 'p23')!; // ferrocarril

function makePlayer(props: Player['properties'], cash: number): Player {
  return {
    id: 'u1',
    name: 'Ana',
    avatarColor: 'bg-red-500',
    cash,
    properties: props,
    bankrupt: false,
    host: true,
    joinedAt: 0,
  };
}

describe('DebtAssistanceService', () => {
  let service: DebtAssistanceService;

  beforeEach(() => {
    const auth = { userId: () => 'u1', ready: () => true, error: () => null } as unknown as AuthService;

    TestBed.configureTestingModule({
      providers: [
        DebtAssistanceService,
        LiquidationService,
        BankService,
        PropertyService,
        IdService,
        BuildingRulesService,
        { provide: GameStateService, useValue: { runInTransaction: vi.fn() } },
        { provide: AuthService, useValue: auth },
      ],
    });

    service = TestBed.inject(DebtAssistanceService);
  });

  it('calculates shortfall when cash is insufficient', () => {
    expect(service.calculateShortfall(500, 200)).toBe(300);
  });

  it('returns zero shortfall when cash is enough', () => {
    expect(service.calculateShortfall(500, 600)).toBe(0);
  });

  it('detects assistance need when bankrupt', () => {
    const player = makePlayer([], 0);
    player.bankrupt = true;
    expect(service.needsAssistance(player, 100)).toBe(false);
  });

  it('lists sell actions and blocked mortgages until buildings are sold', () => {
    // Grupo completo para poder vender las 2 casas (construcción uniforme requiere ambas props).
    const player = makePlayer(
      [
        { propertyId: p1.id, houses: 1, hasHotel: false, mortgaged: false },
        { propertyId: p2.id, houses: 1, hasHotel: false, mortgaged: false },
      ],
      0,
    );
    const options = service.getLiquidationOptions(player, CLASSIC_SPAIN);

    expect(options.sellActions.length).toBe(2);
    expect(options.mortgageActions.length).toBe(0);
    expect(options.blockedMortgages.length).toBe(2);
    expect(options.totalRecovery).toBe(
      2 * Math.round(p1.houseCost / 2) + p1.mortgageValue + p2.mortgageValue,
    );

    // Al seleccionar todas las ventas, las hipotecas se desbloquean.
    const allSells = new Set(options.sellActions.map((a) => a.id));
    const selected = service.getLiquidationOptions(player, CLASSIC_SPAIN, allSells);
    expect(selected.mortgageActions.length).toBe(2);
  });

  it('blocks mortgage when property still has buildings', () => {
    const player = makePlayer(
      [{ propertyId: p1.id, houses: 1, hasHotel: false, mortgaged: false }],
      0,
    );
    const options = service.getLiquidationOptions(player, CLASSIC_SPAIN);

    expect(options.mortgageActions.length).toBe(0);
    expect(options.blockedMortgages.length).toBe(1);
    expect(options.blockedMortgages[0].reason).toContain('construcciones');
  });

  it('suggested plan covers shortfall with minimal actions', () => {
    // Una sola hipoteca cubre el déficit: no debería vender casas.
    const player = makePlayer(
      [
        { propertyId: p1.id, houses: 2, hasHotel: false, mortgaged: false },
        { propertyId: p23.id, houses: 0, hasHotel: false, mortgaged: false },
      ],
      50,
    );
    const plan = service.buildSuggestedPlan(p23.mortgageValue, player, CLASSIC_SPAIN);

    expect(plan.canPay).toBe(true);
    expect(plan.shortfall).toBe(p23.mortgageValue - 50);
    expect(plan.suggestedActionIds).toContain(`mortgage:${p23.id}`);
    expect(plan.suggestedActionIds.some((id) => id.startsWith('sell-house'))).toBe(false);
  });

  it('suggested plan falls back to selling buildings when mortgages are not enough', () => {
    // Grupo completo con 4 casas en cada una para que todas las ventas sean legales.
    const player = makePlayer(
      [
        { propertyId: p1.id, houses: 4, hasHotel: false, mortgaged: false },
        { propertyId: p2.id, houses: 4, hasHotel: false, mortgaged: false },
      ],
      0,
    );
    const shortfall = Math.round(p1.houseCost / 2) * 2 + 10;
    const plan = service.buildSuggestedPlan(shortfall, player, CLASSIC_SPAIN);

    expect(plan.canPay).toBe(true);
    expect(plan.selectedRecovery).toBeGreaterThanOrEqual(shortfall);
  });

  it('reports cannot pay when assets are insufficient', () => {
    const player = makePlayer(
      [{ propertyId: p1.id, houses: 0, hasHotel: false, mortgaged: false }],
      0,
    );
    const plan = service.buildSuggestedPlan(p1.mortgageValue + 1000, player, CLASSIC_SPAIN);

    expect(plan.canPay).toBe(false);
    expect(plan.selectedRecovery).toBe(p1.mortgageValue);
  });

  it('applyPlanAndPay dispatches rent payment after liquidation', async () => {
    const runInTransactionMock = vi.fn(async (_roomId: string, mutator: (room: Room) => Room | null) => {
      const room: Room = {
        id: 'ROOM',
        editionId: CLASSIC_SPAIN.id,
        hostId: 'u1',
        status: 'playing' as const,
        players: [
          makePlayer([{ propertyId: p1.id, houses: 0, hasHotel: false, mortgaged: false }], 0),
          { id: 'u2', name: 'Ben', avatarColor: 'bg-blue-500', cash: 0, properties: [], bankrupt: false, host: false, joinedAt: 0 },
        ],
        log: [],
        trades: [],
        createdAt: 0,
        updatedAt: 0,
      };
      const next = mutator(room);
      if (next) Object.assign(room, next);
    });

    const gameState = { runInTransaction: runInTransactionMock } as unknown as GameStateService;

    TestBed.resetTestingModule();
    const auth = { userId: () => 'u1', ready: () => true, error: () => null } as unknown as AuthService;
    TestBed.configureTestingModule({
      providers: [
        DebtAssistanceService,
        LiquidationService,
        BankService,
        PropertyService,
        IdService,
        BuildingRulesService,
        { provide: GameStateService, useValue: gameState },
        { provide: AuthService, useValue: auth },
      ],
    });

    const testService = TestBed.inject(DebtAssistanceService);
    const bank = TestBed.inject(BankService);
    const transferSpy = vi.spyOn(bank, 'transfer').mockResolvedValue(undefined);

    await testService.applyPlanAndPay('ROOM', CLASSIC_SPAIN, 'u1', [`mortgage:${p1.id}`], {
      kind: 'rent',
      amount: p1.mortgageValue,
      label: 'Renta de prueba',
      toId: 'u2',
    });

    expect(transferSpy).toHaveBeenCalledWith('ROOM', 'u1', 'u2', p1.mortgageValue, 'Renta de prueba');
  });
});
