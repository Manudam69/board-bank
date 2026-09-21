import { describe, it, expect, beforeEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { RentPanelComponent } from './rent-panel.component';
import { RentService } from '../../../core/services/rent.service';
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
  cash: 200,
  bankrupt: false,
  host: true,
  joinedAt: 0,
  properties: [],
};

describe('RentPanelComponent', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [RentService, MoneyFormatService],
    });
  });

  it('lists receivers with un-mortgaged properties only', () => {
    const owner: Player = {
      id: 'owner',
      name: 'Ana',
      avatarColor: '#00ff00',
      cash: 1000,
      bankrupt: false,
      host: false,
      joinedAt: 0,
      properties: [{ propertyId: 'p1', houses: 0, hasHotel: false, mortgaged: false }],
    };
    const brokeOwner: Player = {
      id: 'broke',
      name: 'Luis',
      avatarColor: '#0000ff',
      cash: 0,
      bankrupt: false,
      host: false,
      joinedAt: 0,
      properties: [{ propertyId: 'p2', houses: 0, hasHotel: false, mortgaged: true }],
    };
    const fixture = TestBed.createComponent(RentPanelComponent);
    fixture.componentRef.setInput('room', makeRoom([me, owner, brokeOwner]));
    fixture.componentRef.setInput('me', me);
    fixture.componentRef.setInput('edition', CLASSIC_SPAIN);
    fixture.componentRef.setInput('currency', CLASSIC_SPAIN.currency);
    fixture.detectChanges();

    const receiverNames = Array.from(
      fixture.nativeElement.querySelectorAll('[role="radio"]'),
    ).map((b) => (b as HTMLElement).textContent?.trim());
    expect(receiverNames.some((n) => n?.includes('Ana'))).toBe(true);
    expect(receiverNames.some((n) => n?.includes('Luis'))).toBe(false);
  });

  it('auto-selects the only receiver', () => {
    const owner: Player = {
      id: 'owner',
      name: 'Ana',
      avatarColor: '#00ff00',
      cash: 1000,
      bankrupt: false,
      host: false,
      joinedAt: 0,
      properties: [
        { propertyId: 'p1', houses: 0, hasHotel: false, mortgaged: false },
        { propertyId: 'p2', houses: 0, hasHotel: false, mortgaged: false },
      ],
    };
    const fixture = TestBed.createComponent(RentPanelComponent);
    fixture.componentRef.setInput('room', makeRoom([me, owner]));
    fixture.componentRef.setInput('me', me);
    fixture.componentRef.setInput('edition', CLASSIC_SPAIN);
    fixture.componentRef.setInput('currency', CLASSIC_SPAIN.currency);
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Ana');
    const cobradorText = fixture.nativeElement.textContent;
    expect(cobradorText).toContain('Ana');
    expect(fixture.nativeElement.textContent).toContain('2 disponibles');
  });

  it('calculates and displays rent for selected property', async () => {
    const owner: Player = {
      id: 'owner',
      name: 'Ana',
      avatarColor: '#00ff00',
      cash: 1000,
      bankrupt: false,
      host: false,
      joinedAt: 0,
      properties: [{ propertyId: 'p1', houses: 0, hasHotel: false, mortgaged: false }],
    };
    const fixture = TestBed.createComponent(RentPanelComponent);
    fixture.componentRef.setInput('room', makeRoom([me, owner]));
    fixture.componentRef.setInput('me', me);
    fixture.componentRef.setInput('edition', CLASSIC_SPAIN);
    fixture.componentRef.setInput('currency', CLASSIC_SPAIN.currency);
    fixture.detectChanges();
    await fixture.whenStable();

    const propertyButtons = fixture.nativeElement.querySelectorAll('app-property-card button, button[aria-label]');
    const target = Array.from(propertyButtons).find((b) =>
      (b as HTMLElement).textContent?.includes('Ronda'),
    ) as HTMLElement | undefined;
    expect(target).toBeTruthy();
    target!.click();
    fixture.detectChanges();
    await fixture.whenStable();

    expect(fixture.nativeElement.textContent).toContain('Alquiler calculado');
    expect(fixture.nativeElement.textContent).toContain('€2');
  });

  it('requires dice input for utilities', async () => {
    const owner: Player = {
      id: 'owner',
      name: 'Ana',
      avatarColor: '#00ff00',
      cash: 1000,
      bankrupt: false,
      host: false,
      joinedAt: 0,
      properties: [{ propertyId: 'p27', houses: 0, hasHotel: false, mortgaged: false }],
    };
    const fixture = TestBed.createComponent(RentPanelComponent);
    fixture.componentRef.setInput('room', makeRoom([me, owner]));
    fixture.componentRef.setInput('me', me);
    fixture.componentRef.setInput('edition', CLASSIC_SPAIN);
    fixture.componentRef.setInput('currency', CLASSIC_SPAIN.currency);
    fixture.detectChanges();
    await fixture.whenStable();

    const propertyButtons = fixture.nativeElement.querySelectorAll('app-property-card button, button[aria-label]');
    const target = Array.from(propertyButtons).find((b) =>
      (b as HTMLElement).textContent?.includes('Electricidad'),
    ) as HTMLElement | undefined;
    target!.click();
    fixture.detectChanges();
    await fixture.whenStable();

    const diceInput = fixture.nativeElement.querySelector('input#dice') as HTMLInputElement;
    expect(diceInput).toBeTruthy();
    expect(diceInput.value).toBe('7');
  });

  it('emits rent action with toId, propertyId and amount', async () => {
    const owner: Player = {
      id: 'owner',
      name: 'Ana',
      avatarColor: '#00ff00',
      cash: 1000,
      bankrupt: false,
      host: false,
      joinedAt: 0,
      properties: [{ propertyId: 'p1', houses: 0, hasHotel: false, mortgaged: false }],
    };
    const fixture = TestBed.createComponent(RentPanelComponent);
    const emitted: Array<{ toId: string; propertyId: string; amount: number }> = [];
    fixture.componentInstance.rentAction.subscribe((e) => emitted.push(e));
    fixture.componentRef.setInput('room', makeRoom([me, owner]));
    fixture.componentRef.setInput('me', me);
    fixture.componentRef.setInput('edition', CLASSIC_SPAIN);
    fixture.componentRef.setInput('currency', CLASSIC_SPAIN.currency);
    fixture.detectChanges();
    await fixture.whenStable();

    const propertyButtons = fixture.nativeElement.querySelectorAll('app-property-card button, button[aria-label]');
    const target = Array.from(propertyButtons).find((b) =>
      (b as HTMLElement).textContent?.includes('Ronda'),
    ) as HTMLElement;
    target.click();
    fixture.detectChanges();
    await fixture.whenStable();

    const payButton = fixture.nativeElement.querySelector('app-button button') as HTMLButtonElement;
    expect(payButton).toBeTruthy();
    payButton.click();
    fixture.detectChanges();
    await fixture.whenStable();

    expect(emitted.length).toBe(1);
    expect(emitted[0]).toEqual({ toId: 'owner', propertyId: 'p1', amount: 2 });
  });

  it('disables submit when cash is insufficient', async () => {
    const owner: Player = {
      id: 'owner',
      name: 'Ana',
      avatarColor: '#00ff00',
      cash: 1000,
      bankrupt: false,
      host: false,
      joinedAt: 0,
      properties: [
        { propertyId: 'p22', houses: 0, hasHotel: false, mortgaged: false },
      ],
    };
    const poorMe: Player = { ...me, cash: 20 };
    const fixture = TestBed.createComponent(RentPanelComponent);
    fixture.componentRef.setInput('room', makeRoom([poorMe, owner]));
    fixture.componentRef.setInput('me', poorMe);
    fixture.componentRef.setInput('edition', CLASSIC_SPAIN);
    fixture.componentRef.setInput('currency', CLASSIC_SPAIN.currency);
    fixture.detectChanges();
    await fixture.whenStable();

    const propertyButtons = fixture.nativeElement.querySelectorAll('app-property-card button, button[aria-label]');
    const target = Array.from(propertyButtons).find((b) =>
      (b as HTMLElement).textContent?.includes('Barcelona'),
    ) as HTMLElement;
    target.click();
    fixture.detectChanges();
    await fixture.whenStable();

    const payButton = fixture.nativeElement.querySelector('app-button button') as HTMLButtonElement;
    expect(payButton.disabled).toBe(true);
  });
});
