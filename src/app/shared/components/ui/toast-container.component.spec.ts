import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { ToastContainerComponent } from './toast-container.component';
import { ToastService } from '../../../core/services/toast.service';

interface PointerLikeInit {
  pointerType: string;
  clientX: number;
  clientY: number;
  button?: number;
  pointerId?: number;
  bubbles?: boolean;
}

function pointerEvent(type: string, init: PointerLikeInit): PointerEvent | MouseEvent {
  const bubbles = init.bubbles ?? true;
  const button = init.button ?? 0;
  const pointerId = init.pointerId ?? 1;

  if (typeof PointerEvent !== 'undefined') {
    return new PointerEvent(type, {
      bubbles,
      cancelable: true,
      button,
      pointerId,
      isPrimary: true,
      ...init,
    });
  }

  const event = new MouseEvent(type, {
    bubbles,
    cancelable: true,
    button,
    clientX: init.clientX,
    clientY: init.clientY,
  });

  (event as unknown as Record<string, unknown>)['pointerType'] = init.pointerType;
  (event as unknown as Record<string, unknown>)['pointerId'] = pointerId;
  (event as unknown as Record<string, unknown>)['isPrimary'] = true;
  return event;
}

function swipeOn(element: HTMLElement, steps: { fromX: number; fromY: number; toX: number; toY: number; pointerType?: string }): void {
  const { fromX, fromY, toX, toY, pointerType = 'touch' } = steps;
  element.dispatchEvent(pointerEvent('pointerdown', { pointerType, clientX: fromX, clientY: fromY }));
  element.dispatchEvent(pointerEvent('pointermove', { pointerType, clientX: toX, clientY: toY }));
  element.dispatchEvent(pointerEvent('pointerup', { pointerType, clientX: toX, clientY: toY }));
}

describe('ToastContainerComponent', () => {
  let fixture: ReturnType<typeof TestBed.createComponent<ToastContainerComponent>>;
  let service: ToastService;

  beforeEach(() => {
    vi.useFakeTimers();
    TestBed.configureTestingModule({ imports: [ToastContainerComponent] });
    fixture = TestBed.createComponent(ToastContainerComponent);
    service = TestBed.inject(ToastService);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  function toastCard(): HTMLElement | null {
    return fixture.nativeElement.querySelector('[role="status"]');
  }

  function detectChanges(): void {
    fixture.detectChanges();
  }

  it('renders a toast with message and detail', () => {
    service.info('Actualizado', 'Detalle del cambio');
    detectChanges();

    const card = toastCard();
    expect(card).not.toBeNull();
    expect(card!.textContent).toContain('Actualizado');
    expect(card!.textContent).toContain('Detalle del cambio');
  });

  it('closes the toast when the close button is clicked', () => {
    service.info('Cerrar');
    detectChanges();

    const closeButton = fixture.nativeElement.querySelector('button[aria-label="Cerrar notificación"]') as HTMLButtonElement;
    closeButton.click();
    detectChanges();

    expect(service.toasts().length).toBe(0);
    expect(toastCard()).toBeNull();
  });

  it('swipe-to-dismiss removes the toast after the exit animation', () => {
    service.info('Deslizar');
    detectChanges();

    const card = toastCard()!;
    swipeOn(card, { fromX: 100, fromY: 200, toX: 300, toY: 200 });

    vi.advanceTimersByTime(250);
    detectChanges();

    expect(service.toasts().length).toBe(0);
    expect(toastCard()).toBeNull();
  });

  it('short swipe returns to origin and keeps the toast', () => {
    service.info('Quedarse');
    detectChanges();

    const card = toastCard()!;
    swipeOn(card, { fromX: 100, fromY: 200, toX: 120, toY: 200 });

    vi.advanceTimersByTime(300);
    detectChanges();

    expect(service.toasts().length).toBe(1);
    expect(toastCard()).not.toBeNull();
    expect(card.style.transform).toBe('');
  });

  it('does not treat a drag starting on the close button as a swipe', () => {
    service.info('Botón seguro');
    detectChanges();

    const closeButton = fixture.nativeElement.querySelector('button[aria-label="Cerrar notificación"]') as HTMLButtonElement;
    swipeOn(closeButton, { fromX: 100, fromY: 200, toX: 300, toY: 200 });

    vi.advanceTimersByTime(300);
    detectChanges();

    expect(service.toasts().length).toBe(1);
  });

  it('does not activate swipe with a mouse pointer', () => {
    service.info('Mouse');
    detectChanges();

    const card = toastCard()!;
    swipeOn(card, { fromX: 100, fromY: 200, toX: 300, toY: 200, pointerType: 'mouse' });

    vi.advanceTimersByTime(300);
    detectChanges();

    expect(service.toasts().length).toBe(1);
  });

  it('still allows clicking the action button and then dismisses', () => {
    let actionRan = false;
    service.success('Acción', undefined, { label: 'Deshacer', run: () => (actionRan = true) });
    detectChanges();

    const actionButton = fixture.nativeElement.querySelector('button') as HTMLButtonElement;
    expect(actionButton.textContent).toContain('Deshacer');

    actionButton.click();
    detectChanges();

    expect(actionRan).toBe(true);
    expect(service.toasts().length).toBe(0);
  });

  it('handles multiple toasts independently', () => {
    service.info('A');
    service.info('B');
    detectChanges();

    const cards = fixture.nativeElement.querySelectorAll('[role="status"]');
    expect(cards.length).toBe(2);

    swipeOn(cards[0] as HTMLElement, { fromX: 100, fromY: 200, toX: 300, toY: 200 });

    vi.advanceTimersByTime(250);
    detectChanges();

    expect(service.toasts().length).toBe(1);
    expect(fixture.nativeElement.querySelectorAll('[role="status"]').length).toBe(1);
  });
});
