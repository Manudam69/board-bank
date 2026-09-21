import { Component, DestroyRef, computed, effect, inject, input, signal } from '@angular/core';
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

  private lastAmount: number | undefined;
  private nextId = 0;
  private timers = new Map<number, ReturnType<typeof setTimeout>>();
  private readonly destroyRef = inject(DestroyRef);

  protected hasDelta = computed(() => this.deltas().length > 0);
  protected pulseEven = computed(() => this.deltas().length > 0 && this.deltas()[this.deltas().length - 1].id % 2 === 0);

  constructor() {
    effect(() => {
      const current = this.amount();
      if (this.lastAmount !== undefined) {
        const diff = current - this.lastAmount;
        if (diff !== 0) {
          this.addDelta(diff);
        }
      }
      this.lastAmount = current;
    });

    this.destroyRef.onDestroy(() => {
      for (const timer of this.timers.values()) {
        clearTimeout(timer);
      }
      this.timers.clear();
    });
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
