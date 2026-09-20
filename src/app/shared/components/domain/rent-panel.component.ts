import { Component, computed, inject, input, model, output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import type { CurrencyConfig, Edition, Player, PropertyMetadata, Room } from '../../../core/models';
import { PropertyCardComponent } from './property-card.component';
import { ButtonComponent } from '../ui/button.component';
import { MoneyDisplayComponent } from './money-display.component';
import { MoneyPipe } from '../../pipes/money.pipe';
import { RentService } from '../../../core/services/rent.service';

@Component({
  selector: 'app-rent-panel',
  standalone: true,
  imports: [FormsModule, PropertyCardComponent, ButtonComponent, MoneyDisplayComponent, MoneyPipe],
  templateUrl: './rent-panel.component.html',
})
export class RentPanelComponent {
  private readonly rentService = inject(RentService);

  readonly room = input.required<Room>();
  readonly me = input.required<Player>();
  readonly edition = input.required<Edition>();
  readonly currency = input.required<CurrencyConfig>();
  readonly rentAction = output<{ propertyId: string; amount: number }>();

  protected selected = model<PropertyMetadata | undefined>(undefined);
  protected diceSum = model(7);

  protected candidateProperties = computed(() => {
    const myIds = new Set(this.me().properties.map((pp) => pp.propertyId));
    const ownedIds = new Set(
      this.room().players.flatMap((p) => p.properties.map((pp) => pp.propertyId)),
    );
    return this.edition().properties
      .filter((p) => ownedIds.has(p.id) && !myIds.has(p.id))
      .sort((a, b) => a.order - b.order);
  });

  protected ownerName = computed(() => {
    const property = this.selected();
    if (!property) return '';
    const owner = this.room().players.find((p) =>
      p.properties.some((pp) => pp.propertyId === property.id),
    );
    return owner?.name ?? '';
  });

  protected rentInfo = computed(() => {
    const property = this.selected();
    if (!property) return null;
    return this.rentService.calculate(
      this.room(),
      this.edition(),
      property.id,
      this.diceSum(),
    );
  });

  protected canPay = computed(() => {
    const amount = this.rentInfo()?.amount ?? 0;
    return this.me().cash >= amount && amount > 0;
  });

  protected onSelect(property: PropertyMetadata): void {
    this.selected.set(property);
  }

  protected submit(): void {
    const property = this.selected();
    const amount = this.rentInfo()?.amount ?? 0;
    if (property && amount > 0) {
      this.rentAction.emit({ propertyId: property.id, amount });
      this.selected.set(undefined);
    }
  }
}
