import { describe, it, expect, beforeEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { TradeBuilderComponent, type TradeProposal } from './trade-builder.component';
import { CLASSIC_SPAIN } from '../../../core/constants/editions';
import type { Player } from '../../../core/models';

const p1 = CLASSIC_SPAIN.properties.find((p) => p.id === 'p1')!;
const p3 = CLASSIC_SPAIN.properties.find((p) => p.id === 'p3')!;
const railroad = CLASSIC_SPAIN.properties.find((p) => p.isRailroad)!;

const players: Player[] = [
  {
    id: 'u1',
    name: 'Ana',
    avatarColor: 'bg-red-500',
    cash: 500,
    properties: [
      { propertyId: p1.id, houses: 0, hasHotel: false, mortgaged: false },
      { propertyId: p3.id, houses: 2, hasHotel: false, mortgaged: false },
    ],
    bankrupt: false,
    host: true,
    joinedAt: 0,
  },
  {
    id: 'u2',
    name: 'Ben',
    avatarColor: 'bg-blue-500',
    cash: 500,
    properties: [{ propertyId: railroad.id, houses: 0, hasHotel: false, mortgaged: false }],
    bankrupt: false,
    host: false,
    joinedAt: 0,
  },
];

describe('TradeBuilderComponent', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [TradeBuilderComponent],
    });
  });

  function createFixture() {
    const fixture = TestBed.createComponent(TradeBuilderComponent);
    fixture.componentRef.setInput('edition', CLASSIC_SPAIN);
    fixture.componentRef.setInput('me', players[0]);
    fixture.componentRef.setInput('players', players);
    fixture.componentRef.setInput('currency', CLASSIC_SPAIN.currency);
    fixture.detectChanges();
    return fixture;
  }

  function buttons(fixture: ReturnType<typeof createFixture>): HTMLElement[] {
    return Array.from(fixture.nativeElement.querySelectorAll('button')) as HTMLElement[];
  }

  function clickByText(fixture: ReturnType<typeof createFixture>, text: string): void {
    const target = buttons(fixture).find((b) => b.textContent?.includes(text));
    expect(target, `button "${text}"`).toBeTruthy();
    target!.click();
    fixture.detectChanges();
  }

  it('starts by asking who to trade with, listing only the other players', () => {
    const fixture = createFixture();
    const text = fixture.nativeElement.textContent;
    expect(text).toContain('¿Con quién quieres intercambiar?');
    expect(text).toContain('Ben');
    expect(text).not.toContain('Ana');
    expect(text).not.toContain(p1.name);
  });

  it('advances to the "give" step as soon as a player is tapped', () => {
    const fixture = createFixture();
    clickByText(fixture, 'Ben');

    const text = fixture.nativeElement.textContent;
    expect(text).toContain('¿Qué le das tú?');
    expect(text).toContain(p1.name);
  });

  it('renders the group color bar for each of my properties', () => {
    const fixture = createFixture();
    clickByText(fixture, 'Ben');

    const bar = fixture.nativeElement.querySelector(
      'app-property-group-bar span[aria-hidden="true"]',
    ) as HTMLElement;
    expect(bar.classList.contains('h-6')).toBe(true);
    expect(bar.classList.contains('w-1.5')).toBe(true);
    expect(bar.style.backgroundColor).toBe('rgb(139, 69, 19)'); // p1 groupColor #8B4513
  });

  it('marks selected properties and explains why built-up ones are locked', () => {
    const fixture = createFixture();
    clickByText(fixture, 'Ben');

    const p1Button = buttons(fixture).find((b) => b.textContent?.includes(p1.name))!;
    const p3Button = buttons(fixture).find((b) => b.textContent?.includes(p3.name))!;

    expect(p1Button.getAttribute('aria-checked')).toBe('false');
    p1Button.click();
    fixture.detectChanges();
    expect(p1Button.getAttribute('aria-checked')).toBe('true');

    expect(p3Button.getAttribute('aria-disabled')).toBe('true');
    expect(p3Button.textContent).toContain('Tiene edificios');
    p3Button.click();
    fixture.detectChanges();
    expect(p3Button.getAttribute('aria-checked')).toBe('false');
  });

  it('shows the partner\'s properties on the "receive" step using their own group color', () => {
    const fixture = createFixture();
    clickByText(fixture, 'Ben');
    clickByText(fixture, 'Siguiente');

    expect(fixture.nativeElement.textContent).toContain('¿Qué quieres recibir?');
    const railroadButton = buttons(fixture).find((b) => b.textContent?.includes(railroad.name))!;
    const bar = railroadButton.querySelector('app-property-group-bar span[aria-hidden="true"]') as HTMLElement;
    expect(bar.style.backgroundColor).toBe('rgb(0, 0, 0)'); // railroad groupColor #000000
    expect(bar.classList.contains('ring-1')).toBe(true);
  });

  it('refuses to send an empty offer and says why', () => {
    const fixture = createFixture();
    clickByText(fixture, 'Ben');
    clickByText(fixture, 'Siguiente');
    clickByText(fixture, 'Revisar oferta');

    expect(fixture.nativeElement.textContent).toContain('Revisa tu oferta');
    expect(fixture.nativeElement.querySelector('[role="alert"]').textContent).toContain('vacía');
    const send = buttons(fixture).find((b) => b.textContent?.includes('Enviar oferta'))!;
    expect((send as HTMLButtonElement).disabled).toBe(true);
  });

  it('emits the proposal and stays on the review step so the sheet does not change while closing', () => {
    const fixture = createFixture();
    const proposals: TradeProposal[] = [];
    fixture.componentInstance.proposeAction.subscribe((p) => proposals.push(p));

    clickByText(fixture, 'Ben');
    clickByText(fixture, p1.name);
    clickByText(fixture, 'Siguiente');
    clickByText(fixture, railroad.name);
    clickByText(fixture, 'Revisar oferta');
    clickByText(fixture, 'Enviar oferta');

    expect(proposals).toEqual([
      { toId: 'u2', fromCash: 0, toCash: 0, fromProperties: [p1.id], toProperties: [railroad.id] },
    ]);
    expect(fixture.nativeElement.textContent).toContain('Revisa tu oferta');
  });

  it('lets the user go back to change a side from the review step', () => {
    const fixture = createFixture();
    clickByText(fixture, 'Ben');
    clickByText(fixture, 'Siguiente');
    clickByText(fixture, 'Revisar oferta');
    clickByText(fixture, 'Editar');

    expect(fixture.nativeElement.textContent).toContain('¿Qué le das tú?');
  });
});
