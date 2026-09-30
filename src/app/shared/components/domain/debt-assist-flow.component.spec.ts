import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { DebtAssistFlowComponent } from './debt-assist-flow.component';
import { MoneyFormatService } from '../../../core/services/money-format.service';
import { DebtAssistanceService } from '../../../core/services/debt-assistance.service';
import { LiquidationService, type LiquidationPlan } from '../../../core/services/liquidation.service';
import { BankService } from '../../../core/services/bank.service';
import { ToastService } from '../../../core/services/toast.service';
import { SoundService } from '../../../core/services/sound.service';
import { CLASSIC_SPAIN } from '../../../core/constants/editions';
import type { Player } from '../../../core/models';
import type { DebtPayment } from '../../../core/services/debt-assistance.service';

const me: Player = {
  id: 'me',
  name: 'Yo',
  avatarColor: '#ff0000',
  cash: 200,
  bankrupt: false,
  host: true,
  joinedAt: 0,
  properties: [{ propertyId: 'p1', houses: 0, hasHotel: false, mortgaged: false }],
};

const creditor: Player = {
  id: 'u2',
  name: 'Ana',
  avatarColor: '#000000',
  cash: 1000,
  bankrupt: false,
  host: false,
  joinedAt: 0,
  properties: [],
};

const plan: LiquidationPlan = {
  properties: [{ propertyId: 'p1', houses: 0, hasHotel: false, mortgaged: true }],
  totalCash: 400,
  housesSold: 0,
  hotelsSold: 0,
  mortgagedIds: ['p1'],
  propertyCount: 1,
};

function makePayment(): DebtPayment {
  return { kind: 'rent', amount: 1000, label: 'Alquiler', toId: 'u2' };
}

describe('DebtAssistFlowComponent', () => {
  let debtAssistance: {
    applyPlanAndPay: ReturnType<typeof vi.fn>;
    buildSuggestedPlan: ReturnType<typeof vi.fn>;
    calculateShortfall: ReturnType<typeof vi.fn>;
    needsAssistance: ReturnType<typeof vi.fn>;
    getLiquidationOptions: ReturnType<typeof vi.fn>;
  };
  let liquidation: { executeActions: ReturnType<typeof vi.fn>; plan: ReturnType<typeof vi.fn> };
  let bank: { declareBankruptcy: ReturnType<typeof vi.fn> };
  let toast: { success: ReturnType<typeof vi.fn>; error: ReturnType<typeof vi.fn> };
  let sound: { play: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    debtAssistance = {
      applyPlanAndPay: vi.fn().mockResolvedValue(undefined),
      buildSuggestedPlan: vi.fn().mockReturnValue({ suggestedActionIds: [] }),
      calculateShortfall: vi.fn().mockReturnValue(0),
      needsAssistance: vi.fn().mockReturnValue(false),
      getLiquidationOptions: vi.fn().mockReturnValue({
        sellActions: [],
        mortgageActions: [],
        blockedMortgages: [],
        totalRecovery: 0,
        selectedRecovery: 0,
      }),
    };
    liquidation = {
      executeActions: vi.fn().mockResolvedValue({ totalCash: 400, housesSold: 0, hotelsSold: 0, mortgagedIds: ['p1'] }),
      plan: vi.fn().mockReturnValue(plan),
    };
    bank = { declareBankruptcy: vi.fn().mockResolvedValue(undefined) };
    toast = { success: vi.fn(), error: vi.fn() };
    sound = { play: vi.fn() };

    TestBed.configureTestingModule({
      providers: [
        MoneyFormatService,
        { provide: DebtAssistanceService, useValue: debtAssistance as unknown as DebtAssistanceService },
        { provide: LiquidationService, useValue: liquidation as unknown as LiquidationService },
        { provide: BankService, useValue: bank as unknown as BankService },
        { provide: ToastService, useValue: toast as unknown as ToastService },
        { provide: SoundService, useValue: sound as unknown as SoundService },
      ],
    });
  });

  function setup(payment?: DebtPayment) {
    const fixture = TestBed.createComponent(DebtAssistFlowComponent);
    fixture.componentRef.setInput('open', true);
    fixture.componentRef.setInput('roomId', 'ROOM');
    fixture.componentRef.setInput('me', me);
    fixture.componentRef.setInput('edition', CLASSIC_SPAIN);
    fixture.componentRef.setInput('players', [me, { ...creditor }]);
    fixture.componentRef.setInput('payment', payment);
    fixture.detectChanges();
    return { fixture, component: fixture.componentInstance as any };
  }

  it('applies plan and pays when a payment is provided', async () => {
    const { component } = setup(makePayment());
    await component.onApply(['action-1']);

    expect(debtAssistance.applyPlanAndPay).toHaveBeenCalledWith('ROOM', CLASSIC_SPAIN, 'me', ['action-1'], makePayment());
    expect(toast.success).toHaveBeenCalledWith('Pago completado', 'Alquiler');
  });

  it('liquidates selected actions in recovery mode (no payment)', async () => {
    const { component } = setup();
    await component.onApply(['action-1']);

    expect(liquidation.executeActions).toHaveBeenCalledWith('ROOM', CLASSIC_SPAIN, 'me', ['action-1']);
    expect(toast.success).toHaveBeenCalled();
    expect(sound.play).toHaveBeenCalledWith('cashIn');
  });

  it('opens confirm dialog with settlement creditors on bankruptcy request with payment', () => {
    const { component } = setup(makePayment());
    component.onBankruptcyRequest();

    expect(component.confirmOpen()).toBe(true);
    expect(component.pendingBankruptcy()).toMatchObject({
      mode: 'debt',
      creditors: [{ playerId: 'u2', owed: 1000 }],
      totalAvailable: 600,
    });
    expect(component.confirmMessage()).toContain('Ana');
  });

  it('declares bankruptcy with settlement when confirm is accepted', async () => {
    const { component } = setup(makePayment());
    component.onBankruptcyRequest();
    await component.onConfirmBankruptcy(true);

    expect(bank.declareBankruptcy).toHaveBeenCalledWith('ROOM', 'me', {
      edition: CLASSIC_SPAIN,
      creditors: [{ playerId: 'u2', owed: 1000 }],
    });
    expect(toast.success).toHaveBeenCalledWith('Bancarrota declarada', expect.stringContaining('Ana'));
  });

  it('declares plain bankruptcy in recovery mode when confirmed', async () => {
    const { component } = setup();
    component.onBankruptcyRequest();
    await component.onConfirmBankruptcy(true);

    expect(bank.declareBankruptcy).toHaveBeenCalledWith('ROOM', 'me', undefined);
    expect(toast.success).toHaveBeenCalledWith('Bancarrota declarada', 'Estás fuera de la partida');
  });

  it('does nothing when bankruptcy confirm is cancelled', async () => {
    const { component } = setup(makePayment());
    component.onBankruptcyRequest();
    await component.onConfirmBankruptcy(false);

    expect(bank.declareBankruptcy).not.toHaveBeenCalled();
  });

  it('builds proportional creditors for transfer-multi payments', () => {
    const multiPayment: DebtPayment = {
      kind: 'transfer-multi',
      amount: 600,
      label: 'Reparto',
      toIds: ['u2', 'u3'],
      amountPerPlayer: 300,
      reason: 'Prueba',
    };
    const { component } = setup(multiPayment);
    const creditors = component.buildCreditors(multiPayment);

    expect(creditors).toEqual([
      { playerId: 'u2', owed: 300 },
      { playerId: 'u3', owed: 300 },
    ]);
  });
});
