import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ToastService } from './toast.service';

describe('ToastService', () => {
  let service: ToastService;

  beforeEach(() => {
    vi.useFakeTimers();
    service = new ToastService();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('adds a toast and auto-dismisses after the duration', () => {
    service.success('Guardado correctamente');
    expect(service.toasts().length).toBe(1);

    vi.advanceTimersByTime(3500);
    expect(service.toasts().length).toBe(0);
  });

  it('cancels the pending timer when manually dismissed', () => {
    service.success('Guardado correctamente');
    const id = service.toasts()[0].id;

    service.dismiss(id);
    expect(service.toasts().length).toBe(0);

    // The previous timer should not fire and throw or re-add the toast.
    vi.advanceTimersByTime(10000);
    expect(service.toasts().length).toBe(0);
  });

  it('uses different durations for success with and without action', () => {
    service.success('Sin acción');
    service.success('Con acción', undefined, { label: 'Deshacer', run: () => {} });

    const [first, second] = service.toasts();
    expect(first).toBeDefined();
    expect(second).toBeDefined();

    vi.advanceTimersByTime(3500);
    expect(service.toasts().find((t) => t.id === first.id)).toBeUndefined();
    expect(service.toasts().find((t) => t.id === second.id)).toBeDefined();

    vi.advanceTimersByTime(4500);
    expect(service.toasts().length).toBe(0);
  });

  it('does not schedule a timer when duration is 0', () => {
    service.show('info', 'Persistente', undefined, 0);
    expect(service.toasts().length).toBe(1);

    vi.advanceTimersByTime(100000);
    expect(service.toasts().length).toBe(1);

    service.dismiss(service.toasts()[0].id);
    expect(service.toasts().length).toBe(0);
  });

  it('pauses and resumes the auto-dismiss timer', () => {
    service.show('info', 'Pausable', undefined, 1000);
    const id = service.toasts()[0].id;

    vi.advanceTimersByTime(400);
    service.pause(id);

    vi.advanceTimersByTime(2000);
    expect(service.toasts().length).toBe(1);

    service.resume(id);

    vi.advanceTimersByTime(599);
    expect(service.toasts().length).toBe(1);
    vi.advanceTimersByTime(2);
    expect(service.toasts().length).toBe(0);
  });

  it('dismisses while paused without leaking timers', () => {
    service.show('info', 'X', undefined, 1000);
    const id = service.toasts()[0].id;

    vi.advanceTimersByTime(200);
    service.pause(id);
    service.dismiss(id);
    expect(service.toasts().length).toBe(0);

    vi.advanceTimersByTime(5000);
    expect(service.toasts().length).toBe(0);
  });

  it('handles pause/resume/dismiss for unknown ids without error', () => {
    expect(() => service.pause('unknown')).not.toThrow();
    expect(() => service.resume('unknown')).not.toThrow();
    expect(() => service.dismiss('unknown')).not.toThrow();
    expect(service.toasts().length).toBe(0);
  });

  it('keeps independent timers for multiple simultaneous toasts', () => {
    service.success('A');
    service.error('B');
    service.info('C');

    const [a, b, c] = service.toasts();

    vi.advanceTimersByTime(3000);
    expect(service.toasts().find((t) => t.id === c.id)).toBeUndefined();
    expect(service.toasts().find((t) => t.id === a.id)).toBeDefined();
    expect(service.toasts().find((t) => t.id === b.id)).toBeDefined();

    vi.advanceTimersByTime(500);
    expect(service.toasts().find((t) => t.id === a.id)).toBeUndefined();
    expect(service.toasts().find((t) => t.id === b.id)).toBeDefined();

    vi.advanceTimersByTime(1500);
    expect(service.toasts().length).toBe(0);
  });
});
