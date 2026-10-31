import { Directive, ElementRef, inject, input, output } from '@angular/core';

export type TabSwipeDirection = 'next' | 'prev';

const LOCK_PX = 10;
const HORIZONTAL_BIAS = 1.4;
const EDGE_GUTTER_PX = 24;
const COMMIT_DISTANCE_PX = 70;
const COMMIT_VELOCITY_PX_PER_MS = 0.5;
const COMMIT_VELOCITY_MIN_PX = 30;
const EDGE_RESISTANCE = 0.25;
const FOLLOW_RATIO = 0.55;
const SETTLE_MS = 220;
const CLICK_SUPPRESS_MS = 250;

/**
 * Horizontal swipe between ordered tabs. The host follows the finger, springs back when the
 * swipe is too short, and emits the direction when it commits. Touch and pen only.
 */
@Directive({
  selector: '[appSwipeTabs]',
  host: {
    '(pointerdown)': 'onPointerDown($event)',
    '(pointermove)': 'onPointerMove($event)',
    '(pointerup)': 'onPointerEnd($event, false)',
    '(pointercancel)': 'onPointerEnd($event, true)',
    style: 'touch-action: pan-y',
  },
})
export class SwipeTabsDirective {
  readonly tabIds = input.required<string[]>({ alias: 'appSwipeTabs' });
  readonly activeTab = input.required<string>();
  readonly tabSwipe = output<TabSwipeDirection>();

  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;

  private pointerId: number | null = null;
  private startX = 0;
  private startY = 0;
  private locked = false;
  private samples: { x: number; t: number }[] = [];

  protected onPointerDown(event: PointerEvent): void {
    if (event.pointerType === 'mouse' || this.pointerId !== null) return;
    if (event.clientX < EDGE_GUTTER_PX || event.clientX > window.innerWidth - EDGE_GUTTER_PX) return;
    const target = event.target instanceof Element ? event.target : null;
    if (target?.closest('input, textarea, select, [contenteditable="true"], [data-no-swipe]')) return;

    this.pointerId = event.pointerId;
    this.startX = event.clientX;
    this.startY = event.clientY;
    this.locked = false;
    this.samples = [{ x: event.clientX, t: event.timeStamp }];
    this.host.style.transition = 'none';
  }

  protected onPointerMove(event: PointerEvent): void {
    if (event.pointerId !== this.pointerId) return;
    const dx = event.clientX - this.startX;
    const dy = event.clientY - this.startY;

    if (!this.locked) {
      if (Math.abs(dx) < LOCK_PX) return;
      if (Math.abs(dx) < Math.abs(dy) * HORIZONTAL_BIAS) return;
      this.locked = true;
      try {
        this.host.setPointerCapture(event.pointerId);
      } catch {
        // Capture is only an optimisation; the gesture still works without it.
      }
    }

    this.samples.push({ x: event.clientX, t: event.timeStamp });
    if (this.samples.length > 4) this.samples.shift();

    const hasTarget = this.targetFor(dx < 0 ? 'next' : 'prev') !== null;
    const follow = hasTarget ? FOLLOW_RATIO : EDGE_RESISTANCE;
    this.host.style.translate = `${dx * follow}px 0`;
  }

  protected onPointerEnd(event: PointerEvent, cancelled: boolean): void {
    if (event.pointerId !== this.pointerId) return;
    this.pointerId = null;
    if (!this.locked) {
      this.resetPosition(false);
      return;
    }

    const dx = event.clientX - this.startX;
    const first = this.samples[0];
    const last = this.samples[this.samples.length - 1];
    const elapsed = last.t - first.t;
    const velocity = elapsed > 0 ? (last.x - first.x) / elapsed : 0;
    const direction: TabSwipeDirection = dx < 0 ? 'next' : 'prev';

    const committed =
      !cancelled &&
      this.targetFor(direction) !== null &&
      (Math.abs(dx) > COMMIT_DISTANCE_PX ||
        (Math.abs(velocity) > COMMIT_VELOCITY_PX_PER_MS && Math.abs(dx) > COMMIT_VELOCITY_MIN_PX));

    this.suppressNextClick();
    if (committed) {
      this.resetPosition(false);
      this.tabSwipe.emit(direction);
    } else {
      this.resetPosition(true);
    }
  }

  private targetFor(direction: TabSwipeDirection): string | null {
    const ids = this.tabIds();
    const index = ids.indexOf(this.activeTab());
    if (index === -1) return null;
    return ids[direction === 'next' ? index + 1 : index - 1] ?? null;
  }

  private resetPosition(animated: boolean): void {
    this.host.style.transition = animated
      ? `translate ${SETTLE_MS}ms cubic-bezier(0.16, 1, 0.3, 1)`
      : 'none';
    this.host.style.translate = '';
  }

  /** A drag that ends over a row must not also count as a tap on it. */
  private suppressNextClick(): void {
    const block = (e: Event) => {
      e.stopPropagation();
      e.preventDefault();
    };
    this.host.addEventListener('click', block, { capture: true, once: true });
    setTimeout(() => this.host.removeEventListener('click', block, { capture: true }), CLICK_SUPPRESS_MS);
  }
}
