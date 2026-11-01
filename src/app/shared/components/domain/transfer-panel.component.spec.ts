import { describe, it, expect, beforeEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { TransferPanelComponent, type TransferAction } from './transfer-panel.component';
import { MoneyFormatService } from '../../../core/services/money-format.service';
import { CLASSIC_SPAIN } from '../../../core/constants/editions';
import type { Player } from '../../../core/models';

const me: Player = {
  id: 'me',
  name: 'Yo',
  avatarColor: 'bg-red-500',
  cash: 250_000,
  bankrupt: false,
  host: true,
  joinedAt: 0,
  properties: [],
};

function makePlayer(id: string, name: string, bankrupt = false): Player {
  return {
    id,
    name,
    avatarColor: 'bg-blue-500',
    cash: 100_000,
    bankrupt,
    host: false,
    joinedAt: 0,
    properties: [],
  };
}

describe('TransferPanelComponent', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [MoneyFormatService],
    });
  });

  function setup(players: Player[] = [me, makePlayer('p1', 'Ana'), makePlayer('p2', 'Ben'), makePlayer('p3', 'Cora')]) {
    const fixture = TestBed.createComponent(TransferPanelComponent);
    fixture.componentRef.setInput('me', me);
    fixture.componentRef.setInput('players', players);
    fixture.componentRef.setInput('currency', CLASSIC_SPAIN.currency);
    fixture.componentRef.setInput('edition', CLASSIC_SPAIN);
    fixture.detectChanges();
    return fixture;
  }

  type Fixture = ReturnType<typeof setup>;

  function buttons(fixture: Fixture): HTMLButtonElement[] {
    return Array.from(fixture.nativeElement.querySelectorAll('button')) as HTMLButtonElement[];
  }

  function click(fixture: Fixture, label: string): void {
    const target = buttons(fixture).find((b) => b.textContent?.includes(label));
    expect(target, `button "${label}"`).toBeTruthy();
    target!.click();
    fixture.detectChanges();
  }

  function footerButton(fixture: Fixture, label: string): HTMLButtonElement {
    const target = (Array.from(fixture.nativeElement.querySelectorAll('app-button button')) as HTMLButtonElement[]).find(
      (b) => b.textContent?.includes(label),
    );
    expect(target, `footer button "${label}"`).toBeTruthy();
    return target!;
  }

  function typeAmount(fixture: Fixture, value: string): void {
    const input = fixture.nativeElement.querySelector('app-amount-input input') as HTMLInputElement;
    input.value = value;
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();
  }

  it('starts by asking who receives the money and lists the bank plus eligible players', () => {
    const bankrupt = makePlayer('p4', 'Luis', true);
    const fixture = setup([me, makePlayer('p1', 'Ana'), makePlayer('p2', 'Ben'), bankrupt]);

    const text = fixture.nativeElement.textContent;
    expect(text).toContain('¿A quién le envías dinero?');
    expect(text).toContain('Banco');
    expect(text).toContain('Ana');
    expect(text).toContain('Ben');
    expect(text).not.toContain('Luis');
    expect(text).not.toContain('Yo');
  });

  it('toggles recipients and shows who is selected', () => {
    const fixture = setup();
    click(fixture, 'Ana');
    click(fixture, 'Ben');

    const checked = (Array.from(fixture.nativeElement.querySelectorAll('[role="checkbox"]')) as HTMLElement[])
      .filter((b) => b.getAttribute('aria-checked') === 'true')
      .map((b) => b.textContent);
    expect(checked.some((t) => t?.includes('Ana'))).toBe(true);
    expect(checked.some((t) => t?.includes('Ben'))).toBe(true);
    expect(fixture.nativeElement.textContent).toContain('Ana, Ben');
  });

  it('keeps the next button disabled until someone is selected', () => {
    const fixture = setup();
    expect(footerButton(fixture, 'Siguiente').disabled).toBe(true);

    click(fixture, 'Ana');
    expect(footerButton(fixture, 'Siguiente').disabled).toBe(false);
  });

  it('selects and deselects all players but never selects the bank', () => {
    const fixture = setup();
    click(fixture, 'Elegir a todos los jugadores');

    const states = new Map(
      (Array.from(fixture.nativeElement.querySelectorAll('[role="checkbox"]')) as HTMLElement[]).map((b) => [
        b.textContent?.trim() ?? '',
        b.getAttribute('aria-checked'),
      ]),
    );
    const bankState = [...states.entries()].find(([label]) => label.includes('Banco'))?.[1];
    expect(bankState).toBe('false');
    expect(fixture.nativeElement.textContent).toContain('Ana, Ben, Cora');

    click(fixture, 'Quitar a todos');
    expect(fixture.nativeElement.textContent).toContain('Elige al menos un destinatario');
  });

  it('asks for the amount next and explains per-player amounts when there are several recipients', () => {
    const fixture = setup();
    click(fixture, 'Ana');
    click(fixture, 'Ben');
    click(fixture, 'Siguiente');

    const text = fixture.nativeElement.textContent;
    expect(text).toContain('¿Cuánto le das a cada uno?');
    expect(text).toContain('Monto por jugador');
  });

  it('blocks review until an amount is typed and flags when the total exceeds the cash', () => {
    const fixture = setup();
    click(fixture, 'Ana');
    click(fixture, 'Ben');
    click(fixture, 'Cora');
    click(fixture, 'Siguiente');
    expect(footerButton(fixture, 'Revisar').disabled).toBe(true);

    typeAmount(fixture, '100000');
    expect(footerButton(fixture, 'Revisar').disabled).toBe(true);
    expect(fixture.nativeElement.textContent).toContain('No te alcanza');
  });

  it('shows the total on the confirmation step and emits per-player amount and ids', () => {
    const fixture = setup();
    const emitted: TransferAction[] = [];
    fixture.componentInstance.transferAction.subscribe((a) => emitted.push(a));

    click(fixture, 'Ana');
    click(fixture, 'Ben');
    click(fixture, 'Siguiente');
    typeAmount(fixture, '50000');
    fixture.componentInstance.reason.set('Prueba');
    click(fixture, 'Revisar');

    expect(fixture.nativeElement.textContent).toContain('Confirma la transferencia');
    expect(footerButton(fixture, 'Transferir').textContent).toContain('100,000');

    footerButton(fixture, 'Transferir').click();
    expect(emitted).toEqual([{ toIds: ['p1', 'p2'], amountPerPlayer: 50_000, reason: 'Prueba' }]);
    expect(fixture.nativeElement.textContent).toContain('Confirma la transferencia');
  });

  it('lets the user go back to change the recipients', () => {
    const fixture = setup();
    click(fixture, 'Ana');
    click(fixture, 'Siguiente');
    click(fixture, 'Cambiar');

    expect(fixture.nativeElement.textContent).toContain('¿A quién le envías dinero?');
  });
});
