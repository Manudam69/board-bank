import { Component, computed, input, output } from '@angular/core';
import type { CurrencyConfig, Edition, Player } from '../../../core/models';
import { MoneyDisplayComponent } from './money-display.component';
import { PropertyCardComponent } from './property-card.component';
import { ButtonComponent } from '../ui/button.component';

@Component({
  selector: 'app-player-dashboard',
  standalone: true,
  imports: [MoneyDisplayComponent, PropertyCardComponent, ButtonComponent],
  templateUrl: './player-dashboard.component.html',
})
export class PlayerDashboardComponent {
  readonly me = input.required<Player>();
  readonly edition = input.required<Edition>();
  readonly currency = input.required<CurrencyConfig>();

  readonly salaryAction = output<void>();
  readonly taxAction = output<'income' | 'luxury'>();
  readonly bankruptcyAction = output<void>();

  protected netWorth = computed(() => {
    const cash = this.me().cash;
    const propertiesValue = this.me().properties.reduce((sum, pp) => {
      const meta = this.edition().properties.find((p) => p.id === pp.propertyId);
      return sum + (meta?.price ?? 0);
    }, 0);
    return cash + propertiesValue;
  });

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
