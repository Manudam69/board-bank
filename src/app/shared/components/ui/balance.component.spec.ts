import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { BalanceComponent } from './balance.component';
import { MoneyDisplayComponent } from '../domain/money-display.component';
import { MoneyPipe } from '../../pipes/money.pipe';
import { MoneyFormatService } from '../../../core/services/money-format.service';
import type { CurrencyConfig } from '../../../core/models';

const currency: CurrencyConfig = {
  symbol: '$',
  code: 'USD',
  scale: 'units',
};

describe('BalanceComponent delta animation', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('shows a delta chip when amount changes', async () => {
    TestBed.configureTestingModule({
      providers: [MoneyFormatService],
    });

    const fixture = TestBed.createComponent(BalanceComponent);
    fixture.componentRef.setInput('amount', 100);
    fixture.componentRef.setInput('currency', currency);
    fixture.detectChanges();
    await fixture.whenStable();

    expect(fixture.nativeElement.querySelectorAll('.animate-delta-up')).toHaveLength(0);

    fixture.componentRef.setInput('amount', 200);
    fixture.detectChanges();
    await fixture.whenStable();

    const chips = fixture.nativeElement.querySelectorAll('.animate-delta-up');
    expect(chips).toHaveLength(1);
    expect(chips[0].textContent).toContain('+');
    expect(chips[0].textContent).toContain('100');
  });

  it('removes the delta chip after the animation duration', async () => {
    TestBed.configureTestingModule({
      providers: [MoneyFormatService],
    });

    const fixture = TestBed.createComponent(BalanceComponent);
    fixture.componentRef.setInput('amount', 100);
    fixture.componentRef.setInput('currency', currency);
    fixture.detectChanges();
    await fixture.whenStable();

    fixture.componentRef.setInput('amount', 250);
    fixture.detectChanges();
    await fixture.whenStable();

    expect(fixture.nativeElement.querySelectorAll('.animate-delta-up')).toHaveLength(1);

    vi.advanceTimersByTime(1500);
    fixture.detectChanges();
    await fixture.whenStable();

    expect(fixture.nativeElement.querySelectorAll('.animate-delta-up')).toHaveLength(0);
  });

  it('shows a new delta chip on every amount change, even while a previous one is still visible', async () => {
    TestBed.configureTestingModule({
      providers: [MoneyFormatService],
    });

    const fixture = TestBed.createComponent(BalanceComponent);
    fixture.componentRef.setInput('amount', 100);
    fixture.componentRef.setInput('currency', currency);
    fixture.detectChanges();
    await fixture.whenStable();

    fixture.componentRef.setInput('amount', 200);
    fixture.detectChanges();
    await fixture.whenStable();

    vi.advanceTimersByTime(200);

    fixture.componentRef.setInput('amount', 350);
    fixture.detectChanges();
    await fixture.whenStable();

    const chips = fixture.nativeElement.querySelectorAll('.animate-delta-up');
    expect(chips.length).toBe(2);
  });

  it('creates a new delta chip after the previous one has expired', async () => {
    TestBed.configureTestingModule({
      providers: [MoneyFormatService],
    });

    const fixture = TestBed.createComponent(BalanceComponent);
    fixture.componentRef.setInput('amount', 100);
    fixture.componentRef.setInput('currency', currency);
    fixture.detectChanges();
    await fixture.whenStable();

    fixture.componentRef.setInput('amount', 200);
    fixture.detectChanges();
    await fixture.whenStable();

    vi.advanceTimersByTime(1500);
    fixture.detectChanges();
    await fixture.whenStable();

    expect(fixture.nativeElement.querySelectorAll('.animate-delta-up')).toHaveLength(0);

    fixture.componentRef.setInput('amount', 300);
    fixture.detectChanges();
    await fixture.whenStable();

    expect(fixture.nativeElement.querySelectorAll('.animate-delta-up')).toHaveLength(1);
  });

  it('stacks up to MAX_STACKED_DELTAS chips', async () => {
    TestBed.configureTestingModule({
      providers: [MoneyFormatService],
    });

    const fixture = TestBed.createComponent(BalanceComponent);
    fixture.componentRef.setInput('amount', 0);
    fixture.componentRef.setInput('currency', currency);
    fixture.detectChanges();
    await fixture.whenStable();

    for (let i = 1; i <= 5; i++) {
      fixture.componentRef.setInput('amount', i * 100);
      fixture.detectChanges();
      await fixture.whenStable();
      vi.advanceTimersByTime(50);
    }

    const chips = fixture.nativeElement.querySelectorAll('.animate-delta-up');
    expect(chips.length).toBeLessThanOrEqual(3);
  });
});
