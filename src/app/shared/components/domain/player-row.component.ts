import { Component, computed, inject, input, output } from '@angular/core';
import type { CurrencyConfig, Edition, Player } from '../../../core/models';
import { MoneyFormatService } from '../../../core/services/money-format.service';
import { MoneyPipe } from '../../pipes/money.pipe';
import { ICONS } from '../../icons';

@Component({
  selector: 'app-player-row',
  standalone: true,
  imports: [MoneyPipe],
  templateUrl: './player-row.component.html',
})
export class PlayerRowComponent {
  private readonly formatter = inject(MoneyFormatService);

  readonly player = input.required<Player>();
  readonly currency = input.required<CurrencyConfig>();
  readonly edition = input.required<Edition>();
  readonly rank = input<number | undefined>(undefined);
  readonly isHostView = input(false);
  readonly selected = input(false);
  readonly selectAction = output<Player>();

  protected ICONS = ICONS;
  protected propertyCount = computed(() => this.player().properties.length);
  protected netWorth = computed(() => {
    const cash = this.player().cash;
    const propertiesValue = this.player().properties.reduce((sum, pp) => {
      const meta = this.edition().properties.find((p) => p.id === pp.propertyId);
      return sum + (meta?.price ?? 0);
    }, 0);
    return cash + propertiesValue;
  });

  protected formattedNetWorth = computed(() =>
    this.formatter.format(this.netWorth(), this.currency()),
  );

  protected onClick(): void {
    this.selectAction.emit(this.player());
  }
}
