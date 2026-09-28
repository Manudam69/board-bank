import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { TradeListComponent } from './trade-list.component';
import { CLASSIC_SPAIN } from '../../../core/constants/editions';
import type { Player, TradeOffer } from '../../../core/models';

const p1 = CLASSIC_SPAIN.properties.find((p) => p.id === 'p1')!;
const p2 = CLASSIC_SPAIN.properties.find((p) => p.id === 'p2')!;

const players: Player[] = [
  { id: 'u1', name: 'Ana', avatarColor: 'bg-red-500', cash: 500, properties: [], bankrupt: false, host: true, joinedAt: 0 },
  { id: 'u2', name: 'Ben', avatarColor: 'bg-blue-500', cash: 500, properties: [], bankrupt: false, host: false, joinedAt: 0 },
];

function makeOffer(status: TradeOffer['status'] = 'pending'): TradeOffer {
  return {
    id: 'OFFER',
    status,
    fromPlayerId: 'u1',
    toPlayerId: 'u2',
    fromItems: { cash: 0, propertyIds: [p1.id] },
    toItems: { cash: 25, propertyIds: [p2.id] },
    createdAt: 1_000_000,
    resolvedAt: status === 'pending' ? undefined : 2_000_000,
  };
}

describe('TradeListComponent', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [TradeListComponent],
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  function createFixture(currentPlayerId: string, offers: TradeOffer[] = [makeOffer()]) {
    const fixture = TestBed.createComponent(TradeListComponent);
    fixture.componentRef.setInput('roomId', 'ROOM');
    fixture.componentRef.setInput('trades', offers);
    fixture.componentRef.setInput('players', players);
    fixture.componentRef.setInput('currency', CLASSIC_SPAIN.currency);
    fixture.componentRef.setInput('edition', CLASSIC_SPAIN);
    fixture.componentRef.setInput('currentPlayerId', currentPlayerId);
    fixture.detectChanges();
    return fixture;
  }

  it('shows Cancel button only for pending offers sent by the current player', () => {
    const fixture = createFixture('u1');
    const buttons = fixture.nativeElement.querySelectorAll('app-button button');
    const labels = Array.from(buttons).map((b) => (b as HTMLElement).textContent?.trim());

    expect(labels).toContain('Cancelar');
    expect(labels).not.toContain('Aceptar');
    expect(labels).not.toContain('Rechazar');
  });

  it('shows Accept/Reject buttons for pending offers received by the current player', () => {
    const fixture = createFixture('u2');
    const buttons = fixture.nativeElement.querySelectorAll('app-button button');
    const labels = Array.from(buttons).map((b) => (b as HTMLElement).textContent?.trim());

    expect(labels).toContain('Aceptar');
    expect(labels).toContain('Rechazar');
    expect(labels).not.toContain('Cancelar');
  });

  it('renders resolved trades in the history section with correct status badges', () => {
    const fixture = createFixture('u1', [
      { ...makeOffer('accepted'), id: 'A' },
      { ...makeOffer('rejected'), id: 'R' },
      { ...makeOffer('cancelled'), id: 'C' },
    ]);

    const text = fixture.nativeElement.textContent;
    expect(text).toContain('Histórico');
    expect(text).toContain('Aceptado');
    expect(text).toContain('Rechazado');
    expect(text).toContain('Cancelado');

    const historyButtons = fixture.nativeElement.querySelectorAll('h3 ~ div app-button button');
    expect(historyButtons.length).toBe(0);
  });

  it('updates the list when a pending offer is cancelled', () => {
    const fixture = createFixture('u1', [makeOffer('pending')]);

    expect(fixture.nativeElement.textContent).toContain('Cancelar');

    fixture.componentRef.setInput('trades', [{ ...makeOffer('pending'), status: 'cancelled', resolvedAt: 2_000_000 }]);
    fixture.detectChanges();

    const text = fixture.nativeElement.textContent;
    expect(text).toContain('Cancelado');
    expect(text).not.toContain('Cancelar');
    expect(text).toContain('Histórico');
  });

  it('emits cancelAction when the sender clicks Cancel', () => {
    const fixture = createFixture('u1');
    const emitted: string[] = [];
    fixture.componentInstance.cancelAction.subscribe((id) => emitted.push(id));

    const cancelButton = Array.from(fixture.nativeElement.querySelectorAll('app-button button')).find(
      (b) => (b as HTMLElement).textContent?.trim() === 'Cancelar',
    ) as HTMLElement;

    expect(cancelButton).toBeTruthy();
    cancelButton.click();

    expect(emitted).toEqual(['OFFER']);
  });
});
