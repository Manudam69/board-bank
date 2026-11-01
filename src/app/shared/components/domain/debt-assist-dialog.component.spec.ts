import { describe, it, expect, beforeEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { DebtAssistDialogComponent } from './debt-assist-dialog.component';
import { MoneyFormatService } from '../../../core/services/money-format.service';
import { CLASSIC_SPAIN } from '../../../core/constants/editions';
import type { Player } from '../../../core/models';
import type { DebtPayment } from '../../../core/services/debt-assistance.service';

function makeMe(cash: number, propertyIds: string[]): Player {
  return {
    id: 'me',
    name: 'Yo',
    avatarColor: 'bg-red-500',
    cash,
    bankrupt: false,
    host: true,
    joinedAt: 0,
    properties: propertyIds.map((propertyId) => ({ propertyId, houses: 0, hasHotel: false, mortgaged: false })),
  };
}

const payment: DebtPayment = { kind: 'rent', amount: 150, label: 'Renta de Madrid', toId: 'u2' };

describe('DebtAssistDialogComponent', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [MoneyFormatService] });
  });

  function create(me: Player, debt?: DebtPayment) {
    const fixture = TestBed.createComponent(DebtAssistDialogComponent);
    fixture.componentRef.setInput('open', true);
    fixture.componentRef.setInput('me', me);
    fixture.componentRef.setInput('edition', CLASSIC_SPAIN);
    fixture.componentRef.setInput('currency', CLASSIC_SPAIN.currency);
    fixture.componentRef.setInput('payment', debt);
    fixture.detectChanges();
    return fixture;
  }

  type Fixture = ReturnType<typeof create>;

  function click(fixture: Fixture, label: string): void {
    const target = (Array.from(fixture.nativeElement.querySelectorAll('button')) as HTMLElement[]).find((b) =>
      b.textContent?.includes(label),
    );
    expect(target, `button "${label}"`).toBeTruthy();
    target!.click();
    fixture.detectChanges();
  }

  it('starts by explaining how much is missing', () => {
    const fixture = create(makeMe(100, ['p1', 'p3']), payment);
    const text = fixture.nativeElement.textContent;
    expect(text).toContain('Te faltan €50');
    expect(text).toContain('Renta de Madrid');
    expect(text).toContain('Armar mi plan');
  });

  it('walks through plan and confirmation and emits the selected actions', () => {
    const fixture = create(makeMe(100, ['p1', 'p3']), payment);
    const emitted: string[][] = [];
    fixture.componentInstance.applyAction.subscribe((ids) => emitted.push(ids));

    click(fixture, 'Armar mi plan');
    expect(fixture.nativeElement.textContent).toContain('¿Qué vendes o hipotecas?');
    expect(fixture.nativeElement.textContent).toContain('Cubres la deuda');

    click(fixture, 'Revisar plan');
    expect(fixture.nativeElement.textContent).toContain('Confirma el plan');
    expect(fixture.nativeElement.textContent).toContain('Hipotecar');

    click(fixture, 'Aplicar plan y pagar');
    expect(emitted).toHaveLength(1);
    expect(emitted[0].length).toBeGreaterThan(0);
  });

  it('lets the user go back from the confirmation to edit the plan', () => {
    const fixture = create(makeMe(100, ['p1', 'p3']), payment);
    click(fixture, 'Armar mi plan');
    click(fixture, 'Revisar plan');
    click(fixture, 'Editar');

    expect(fixture.nativeElement.textContent).toContain('¿Qué vendes o hipotecas?');
  });

  it('offers bankruptcy when there are no assets to cover the debt and hides the plan button', () => {
    const fixture = create(makeMe(10, []), payment);
    const text = fixture.nativeElement.textContent;

    expect(text).toContain('No tienes activos que puedas liquidar');
    expect(text).toContain('Declarar bancarrota');
    expect(text).not.toContain('Armar mi plan');
  });

  it('emits bankruptcyAction from the situation step', () => {
    const fixture = create(makeMe(10, []), payment);
    let requested = false;
    fixture.componentInstance.bankruptcyAction.subscribe(() => (requested = true));

    click(fixture, 'Declarar bancarrota');
    expect(requested).toBe(true);
  });
});
