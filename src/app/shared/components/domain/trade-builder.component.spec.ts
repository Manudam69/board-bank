import { describe, it, expect, beforeEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { TradeBuilderComponent } from './trade-builder.component';
import { CLASSIC_SPAIN } from '../../../core/constants/editions';
import type { Player, PlayerProperty } from '../../../core/models';

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

  it('renders a visible color bar with the correct groupColor for every property option', () => {
    const fixture = createFixture();
    const bars = fixture.nativeElement.querySelectorAll('app-property-group-bar span[aria-hidden="true"]');
    expect(bars.length).toBeGreaterThanOrEqual(2);

    const firstBar = bars[0] as HTMLElement;
    expect(firstBar.classList.contains('h-6')).toBe(true);
    expect(firstBar.classList.contains('w-1.5')).toBe(true);
    expect(firstBar.style.backgroundColor).toBe('rgb(139, 69, 19)'); // p1 groupColor #8B4513
  });

  it('renders a color bar for the railroad using its own groupColor', () => {
    const fixture = createFixture();
    const benChip = Array.from(fixture.nativeElement.querySelectorAll('[role="radio"]')).find((b) =>
      (b as HTMLElement).textContent?.includes('Ben'),
    ) as HTMLElement;
    expect(benChip).toBeTruthy();
    benChip.click();
    fixture.detectChanges();

    const receiverButtons = Array.from(
      fixture.nativeElement.querySelectorAll('button'),
    ).filter((b) => (b as HTMLElement).textContent?.includes(railroad.name)) as HTMLElement[];

    expect(receiverButtons.length).toBe(1);
    const bar = receiverButtons[0].querySelector('app-property-group-bar span[aria-hidden="true"]') as HTMLElement;
    expect(bar).toBeTruthy();
    expect(bar.classList.contains('h-6')).toBe(true);
    expect(bar.classList.contains('w-1.5')).toBe(true);
    expect(bar.style.backgroundColor).toBe('rgb(0, 0, 0)'); // railroad groupColor #000000
    expect(bar.classList.contains('ring-1')).toBe(true);
  });

  it('shows a checkmark on selected properties and a lock on disabled ones', () => {
    const fixture = createFixture();
    const buttons = Array.from(fixture.nativeElement.querySelectorAll('button')) as HTMLElement[];

    const p1Button = buttons.find((b) => (b as HTMLElement).textContent?.includes(p1.name))!;
    const p3Button = buttons.find((b) => (b as HTMLElement).textContent?.includes(p3.name))!;

    p1Button.click();
    fixture.detectChanges();

    const p1Check = p1Button.querySelector('svg path[d="M5 13l4 4L19 7"]');
    expect(p1Check).toBeTruthy();

    const p3Lock = p3Button.querySelector('svg path[d*="M12 15v2"]') ??
      p3Button.querySelector('svg path[d*="v4h8z"]');
    expect(p3Lock).toBeTruthy();
  });
});
