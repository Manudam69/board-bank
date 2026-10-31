import { Component, DestroyRef, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { MoneyDisplayComponent } from '../domain/money-display.component';
import { MoneyPipe } from '../../pipes/money.pipe';
import { ICONS } from '../../icons';
import type { CurrencyConfig } from '../../../core/models';

interface BalanceDelta {
  id: number;
  value: number;
  timestamp: number;
}

const DELTA_DURATION_MS = 1400;
const MAX_STACKED_DELTAS = 3;
const COUNT_DURATION_MS = 650;
const TINT_DURATION_MS = 900;

@Component({
  selector: 'app-balance',
  standalone: true,
  imports: [MoneyDisplayComponent, MoneyPipe],
  templateUrl: './balance.component.html',
})
export class BalanceComponent {
  readonly amount = input.required<number>();
  readonly currency = input.required<CurrencyConfig>();
  readonly size = input<'sm' | 'md' | 'lg' | 'xl'>('md');

  protected readonly deltas = signal<BalanceDelta[]>([]);
  protected readonly icons = ICONS;
  /** The amount currently shown; rolls toward `amount` whenever the balance changes. */
  protected readonly displayAmount = signal(0);
  protected readonly tint = signal<'up' | 'down' | null>(null);

  private lastAmount: number | undefined;
  private nextId = 0;
  private timers = new Map<number, ReturnType<typeof setTimeout>>();
  private frame: number | undefined;
  private tintTimer?: ReturnType<typeof setTimeout>;
  private readonly destroyRef = inject(DestroyRef);

  protected hasDelta = computed(() => this.deltas().length > 0);
  protected pulseEven = computed(() => this.deltas().length > 0 && this.deltas()[this.deltas().length - 1].id % 2 === 0);

  constructor() {
    effect(() => {
      const current = this.amount();
      if (this.lastAmount === undefined) {
        this.displayAmount.set(current);
      } else {
        const diff = current - this.lastAmount;
        if (diff !== 0) {
          this.addDelta(diff);
          untracked(() => this.rollTo(current, diff));
        }
      }
      this.lastAmount = current;
    });

    this.destroyRef.onDestroy(() => {
      for (const timer of this.timers.values()) {
        clearTimeout(timer);
      }
      this.timers.clear();
      clearTimeout(this.tintTimer);
      if (this.frame !== undefined && typeof cancelAnimationFrame === 'function') {
        cancelAnimationFrame(this.frame);
      }
    });
  }

  private rollTo(target: number, diff: number): void {
    if (this.frame !== undefined && typeof cancelAnimationFrame === 'function') {
      cancelAnimationFrame(this.frame);
    }
    this.frame = undefined;

    clearTimeout(this.tintTimer);
    this.tint.set(null);

    const canAnimate =
      typeof requestAnimationFrame === 'function' &&
      !(typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches);
    if (!canAnimate) {
      this.displayAmount.set(target);
      return;
    }

    // Re-add the class on the next frame so the tint restarts even on back-to-back changes.
    requestAnimationFrame(() => {
      this.tint.set(diff > 0 ? 'up' : 'down');
      this.tintTimer = setTimeout(() => this.tint.set(null), TINT_DURATION_MS);
    });

    const from = this.displayAmount();
    const whole = Number.isInteger(from) && Number.isInteger(target);
    const startedAt = performance.now();
    const step = (now: number) => {
      const progress = Math.min(1, (now - startedAt) / COUNT_DURATION_MS);
      const eased = 1 - Math.pow(1 - progress, 3);
      if (progress >= 1) {
        this.displayAmount.set(target);
        this.frame = undefined;
        return;
      }
      const value = from + (target - from) * eased;
      this.displayAmount.set(whole ? Math.round(value) : value);
      this.frame = requestAnimationFrame(step);
    };
    this.frame = requestAnimationFrame(step);
  }

  private addDelta(value: number): void {
    const id = this.nextId++;
    const delta: BalanceDelta = { id, value, timestamp: Date.now() };
    this.deltas.update((list) => {
      const next = [...list, delta];
      return next.length > MAX_STACKED_DELTAS ? next.slice(next.length - MAX_STACKED_DELTAS) : next;
    });

    const timer = setTimeout(() => this.removeDelta(id), DELTA_DURATION_MS);
    this.timers.set(id, timer);
  }

  private removeDelta(id: number): void {
    this.timers.delete(id);
    this.deltas.update((list) => list.filter((d) => d.id !== id));
  }
}
