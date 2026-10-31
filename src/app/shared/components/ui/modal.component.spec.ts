import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { ModalComponent } from './modal.component';

describe('ModalComponent exit animation', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });

  afterEach(() => {
    vi.useRealTimers();
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
});
