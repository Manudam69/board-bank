import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { Component, signal } from '@angular/core';
import { ModalComponent } from './modal.component';

@Component({
  imports: [ModalComponent],
  template: `
    <button type="button" (click)="open.set(true)">Abrir</button>
    <app-modal [open]="open()" title="Prueba" (closeAction)="onClose()">
      Contenido
    </app-modal>
  `,
})
class ModalHostComponent {
  readonly open = signal(true);
  readonly closed = vi.fn(() => this.open.set(false));

  onClose(): void {
    this.closed();
  }
}

describe('ModalComponent exit animation', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    document.body.classList.remove('overflow-hidden');
  });

  function create(open: boolean) {
    const fixture = TestBed.createComponent(ModalComponent);
    fixture.componentRef.setInput('open', open);
    fixture.componentRef.setInput('title', 'Prueba');
    fixture.detectChanges();
    return fixture;
  }

  it('renders nothing while closed', () => {
    const fixture = create(false);
    expect(fixture.nativeElement.querySelector('[role="dialog"]')).toBeNull();
  });

  it('keeps the dialog mounted, marked as closing, until the exit animation ends', async () => {
    const fixture = create(true);
    await fixture.whenStable();
    expect(fixture.nativeElement.querySelector('[role="dialog"]')).not.toBeNull();
    expect(document.body.classList.contains('overflow-hidden')).toBe(true);

    fixture.componentRef.setInput('open', false);
    fixture.detectChanges();
    await fixture.whenStable();

    const closing = fixture.nativeElement.querySelector('[role="dialog"]');
    expect(closing).not.toBeNull();
    expect(closing.hasAttribute('data-closing')).toBe(true);
    expect(document.body.classList.contains('overflow-hidden')).toBe(false);

    vi.advanceTimersByTime(300);
    fixture.detectChanges();
    await fixture.whenStable();
    expect(fixture.nativeElement.querySelector('[role="dialog"]')).toBeNull();
  });

  it('cancels the exit when it is reopened before it finishes', async () => {
    const fixture = create(true);
    fixture.componentRef.setInput('open', false);
    fixture.detectChanges();
    await fixture.whenStable();

    fixture.componentRef.setInput('open', true);
    fixture.detectChanges();
    await fixture.whenStable();
    vi.advanceTimersByTime(300);
    fixture.detectChanges();

    const dialog = fixture.nativeElement.querySelector('[role="dialog"]');
    expect(dialog).not.toBeNull();
    expect(dialog.hasAttribute('data-closing')).toBe(false);
  });

  function drag(header: HTMLElement, endY: number, cancelled = false): void {
    function dispatch(type: string, clientY: number): void {
      header.dispatchEvent(
        Object.assign(new Event(type, { bubbles: true }), {
          pointerId: 1,
          pointerType: 'touch',
          clientY,
        }),
      );
    }

    dispatch('pointerdown', 0);
    dispatch('pointermove', endY);
    dispatch(cancelled ? 'pointercancel' : 'pointerup', endY);
  }

  it.each([0, 16, 100, 230])('reopens with one click %i ms after a touch dismissal', (delay) => {
    vi.stubGlobal('matchMedia', vi.fn(() => ({ matches: true })));
    const fixture = TestBed.createComponent(ModalHostComponent);
    fixture.detectChanges();

    const header = fixture.nativeElement.querySelector('.touch-none') as HTMLElement;
    const panel = header.parentElement!;
    vi.spyOn(panel, 'offsetHeight', 'get').mockReturnValue(400);

    drag(header, 160);
    fixture.detectChanges();

    expect(fixture.componentInstance.open()).toBe(false);
    expect(fixture.componentInstance.closed).toHaveBeenCalledTimes(1);
    expect(fixture.nativeElement.querySelector('[role="dialog"]')).toBeNull();
    vi.advanceTimersByTime(delay);

    fixture.nativeElement.querySelector('button').click();
    fixture.detectChanges();
    vi.advanceTimersByTime(300);
    fixture.detectChanges();

    const reopened = fixture.nativeElement.querySelector('[role="dialog"]') as HTMLElement;
    expect(fixture.componentInstance.open()).toBe(true);
    expect(reopened.hasAttribute('data-closing')).toBe(false);
    expect(reopened.hasAttribute('inert')).toBe(false);
    expect(reopened.style.pointerEvents).toBe('');
    const newHeader = reopened.querySelector('.touch-none') as HTMLElement;
    const newPanel = newHeader.parentElement!;
    expect(newPanel).not.toBe(panel);
    expect(newPanel.style.translate).toBe('');
    vi.spyOn(newPanel, 'offsetHeight', 'get').mockReturnValue(400);

    drag(newHeader, 160);
    fixture.detectChanges();
    expect(fixture.componentInstance.open()).toBe(false);
    expect(fixture.componentInstance.closed).toHaveBeenCalledTimes(2);
  });

  it('keeps the modal open and resets its position after a short or cancelled gesture', () => {
    vi.stubGlobal('matchMedia', vi.fn(() => ({ matches: true })));
    const fixture = TestBed.createComponent(ModalHostComponent);
    fixture.detectChanges();
    const header = fixture.nativeElement.querySelector('.touch-none') as HTMLElement;
    const panel = header.parentElement!;
    vi.spyOn(panel, 'offsetHeight', 'get').mockReturnValue(400);

    drag(header, 20);
    fixture.detectChanges();
    expect(panel.style.translate).toBe('');

    drag(header, 160, true);
    fixture.detectChanges();
    expect(panel.style.translate).toBe('');
    expect(fixture.componentInstance.open()).toBe(true);
    expect(fixture.componentInstance.closed).not.toHaveBeenCalled();
  });
});
