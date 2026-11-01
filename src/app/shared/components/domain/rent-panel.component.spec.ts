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

function makePlayer(id: string, name: string, propertyIds: string[], extra: Partial<Player> = {}): Player {
  return {
    id,
    name,
    avatarColor: 'bg-green-500',
    cash: 1000,
    bankrupt: false,
    host: false,
    joinedAt: 0,
    properties: propertyIds.map((propertyId) => ({
      propertyId,
      houses: 0,
      hasHotel: false,
      mortgaged: false,
    })),
    ...extra,
  };
}

const me = makePlayer('me', 'Yo', [], { cash: 200, host: true });

describe('RentPanelComponent', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [RentService, MoneyFormatService],
    });
  });

  function create(
    players: Player[],
    options: { me?: Player; initialToId?: string } = {},
  ) {
    const self = options.me ?? me;
    const fixture = TestBed.createComponent(RentPanelComponent);
    fixture.componentRef.setInput('room', makeRoom([self, ...players]));
    fixture.componentRef.setInput('me', self);
    fixture.componentRef.setInput('edition', CLASSIC_SPAIN);
    fixture.componentRef.setInput('currency', CLASSIC_SPAIN.currency);
    if (options.initialToId) fixture.componentRef.setInput('initialToId', options.initialToId);
    fixture.detectChanges();
    return fixture;
  }

  function text(fixture: ReturnType<typeof create>): string {
    return fixture.nativeElement.textContent;
  }

  function click(fixture: ReturnType<typeof create>, label: string): void {
    const target = (Array.from(fixture.nativeElement.querySelectorAll('button')) as HTMLElement[]).find(
      (b) => b.textContent?.includes(label),
    );
    expect(target, `button "${label}"`).toBeTruthy();
    target!.click();
    fixture.detectChanges();
  }

  it('asks for the receiver first and lists only owners with un-mortgaged properties', () => {
    const ana = makePlayer('owner', 'Ana', ['p1']);
    const luis = makePlayer('broke', 'Luis', [], {
      cash: 0,
      properties: [{ propertyId: 'p2', houses: 0, hasHotel: false, mortgaged: true }],
    });
    const fixture = create([ana, makePlayer('ben', 'Ben', ['p2']), luis]);

    expect(text(fixture)).toContain('¿A quién le pagas?');
    expect(text(fixture)).toContain('Ana');
    expect(text(fixture)).toContain('Ben');
    expect(text(fixture)).not.toContain('Luis');
  });

  it('skips the receiver step when there is only one owner', () => {
    const fixture = create([makePlayer('owner', 'Ana', ['p1', 'p2'])]);

    expect(text(fixture)).toContain('¿En qué propiedad caíste?');
    expect(text(fixture)).toContain('Ana');
  });

  it('moves to the property step as soon as a receiver is tapped', () => {
    const fixture = create([makePlayer('a', 'Ana', ['p1']), makePlayer('b', 'Ben', ['p2'])]);

    click(fixture, 'Ben');
    expect(text(fixture)).toContain('¿En qué propiedad caíste?');
    expect(text(fixture)).toContain('Ben');
  });

  it('shows the calculated rent on each property and moves to confirmation on tap', () => {
    const fixture = create([makePlayer('owner', 'Ana', ['p1'])]);

    expect(text(fixture)).toContain('Renta');
    expect(text(fixture)).toContain('€2');

    click(fixture, 'Ronda');
    expect(text(fixture)).toContain('Confirma el pago');
    expect(text(fixture)).toContain('Renta a pagar');
    expect(text(fixture)).toContain('€2');
    expect(text(fixture)).toContain('Te quedarás con');
  });

  it('requires dice input for utilities and starts at 7', () => {
    const fixture = create([makePlayer('owner', 'Ana', ['p27'])]);
    expect(text(fixture)).toContain('× dados');

    click(fixture, 'Electricidad');
    const dice = fixture.nativeElement.querySelector('input#dice') as HTMLInputElement;
    expect(dice).toBeTruthy();
    expect(dice.value).toBe('7');
  });

  it('changes the dice total with the plus and minus buttons', () => {
    const fixture = create([makePlayer('owner', 'Ana', ['p27'])]);
    click(fixture, 'Electricidad');

    (fixture.nativeElement.querySelector('button[aria-label="Sumar uno"]') as HTMLElement).click();
    fixture.detectChanges();
    expect((fixture.nativeElement.querySelector('input#dice') as HTMLInputElement).value).toBe('8');

    (fixture.nativeElement.querySelector('button[aria-label="Restar uno"]') as HTMLElement).click();
    (fixture.nativeElement.querySelector('button[aria-label="Restar uno"]') as HTMLElement).click();
    fixture.detectChanges();
    expect((fixture.nativeElement.querySelector('input#dice') as HTMLInputElement).value).toBe('6');
  });

  it('emits rent action with toId, propertyId and amount', () => {
    const fixture = create([makePlayer('owner', 'Ana', ['p1'])]);
    const emitted: Array<{ toId: string; propertyId: string; amount: number }> = [];
    fixture.componentInstance.rentAction.subscribe((e) => emitted.push(e));

    click(fixture, 'Ronda');
    click(fixture, 'Pagar €2');

    expect(emitted).toEqual([{ toId: 'owner', propertyId: 'p1', amount: 2 }]);
  });

  it('stays on the confirmation step after paying so the sheet does not change while closing', () => {
    const fixture = create([makePlayer('owner', 'Ana', ['p1'])]);
    click(fixture, 'Ronda');
    click(fixture, 'Pagar €2');

    expect(text(fixture)).toContain('Confirma el pago');
  });

  it('offers to raise cash when the payment exceeds the player\'s money', () => {
    const poorMe: Player = { ...me, cash: 20 };
    const fixture = create([makePlayer('owner', 'Ana', ['p22'])], { me: poorMe });

    click(fixture, 'Barcelona');
    const labels = (Array.from(fixture.nativeElement.querySelectorAll('app-button button')) as HTMLButtonElement[]).map(
      (b) => b.textContent?.trim(),
    );
    expect(labels.some((l) => l?.includes('Conseguir efectivo'))).toBe(true);
    expect(text(fixture)).toContain('Fondos insuficientes');
    const primary = (Array.from(fixture.nativeElement.querySelectorAll('app-button button')) as HTMLButtonElement[]).find(
      (b) => b.textContent?.includes('Conseguir efectivo'),
    )!;
    expect(primary.disabled).toBe(false);
  });

  it('lets the user go back to change the property or the receiver', () => {
    const fixture = create([makePlayer('a', 'Ana', ['p1']), makePlayer('b', 'Ben', ['p2'])]);
    click(fixture, 'Ana');
    click(fixture, 'Ronda');
    expect(text(fixture)).toContain('Confirma el pago');

    click(fixture, 'Atrás');
    expect(text(fixture)).toContain('¿En qué propiedad caíste?');
    click(fixture, 'Atrás');
    expect(text(fixture)).toContain('¿A quién le pagas?');
  });

  it('starts on the property step when initialToId is a valid receiver', () => {
    const fixture = create([makePlayer('owner-ana', 'Ana', ['p1']), makePlayer('owner-ben', 'Ben', ['p2'])], {
      initialToId: 'owner-ben',
    });

    expect(text(fixture)).toContain('¿En qué propiedad caíste?');
    expect(text(fixture)).toContain('Ben');
  });

  it('falls back to the receiver step when initialToId is not a valid receiver', () => {
    const broke = makePlayer('broke', 'Luis', [], {
      cash: 0,
      properties: [{ propertyId: 'p3', houses: 0, hasHotel: false, mortgaged: true }],
    });
    const fixture = create(
      [makePlayer('owner', 'Ana', ['p1']), makePlayer('owner-2', 'Ben', ['p2']), broke],
      { initialToId: 'broke' },
    );

    expect(text(fixture)).toContain('¿A quién le pagas?');
  });
});
