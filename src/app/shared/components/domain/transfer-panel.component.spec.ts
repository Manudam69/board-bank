import { describe, it, expect, beforeEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { TransferPanelComponent } from './transfer-panel.component';
import { MoneyFormatService } from '../../../core/services/money-format.service';
import { CLASSIC_SPAIN } from '../../../core/constants/editions';
import type { Player, Room } from '../../../core/models';

function makeRoom(players: Player[]): Room {
  return {
    id: 'ROOM',
    editionId: CLASSIC_SPAIN.id,
    hostId: players[0]?.id ?? '',
    status: 'playing',
    players,
    log: [],
    trades: [],
    createdAt: 0,
    updatedAt: 0,
  };
}

const me: Player = {
  id: 'me',
  name: 'Yo',
  avatarColor: '#ff0000',
  cash: 250_000,
  bankrupt: false,
  host: true,
  joinedAt: 0,
  properties: [],
};

function makePlayer(id: string, name: string): Player {
  return {
    id,
    name,
    avatarColor: '#000000',
    cash: 100_000,
    bankrupt: false,
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

  function setup() {
    const fixture = TestBed.createComponent(TransferPanelComponent);
    fixture.componentRef.setInput('me', me);
    fixture.componentRef.setInput('players', [me, makePlayer('p1', 'Ana'), makePlayer('p2', 'Ben'), makePlayer('p3', 'Cora')]);
    fixture.componentRef.setInput('currency', CLASSIC_SPAIN.currency);
    fixture.componentRef.setInput('edition', CLASSIC_SPAIN);
    fixture.detectChanges();
    return fixture;
  }

  it('lists eligible players excluding self and bankrupt players', () => {
    const fixture = TestBed.createComponent(TransferPanelComponent);
    const bankrupt = makePlayer('p4', 'Luis');
    bankrupt.bankrupt = true;
    fixture.componentRef.setInput('me', me);
    fixture.componentRef.setInput('players', [me, makePlayer('p1', 'Ana'), makePlayer('p2', 'Ben'), bankrupt]);
    fixture.componentRef.setInput('currency', CLASSIC_SPAIN.currency);
    fixture.componentRef.setInput('edition', CLASSIC_SPAIN);
    fixture.detectChanges();

    const names = Array.from(fixture.nativeElement.querySelectorAll('[role="group"] button span.truncate')).map(
      (b) => (b as HTMLElement).textContent?.trim(),
    );
    expect(names).toContain('Ana');
    expect(names).toContain('Ben');
    expect(names).not.toContain('Luis');
  });

  it('toggles player selection and updates the selected count', () => {
    const fixture = setup();
    const buttons: HTMLButtonElement[] = Array.from(fixture.nativeElement.querySelectorAll('[role="group"] button'));
    const anaButton = buttons.find((b) => b.textContent?.includes('Ana'))!;
    const benButton = buttons.find((b) => b.textContent?.includes('Ben'))!;

    anaButton.click();
    benButton.click();
    fixture.detectChanges();

    expect(anaButton.getAttribute('aria-pressed')).toBe('true');
    expect(benButton.getAttribute('aria-pressed')).toBe('true');
    expect(fixture.nativeElement.textContent).toContain('2 jugadores seleccionados');
  });

  it('selects and deselects all players but never selects the bank', () => {
    const fixture = setup();
    const toggleAll: HTMLButtonElement = fixture.nativeElement.querySelector('button.text-accent')!;
    const buttons: HTMLButtonElement[] = Array.from(fixture.nativeElement.querySelectorAll('[role="group"] button'));
    const bankButton = buttons.find((b) => b.textContent?.includes('Banco'))!;

    toggleAll.click();
    fixture.detectChanges();

    expect(bankButton.getAttribute('aria-pressed')).toBe('false');
    expect(fixture.nativeElement.textContent).toContain('3 jugadores seleccionados');

    toggleAll.click();
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).not.toContain('jugadores seleccionados');
  });

  it('disables submit until amount and recipients are valid', () => {
    const fixture = setup();
    const component = fixture.componentInstance as any;

    expect(component.canSubmit()).toBe(false);

    component.amount.set(100_000);
    fixture.detectChanges();
    expect(component.canSubmit()).toBe(false);

    component.toggleRecipient('p1');
    fixture.detectChanges();
    expect(component.canSubmit()).toBe(true);
  });

  it('blocks submit when total exceeds available cash and shows the detailed error', () => {
    const fixture = setup();
    const component = fixture.componentInstance as any;
    component.toggleRecipient('p1');
    component.toggleRecipient('p2');
    component.toggleRecipient('p3');
    component.amount.set(100_000);
    fixture.detectChanges();

    expect(component.canSubmit()).toBe(false);
    expect(component.insufficient()).toBe(true);

    const errorText = fixture.nativeElement.textContent;
    expect(errorText).toContain('Dinero insuficiente');
    expect(errorText).toContain('Necesitas');
    expect(errorText).toContain('Tu saldo disponible es');
  });

  it('emits per-player amount and selected ids on submit', () => {
    const fixture = setup();
    const component = fixture.componentInstance as any;
    let emitted: unknown;
    component.transferAction.subscribe((action: unknown) => (emitted = action));

    component.toggleRecipient('p1');
    component.toggleRecipient('p2');
    component.amount.set(50_000);
    component.reason.set('Prueba');
    fixture.detectChanges();
    component.submit();

    expect(emitted).toEqual({ toIds: ['p1', 'p2'], amountPerPlayer: 50_000, reason: 'Prueba' });
  });

  it('shows the total transfer amount on the confirm button', () => {
    const fixture = setup();
    const component = fixture.componentInstance as any;
    component.toggleRecipient('p1');
    component.toggleRecipient('p2');
    component.amount.set(50_000);
    fixture.detectChanges();

    const button = fixture.nativeElement.querySelector('app-button');
    expect(button.textContent).toContain('Transferir');
    expect(button.textContent).toContain('100,000');
  });
});
