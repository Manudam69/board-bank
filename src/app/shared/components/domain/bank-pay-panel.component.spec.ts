import { describe, it, expect, beforeEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { BankPayPanelComponent } from './bank-pay-panel.component';
import { MoneyFormatService } from '../../../core/services/money-format.service';
import { CLASSIC_SPAIN } from '../../../core/constants/editions';
import type { Player } from '../../../core/models';

function makePlayers(): Player[] {
  return [
    { id: 'u1', name: 'Ana', avatarColor: 'bg-red-500', cash: 1500, properties: [], bankrupt: false, host: true, joinedAt: 0 },
    { id: 'u2', name: 'Ben', avatarColor: 'bg-blue-500', cash: 1000, properties: [], bankrupt: false, host: false, joinedAt: 0 },
    { id: 'u3', name: 'Cora', avatarColor: 'bg-green-500', cash: 800, properties: [], bankrupt: true, host: false, joinedAt: 0 },
  ];
}

describe('BankPayPanelComponent', () => {
  let fixture: ReturnType<typeof TestBed.createComponent<BankPayPanelComponent>>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [MoneyFormatService],
    });

    fixture = TestBed.createComponent(BankPayPanelComponent);
    fixture.componentRef.setInput('players', makePlayers());
    fixture.componentRef.setInput('currency', CLASSIC_SPAIN.currency);
    fixture.componentRef.setInput('edition', CLASSIC_SPAIN);
    fixture.componentRef.setInput('me', makePlayers()[0]);
    fixture.componentRef.setInput('isHost', true);
    fixture.detectChanges();
  });

  function text(): string {
    return fixture.nativeElement.textContent;
  }

  function click(label: string): void {
    const target = (Array.from(fixture.nativeElement.querySelectorAll('button')) as HTMLElement[]).find((b) =>
      b.textContent?.includes(label),
    );
    expect(target, `button "${label}"`).toBeTruthy();
    target!.click();
    fixture.detectChanges();
  }

  function footerButton(label: string): HTMLButtonElement {
    const target = (Array.from(fixture.nativeElement.querySelectorAll('app-button button')) as HTMLButtonElement[]).find(
      (b) => b.textContent?.includes(label),
    );
    expect(target, `footer button "${label}"`).toBeTruthy();
    return target!;
  }

  function chips(): HTMLElement[] {
    return Array.from(fixture.nativeElement.querySelectorAll('[role="group"] button')) as HTMLElement[];
  }

  it('host starts by choosing a player and lists non-bankrupt players including the actor', () => {
    expect(text()).toContain('¿A quién le pagas?');
    expect(text()).toContain('Ana (tú)');
    expect(text()).toContain('Ben');
    expect(text()).not.toContain('Cora');
  });

  it('moves to the amount step as soon as a player is tapped', () => {
    click('Ben');
    expect(fixture.componentInstance['toId']()).toBe('u2');
    expect(text()).toContain('¿Cuánto recibe Ben?');
  });

  it('renders edition-derived amount chips', () => {
    click('Ben');
    const chipTexts = chips().map((c) => c.textContent?.trim());
    // CLASSIC_SPAIN chips: 200, 200, 100, 50 => unique 200, 100, 50
    expect(chipTexts.some((t) => t?.includes('200'))).toBe(true);
    expect(chipTexts.some((t) => t?.includes('100'))).toBe(true);
    expect(chipTexts.some((t) => t?.includes('50'))).toBe(true);
  });

  it('sets amount from a chip and toggles it off', () => {
    click('Ben');
    chips()[0].click();
    fixture.detectChanges();
    expect(fixture.componentInstance.amount()).toBeGreaterThan(0);

    chips()[0].click();
    fixture.detectChanges();
    expect(fixture.componentInstance.amount()).toBe(0);
  });

  it('disables review until a positive amount is chosen', () => {
    click('Ben');
    expect(footerButton('Revisar').disabled).toBe(true);

    chips()[0].click();
    fixture.detectChanges();
    expect(footerButton('Revisar').disabled).toBe(false);
  });

  it('shows a confirmation with the final balance and emits payAction when confirmed', () => {
    const emitted: { toId: string; amount: number; reason: string }[] = [];
    fixture.componentInstance.payAction.subscribe((e) => emitted.push(e));

    click('Ben');
    chips()[0].click();
    fixture.componentInstance.reason.set('Premio');
    fixture.detectChanges();
    click('Revisar');

    expect(text()).toContain('Confirma el pago');
    expect(text()).toContain('Saldo final de Ben');

    footerButton('Enviar dinero').click();

    expect(emitted).toHaveLength(1);
    expect(emitted[0].toId).toBe('u2');
    expect(emitted[0].amount).toBeGreaterThan(0);
    expect(emitted[0].reason).toBe('Premio');
    expect(text()).toContain('Confirma el pago');
  });

  it('lets the user go back to change the player', () => {
    click('Ben');
    click('Cambiar');
    expect(text()).toContain('¿A quién le pagas?');
  });

  it('for non-host skips the player step and pays only to self', async () => {
    const players = makePlayers();
    fixture.componentRef.setInput('me', players[1]);
    fixture.componentRef.setInput('isHost', false);
    fixture.detectChanges();
    await fixture.whenStable();

    expect(text()).toContain('¿Cuánto recibes del Banco?');
    expect(fixture.nativeElement.querySelectorAll('[role="list"] button').length).toBe(0);

    chips()[0].click();
    fixture.detectChanges();
    click('Revisar');
    expect(text()).toContain('Confirma el cobro');

    const emitted: { toId: string; amount: number; reason: string }[] = [];
    fixture.componentInstance.payAction.subscribe((e) => emitted.push(e));
    footerButton('Recibir dinero').click();

    expect(emitted).toHaveLength(1);
    expect(emitted[0].toId).toBe('u2');
    expect(emitted[0].amount).toBeGreaterThan(0);
  });
});
