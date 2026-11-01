import { describe, it, expect, beforeEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { BuyPropertyPanelComponent } from './buy-property-panel.component';
import { MoneyFormatService } from '../../../core/services/money-format.service';
import { CLASSIC_SPAIN } from '../../../core/constants/editions';
import type { Player } from '../../../core/models';

const p1 = CLASSIC_SPAIN.properties.find((p) => p.id === 'p1')!;
const p3 = CLASSIC_SPAIN.properties.find((p) => p.id === 'p3')!;
const expensive = CLASSIC_SPAIN.properties.reduce((a, b) => (a.price >= b.price ? a : b));

function makePlayer(cash: number, propertyIds: string[] = []): Player {
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

describe('BuyPropertyPanelComponent', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [MoneyFormatService] });
  });

  function create(me: Player, others: Player[] = []) {
    const fixture = TestBed.createComponent(BuyPropertyPanelComponent);
    fixture.componentRef.setInput('edition', CLASSIC_SPAIN);
    fixture.componentRef.setInput('me', me);
    fixture.componentRef.setInput('players', [me, ...others]);
    fixture.componentRef.setInput('currency', CLASSIC_SPAIN.currency);
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

  it('lists only properties without an owner', () => {
    const fixture = create(makePlayer(1500, [p1.id]));
    const text = fixture.nativeElement.textContent;
    expect(text).toContain('¿Qué propiedad compraste?');
    expect(text).not.toContain(p1.name);
    expect(text).toContain(p3.name);
  });

  it('filters by group with the chips', () => {
    const fixture = create(makePlayer(1500));
    click(fixture, p3.group);

    const text = fixture.nativeElement.textContent;
    expect(text).toContain(p3.name);
    expect(text).not.toContain(expensive.name === p3.name ? '' : expensive.name);
  });

  it('moves to a confirmation with price and remaining cash when a property is tapped', () => {
    const fixture = create(makePlayer(1500));
    click(fixture, p1.name);

    const text = fixture.nativeElement.textContent;
    expect(text).toContain('Confirma la compra');
    expect(text).toContain('Te quedarás con');
    expect(text).toContain(`Comprar €${p1.price}`);
  });

  it('emits the property id when the purchase is confirmed and stays on the confirmation', () => {
    const fixture = create(makePlayer(1500));
    const emitted: { propertyId: string }[] = [];
    fixture.componentInstance.buyAction.subscribe((e) => emitted.push(e));

    click(fixture, p1.name);
    click(fixture, 'Comprar €');

    expect(emitted).toEqual([{ propertyId: p1.id }]);
    expect(fixture.nativeElement.textContent).toContain('Confirma la compra');
  });

  it('offers to raise cash when the player cannot afford the property', () => {
    const fixture = create(makePlayer(10));
    click(fixture, expensive.name);

    const text = fixture.nativeElement.textContent;
    expect(text).toContain('No te alcanza');
    const labels = (Array.from(fixture.nativeElement.querySelectorAll('app-button button')) as HTMLElement[]).map(
      (b) => b.textContent?.trim(),
    );
    expect(labels.some((l) => l?.includes('Conseguir efectivo y comprar'))).toBe(true);
  });

  it('lets the user go back to pick another property', () => {
    const fixture = create(makePlayer(1500));
    click(fixture, p1.name);
    click(fixture, 'Cambiar');

    expect(fixture.nativeElement.textContent).toContain('¿Qué propiedad compraste?');
  });
});
