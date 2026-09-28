import { Directive, ElementRef, inject, input, OnDestroy } from '@angular/core';
import { DOCUMENT } from '@angular/common';
import { ToastService } from '../../../core/services/toast.service';

const SLOP_PX = 8;
const DISMISS_RATIO = 0.35;
const DISMISS_MIN_PX = 80;
const DISMISS_MAX_PX = 120;
const VELOCITY_THRESHOLD_PX_PER_MS = 0.5;
const VELOCITY_MIN_DX_PX = 24;
const DRAG_OPACITY_REDUCTION = 0.25;
const DRAG_SCALE_REDUCTION = 0.05;
const EXIT_DURATION_MS = 200;
const SETTLE_DURATION_MS = 250;
const CLICK_SUPPRESS_MS = 200;
const MOVE_SAMPLE_COUNT = 3;

function isInteractiveTarget(target: EventTarget | null): boolean {
  if (!target) return false;
  const el = target instanceof Element ? target : (target instanceof Node ? target.parentElement : null);
  return !!el?.closest('button, a, [role="button"], input, textarea, select, [contenteditable="true"]');
}

@Directive({
  selector: '[appToastSwipe]',
  host: {
    '(pointerdown)': 'onPointerDown($event)',
  },
})
export class ToastSwipeDirective implements OnDestroy {
  readonly toastId = input.required<string>({ alias: 'appToastSwipe' });

  private readonly el = inject(ElementRef<HTMLElement>);
  private readonly service = inject(ToastService);
  private readonly document = inject(DOCUMENT);

  private readonly host = this.el.nativeElement;

  private activePointerId: number | null = null;
  private startX = 0;
  private startY = 0;
  private currentX = 0;
  private dragging = false;
  private dismissing = false;
  private moveSamples: { x: number; t: number }[] = [];

  private removeMoveListener?: () => void;
  private removeUpListener?: () => void;
  private removeCancelListener?: () => void;
  private removeResizeListener?: () => void;
  private removeOrientationListener?: () => void;
  private pendingClickSuppress?: () => void;
  private exitTimeout?: ReturnType<typeof setTimeout>;
  private settleTimeout?: ReturnType<typeof setTimeout>;
  private clickSuppressTimeout?: ReturnType<typeof setTimeout>;

  ngOnDestroy(): void {
    this.cleanup();
  }

  onPointerDown(event: PointerEvent): void {
    if (this.dismissing) return;
    if (this.activePointerId !== null) return;
    if (event.pointerType !== 'touch') return;
    if (event.button !== 0) return;
    if (isInteractiveTarget(event.target)) return;

    this.cancelSettle();

    this.activePointerId = event.pointerId;
    this.startX = event.clientX;
    this.startY = event.clientY;
    this.currentX = this.startX;
    this.dragging = false;
    this.moveSamples = [{ x: this.startX, t: Date.now() }];

    this.attachDragListeners();
  }

  private onPointerMove(event: PointerEvent): void {
    if (event.pointerId !== this.activePointerId) return;

    const dx = event.clientX - this.startX;
    const dy = event.clientY - this.startY;

    if (!this.dragging) {
      if (Math.abs(dx) <= SLOP_PX) return;
      if (Math.abs(dy) >= Math.abs(dx)) return;

      this.dragging = true;
      this.host.classList.add('toast-dragging');
      this.host.classList.remove('animate-toast-in');
      this.host.style.willChange = 'transform, opacity';
      this.host.style.userSelect = 'none';
      this.host.style.webkitUserSelect = 'none';
      this.host.style.webkitTouchCallout = 'none';
      this.service.pause(this.toastId());
    }

    event.preventDefault();
    this.currentX = event.clientX;
    this.addMoveSample(event.clientX);
    this.updateVisuals(dx);
  }

  private onPointerUp(event: PointerEvent): void {
    if (event.pointerId !== this.activePointerId) return;

    this.detachDragListeners();

    if (!this.dragging) {
      this.activePointerId = null;
      return;
    }

    this.suppressNextClick();

    const dx = this.currentX - this.startX;
    const threshold = this.dismissThreshold();
    const velocity = this.computeVelocity();

    if (Math.abs(dx) >= threshold || (Math.abs(velocity) >= VELOCITY_THRESHOLD_PX_PER_MS && Math.abs(dx) >= VELOCITY_MIN_DX_PX)) {
      this.dismiss(dx);
    } else {
      this.settle();
    }
  }

  private onPointerCancel(event: PointerEvent): void {
    if (event.pointerId !== this.activePointerId) return;
    this.cancelDrag();
  }

  private attachDragListeners(): void {
    const move = (e: PointerEvent) => this.onPointerMove(e);
    const up = (e: PointerEvent) => this.onPointerUp(e);
    const cancel = (e: PointerEvent) => this.onPointerCancel(e);
    const resize = () => this.cancelDrag();
    const orientation = () => this.cancelDrag();

    this.document.addEventListener('pointermove', move);
    this.document.addEventListener('pointerup', up);
    this.document.addEventListener('pointercancel', cancel);
    this.removeMoveListener = () => this.document.removeEventListener('pointermove', move);
    this.removeUpListener = () => this.document.removeEventListener('pointerup', up);
    this.removeCancelListener = () => this.document.removeEventListener('pointercancel', cancel);

    const win = this.document.defaultView;
    if (win) {
      win.addEventListener('resize', resize);
      win.addEventListener('orientationchange', orientation);
      this.removeResizeListener = () => win.removeEventListener('resize', resize);
      this.removeOrientationListener = () => win.removeEventListener('orientationchange', orientation);
    }
  }

  private detachDragListeners(): void {
    this.removeMoveListener?.();
    this.removeUpListener?.();
    this.removeCancelListener?.();
    this.removeResizeListener?.();
    this.removeOrientationListener?.();
    this.removeMoveListener = undefined;
    this.removeUpListener = undefined;
    this.removeCancelListener = undefined;
    this.removeResizeListener = undefined;
    this.removeOrientationListener = undefined;
  }

  private addMoveSample(x: number): void {
    this.moveSamples.push({ x, t: Date.now() });
    if (this.moveSamples.length > MOVE_SAMPLE_COUNT) {
      this.moveSamples.shift();
    }
  }

  private computeVelocity(): number {
    if (this.moveSamples.length < 2) return 0;
    const first = this.moveSamples[0];
    const last = this.moveSamples[this.moveSamples.length - 1];
    const dt = last.t - first.t;
    return dt > 0 ? (last.x - first.x) / dt : 0;
  }

  private dismissThreshold(): number {
    const width = this.host.offsetWidth || 320;
    return Math.max(DISMISS_MIN_PX, Math.min(width * DISMISS_RATIO, DISMISS_MAX_PX));
  }

  private updateVisuals(dx: number): void {
    const progress = Math.min(1, Math.abs(dx) / this.dismissThreshold());
    const opacity = 1 - progress * DRAG_OPACITY_REDUCTION;
    const scale = 1 - progress * DRAG_SCALE_REDUCTION;
    this.host.style.transition = 'none';
    this.host.style.transform = `translateX(${dx}px) scale(${scale})`;
    this.host.style.opacity = String(opacity);
  }

  private dismiss(dx: number): void {
    this.dismissing = true;

    if (this.prefersReducedMotion()) {
      this.service.dismiss(this.toastId());
      return;
    }

    const sign = Math.sign(dx) || 1;
    const target = sign * (this.host.offsetWidth + 64);

    this.host.style.transition = `transform ${EXIT_DURATION_MS}ms ease-out, opacity ${EXIT_DURATION_MS}ms ease-out`;
    this.host.style.transform = `translateX(${target}px) scale(0.95)`;
    this.host.style.opacity = '0';

    this.exitTimeout = setTimeout(() => {
      this.service.dismiss(this.toastId());
    }, EXIT_DURATION_MS + 30);
  }

  private settle(): void {
    if (this.prefersReducedMotion()) {
      this.resetStyles();
      this.service.resume(this.toastId());
      this.finalizeGesture();
      return;
    }

    this.host.style.transition = `transform ${SETTLE_DURATION_MS}ms cubic-bezier(0.16, 1, 0.3, 1), opacity ${SETTLE_DURATION_MS}ms ease-out`;
    this.host.style.transform = 'translateX(0) scale(1)';
    this.host.style.opacity = '1';

    this.settleTimeout = setTimeout(() => {
      this.resetStyles();
      this.service.resume(this.toastId());
      this.finalizeGesture();
    }, SETTLE_DURATION_MS + 30);
  }

  private cancelDrag(): void {
    this.detachDragListeners();
    if (this.dragging) {
      this.settle();
    } else {
      this.activePointerId = null;
    }
  }

  private cancelSettle(): void {
    if (this.settleTimeout) {
      clearTimeout(this.settleTimeout);
      this.settleTimeout = undefined;
    }
    this.resetStyles();
    this.finalizeGesture();
  }

  private finalizeGesture(): void {
    this.host.classList.remove('toast-dragging');
    this.activePointerId = null;
    this.dragging = false;
    this.moveSamples = [];
  }

  private resetStyles(): void {
    this.host.style.transform = '';
    this.host.style.opacity = '';
    this.host.style.transition = '';
    this.host.style.willChange = '';
    this.host.style.userSelect = '';
    this.host.style.webkitUserSelect = '';
    this.host.style.webkitTouchCallout = '';
  }

  private suppressNextClick(): void {
    this.clearClickSuppress();

    const handler = (e: Event) => {
      e.preventDefault();
      e.stopImmediatePropagation();
      this.clearClickSuppress();
    };

    this.host.addEventListener('click', handler, true);
    this.pendingClickSuppress = () => this.host.removeEventListener('click', handler, true);

    this.clickSuppressTimeout = setTimeout(() => this.clearClickSuppress(), CLICK_SUPPRESS_MS);
  }

  private clearClickSuppress(): void {
    if (this.clickSuppressTimeout) {
      clearTimeout(this.clickSuppressTimeout);
      this.clickSuppressTimeout = undefined;
    }
    this.pendingClickSuppress?.();
    this.pendingClickSuppress = undefined;
  }

  private prefersReducedMotion(): boolean {
    const win = this.document.defaultView;
    if (!win || typeof win.matchMedia !== 'function') return false;
    return win.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  private cleanup(): void {
    this.detachDragListeners();
    this.clearClickSuppress();
    if (this.exitTimeout) {
      clearTimeout(this.exitTimeout);
      this.exitTimeout = undefined;
    }
    if (this.settleTimeout) {
      clearTimeout(this.settleTimeout);
      this.settleTimeout = undefined;
    }
  }
}
