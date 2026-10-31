import { describe, it, expect, beforeEach } from 'vitest';
import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { SwipeTabsDirective, type TabSwipeDirection } from './swipe-tabs.directive';

@Component({
  imports: [SwipeTabsDirective],
  template: `
    <div
      id="area"
      [appSwipeTabs]="ids"
      [activeTab]="active()"
      (tabSwipe)="swipes.push($event)"
    ></div>
  `,
})
class HostComponent {
  ids = ['a', 'b', 'c'];
  active = signal('b');
  swipes: TabSwipeDirection[] = [];
}

function pointer(type: string, x: number, y: number, timeStamp = 0): Event {
  const event = new MouseEvent(type, { clientX: x, clientY: y, bubbles: true, cancelable: true });
  Object.defineProperties(event, {
    pointerId: { value: 1 },
    pointerType: { value: 'touch' },
    timeStamp: { value: timeStamp },
  });
  return event;
}

describe('SwipeTabsDirective', () => {
  let fixture: ReturnType<typeof TestBed.createComponent<HostComponent>>;
  let area: HTMLElement;

  beforeEach(() => {
    fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();
    area = fixture.nativeElement.querySelector('#area');
  });

  function swipe(fromX: number, toX: number, durationMs = 300): void {
    area.dispatchEvent(pointer('pointerdown', fromX, 300, 0));
    area.dispatchEvent(pointer('pointermove', (fromX + toX) / 2, 302, durationMs / 2));
    area.dispatchEvent(pointer('pointermove', toX, 304, durationMs));
    area.dispatchEvent(pointer('pointerup', toX, 304, durationMs));
  }

  it('emits "next" for a long swipe to the left', () => {
    swipe(300, 150);
    expect(fixture.componentInstance.swipes).toEqual(['next']);
  });

  it('emits "prev" for a long swipe to the right', () => {
    swipe(100, 260);
    expect(fixture.componentInstance.swipes).toEqual(['prev']);
  });

  it('ignores short, slow movements and springs back', () => {
    swipe(200, 170, 600);
    expect(fixture.componentInstance.swipes).toEqual([]);
    expect(area.style.translate).toBe('');
  });

  it('does not emit past the first or last tab', () => {
    fixture.componentInstance.active.set('a');
    fixture.detectChanges();
    swipe(100, 260);
    expect(fixture.componentInstance.swipes).toEqual([]);
  });

  it('ignores gestures that start at the screen edge', () => {
    swipe(8, 200);
    expect(fixture.componentInstance.swipes).toEqual([]);
  });

  it('ignores mostly vertical movement', () => {
    area.dispatchEvent(pointer('pointerdown', 200, 100, 0));
    area.dispatchEvent(pointer('pointermove', 240, 260, 100));
    area.dispatchEvent(pointer('pointerup', 240, 260, 120));
    expect(fixture.componentInstance.swipes).toEqual([]);
  });
});
