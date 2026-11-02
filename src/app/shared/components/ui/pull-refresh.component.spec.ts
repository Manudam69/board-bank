import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { HapticsService } from '../../../core/services/haptics.service';
import { PullRefreshComponent } from './pull-refresh.component';

describe('PullRefreshComponent', () => {
  let mobile = true;
  const refresh = vi.fn<() => Promise<void>>();

  beforeEach(() => {
    mobile = true;
    refresh.mockReset().mockResolvedValue();
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.stubGlobal('matchMedia', vi.fn(() => ({
      matches: mobile,
      media: '',
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })));
    TestBed.configureTestingModule({
      imports: [PullRefreshComponent],
      providers: [{ provide: HapticsService, useValue: { play: vi.fn() } }],
    });
  });

  afterEach(() => {
    TestBed.resetTestingModule();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  function setup() {
    const fixture = TestBed.createComponent(PullRefreshComponent);
    fixture.componentRef.setInput('refresh', refresh);
    fixture.detectChanges();
    const target = document.createElement('div');
    fixture.nativeElement.append(target);
    return { fixture, target };
  }

  function touch(target: Element, type: string, x: number, y: number, count = 1): Event {
    const event = new Event(type, { bubbles: true, cancelable: true });
    const points = Array.from({ length: count }, (_, identifier) => ({ identifier, clientX: x, clientY: y }));
    Object.defineProperty(event, 'touches', { value: points });
    target.dispatchEvent(event);
    return event;
  }

  function pull(target: Element, dy = 160, dx = 0): void {
    touch(target, 'touchstart', 100, 100);
    touch(target, 'touchmove', 100 + dx, 100 + dy);
    touch(target, 'touchend', 100 + dx, 100 + dy, 0);
  }

  it('refreshes only after release at the required distance and announces success', async () => {
    const { fixture, target } = setup();
    touch(target, 'touchstart', 100, 100);
    const move = touch(target, 'touchmove', 100, 244);
    fixture.detectChanges();
    expect(move.defaultPrevented).toBe(true);
    expect(refresh).not.toHaveBeenCalled();
    expect(fixture.nativeElement.textContent).toContain('Suelta para actualizar');
    expect(fixture.nativeElement.querySelector('[data-refresh-label]').classList.contains('sr-only')).toBe(true);
    touch(target, 'touchend', 100, 244, 0);
    await fixture.whenStable();
    expect(refresh).toHaveBeenCalledOnce();
    expect(fixture.nativeElement.textContent).toContain('Datos actualizados');
  });

  it('transitions to a check on success and removes the indicator after 400 ms', async () => {
    vi.useFakeTimers();
    try {
      const { fixture, target } = setup();
      pull(target);
      await vi.advanceTimersByTimeAsync(0);
      fixture.detectChanges();
      const status: HTMLElement = fixture.nativeElement.querySelector('[role="status"]');
      expect(status.querySelector('svg')).not.toBeNull();
      expect(status.querySelector('.pull-refresh-success')).not.toBeNull();
      expect(status.querySelector('.pull-refresh-check path')?.getAttribute('d')).toBe('M5 13l4 4L19 7');
      expect(status.querySelector('[data-refresh-label]')?.classList.contains('sr-only')).toBe(true);
      await vi.advanceTimersByTimeAsync(399);
      fixture.detectChanges();
      expect(status.querySelector('svg')).not.toBeNull();
      await vi.advanceTimersByTimeAsync(1);
      fixture.detectChanges();
      expect(status.querySelector('svg')).toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });

  it('does not refresh below the threshold, horizontally, upwards or after cancellation', () => {
    const { target } = setup();
    pull(target, 143);
    pull(target, 20, 160);
    pull(target, -160);
    touch(target, 'touchstart', 100, 100);
    touch(target, 'touchmove', 100, 260);
    touch(target, 'touchcancel', 100, 260, 0);
    touch(target, 'touchend', 100, 260, 0);
    expect(refresh).not.toHaveBeenCalled();
  });

  it('claims the first downward movement at the top and cancels when the user pulls back', () => {
    const { target } = setup();
    touch(target, 'touchstart', 100, 100);
    expect(touch(target, 'touchmove', 100, 104).defaultPrevented).toBe(true);
    touch(target, 'touchmove', 100, 260);
    touch(target, 'touchmove', 100, 120);
    touch(target, 'touchend', 100, 120, 0);
    expect(refresh).not.toHaveBeenCalled();
  });

  it('ignores gestures when disabled or when scrolling has already taken control', () => {
    const { fixture, target } = setup();
    fixture.componentRef.setInput('enabled', false);
    fixture.detectChanges();
    pull(target);
    fixture.componentRef.setInput('enabled', true);
    fixture.detectChanges();
    touch(target, 'touchstart', 100, 100);
    const move = new Event('touchmove', { bubbles: true, cancelable: false });
    Object.defineProperty(move, 'touches', { value: [{ identifier: 0, clientX: 100, clientY: 260 }] });
    target.dispatchEvent(move);
    touch(target, 'touchend', 100, 260, 0);
    expect(refresh).not.toHaveBeenCalled();
  });

  it('leaves native scrolling alone away from the top of nested scroll containers', () => {
    const { fixture, target } = setup();
    const scroller = document.createElement('main');
    fixture.nativeElement.append(scroller);
    scroller.append(target);
    scroller.scrollTop = 30;
    pull(target);
    expect(refresh).not.toHaveBeenCalled();
    scroller.scrollTop = 0;
    pull(target);
    expect(refresh).toHaveBeenCalledOnce();
  });

  it('ignores desktop, controls, open dialogs and multiple fingers', () => {
    const { fixture, target } = setup();
    mobile = false;
    pull(target);
    mobile = true;
    const input = document.createElement('input');
    target.append(input);
    pull(input);
    const dialog = document.createElement('div');
    dialog.setAttribute('role', 'dialog');
    fixture.nativeElement.append(dialog);
    pull(target);
    dialog.remove();
    touch(target, 'touchstart', 100, 100);
    touch(target, 'touchmove', 100, 260, 2);
    touch(target, 'touchend', 100, 260, 0);
    expect(refresh).not.toHaveBeenCalled();
  });

  it('prevents duplicate requests and exposes errors rather than reporting success', async () => {
    let rejectRequest: (reason: Error) => void = () => {};
    refresh.mockImplementation(() => new Promise<void>((_, reject) => { rejectRequest = reject; }));
    const { fixture, target } = setup();
    pull(target);
    pull(target);
    fixture.detectChanges();
    expect(refresh).toHaveBeenCalledOnce();
    expect(fixture.nativeElement.textContent).toContain('Actualizando...');
    expect(fixture.nativeElement.querySelector('.pull-refresh-check')).toBeNull();
    rejectRequest(new Error('Sin conexión'));
    await vi.waitFor(() => {
      fixture.detectChanges();
      expect(fixture.nativeElement.textContent).toContain('No se pudo actualizar. Reintenta.');
    });
    expect(fixture.nativeElement.querySelector('[data-refresh-label]').classList.contains('sr-only')).toBe(false);
    expect(fixture.nativeElement.querySelector('.pull-refresh-check')).toBeNull();
    expect(fixture.nativeElement.textContent).not.toContain('Datos actualizados');
    expect(console.error).toHaveBeenCalledWith('Error al actualizar los datos:', expect.any(Error));
    refresh.mockResolvedValue();
    pull(target);
    await fixture.whenStable();
    expect(refresh).toHaveBeenCalledTimes(2);
    expect(fixture.nativeElement.textContent).toContain('Datos actualizados');
  });

  it('keeps long technical errors out of the indicator', async () => {
    const error = new Error('Detalle técnico '.repeat(200));
    refresh.mockRejectedValue(error);
    const { fixture, target } = setup();
    pull(target);
    await fixture.whenStable();
    const label: HTMLElement = fixture.nativeElement.querySelector('[data-refresh-label]');
    expect(label.textContent).toBe('No se pudo actualizar. Reintenta.');
    expect(fixture.nativeElement.textContent).not.toContain(error.message);
    expect(console.error).toHaveBeenCalledWith('Error al actualizar los datos:', error);
  });

  it('unlocks after exactly 10 seconds without a response and ignores late completion after retry', async () => {
    vi.useFakeTimers();
    try {
      let finishFirst: () => void = () => {};
      let finishRetry: () => void = () => {};
      refresh
        .mockImplementationOnce(() => new Promise<void>((resolve) => { finishFirst = resolve; }))
        .mockImplementationOnce(() => new Promise<void>((resolve) => { finishRetry = resolve; }));
      const { fixture, target } = setup();
      pull(target);
      await vi.advanceTimersByTimeAsync(9999);
      fixture.detectChanges();
      expect(fixture.nativeElement.querySelector('button').disabled).toBe(true);
      await vi.advanceTimersByTimeAsync(1);
      fixture.detectChanges();
      expect(fixture.nativeElement.querySelector('button').disabled).toBe(false);
      expect(fixture.nativeElement.textContent).toContain('No se pudo actualizar. Reintenta.');

      pull(target);
      fixture.detectChanges();
      expect(refresh).toHaveBeenCalledTimes(2);
      finishFirst();
      await vi.advanceTimersByTimeAsync(0);
      fixture.detectChanges();
      expect(fixture.nativeElement.querySelector('button').disabled).toBe(true);
      expect(fixture.nativeElement.textContent).not.toContain('Datos actualizados');

      finishRetry();
      await vi.advanceTimersByTimeAsync(0);
      fixture.detectChanges();
      expect(fixture.nativeElement.querySelector('button').disabled).toBe(false);
      expect(fixture.nativeElement.textContent).toContain('Datos actualizados');
      await vi.advanceTimersByTimeAsync(10_000);
      fixture.detectChanges();
      expect(fixture.nativeElement.textContent).not.toContain('No se pudo actualizar.');
    } finally {
      vi.useRealTimers();
    }
  });

  it('supports the keyboard alternative and ignores results from a previous page', async () => {
    let finish: () => void = () => {};
    refresh.mockImplementation(() => new Promise<void>((resolve) => { finish = resolve; }));
    const { fixture } = setup();
    fixture.nativeElement.querySelector('button').click();
    expect(refresh).toHaveBeenCalledOnce();
    fixture.componentRef.setInput('pageKey', 'next-page');
    fixture.detectChanges();
    finish();
    await fixture.whenStable();
    expect(fixture.nativeElement.textContent).not.toContain('Datos actualizados');
    expect(fixture.nativeElement.textContent).not.toContain('Actualizando...');
  });

  it('removes document gesture listeners when destroyed', () => {
    const { fixture } = setup();
    fixture.destroy();
    pull(document.body);
    expect(refresh).not.toHaveBeenCalled();
  });
});
