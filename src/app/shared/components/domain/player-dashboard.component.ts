import { Component, computed, inject, input, output } from '@angular/core';
import type { CurrencyConfig, Edition, Player, PropertyMetadata, TransactionLogEntry } from '../../../core/models';
import { MoneyFormatService } from '../../../core/services/money-format.service';
import { PropertyRowComponent } from './property-row.component';
import { EmptyStateComponent } from '../ui/empty-state.component';
import { BalanceComponent } from '../ui/balance.component';
import { ICONS } from '../../icons';

@Component({
  selector: 'app-player-dashboard',
  standalone: true,
  imports: [PropertyRowComponent, EmptyStateComponent, BalanceComponent],
  templateUrl: './player-dashboard.component.html',
})
export class PlayerDashboardComponent {
  private readonly formatter = inject(MoneyFormatService);

  readonly me = input.required<Player>();
  readonly edition = input.required<Edition>();
  readonly currency = input.required<CurrencyConfig>();
  readonly log = input.required<TransactionLogEntry[]>();

  readonly salaryAction = output<void>();
  readonly taxAction = output<'income' | 'luxury'>();
  readonly bankruptcyAction = output<void>();
  readonly propertyClick = output<PropertyMetadata>();

  protected readonly icons = ICONS as Record<string, string>;

  protected initials = computed(() => {
    const name = this.me().name.trim();
    return name.slice(0, 2).toUpperCase();
  });

  protected netWorth = computed(() => {
    const cash = this.me().cash;
    const propertiesValue = this.me().properties.reduce((sum, pp) => {
      const meta = this.edition().properties.find((p) => p.id === pp.propertyId);
      return sum + (meta?.price ?? 0);
    }, 0);
    return cash + propertiesValue;
  });

  protected formattedNetWorth = computed(() => this.formatter.format(this.netWorth(), this.currency()));

  protected mortgagesCount = computed(() => this.me().properties.filter((pp) => pp.mortgaged).length);

  protected moneyReceived = computed(() => {
    const me = this.me().id;
    return this.log().reduce((sum, entry) => {
      if (entry.toPlayerId === me && entry.amount > 0) return sum + entry.amount;
      return sum;
    }, 0);
  });

  protected formattedReceived = computed(() => this.formatter.format(this.moneyReceived(), this.currency()));

  protected moneySpent = computed(() => {
    const me = this.me().id;
    return this.log().reduce((sum, entry) => {
      if (entry.fromPlayerId === me && entry.amount > 0) return sum + entry.amount;
      return sum;
    }, 0);
  });

  protected formattedSpent = computed(() => this.formatter.format(this.moneySpent(), this.currency()));

  protected myProperties = computed(() =>
    this.me().properties
      .map((pp) => ({
        owned: pp,
        meta: this.edition().properties.find((p) => p.id === pp.propertyId),
      }))
      .filter((x): x is { owned: typeof x.owned; meta: NonNullable<typeof x.meta> } => !!x.meta)
      .sort((a, b) => a.meta.order - b.meta.order),
  );
}
