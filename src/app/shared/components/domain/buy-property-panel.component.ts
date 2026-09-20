import { Component, computed, input, model, output } from '@angular/core';
import type { CurrencyConfig, Edition, Player, PropertyMetadata } from '../../../core/models';
import { PropertyCardComponent } from './property-card.component';
import { ButtonComponent } from '../ui/button.component';
import { MoneyPipe } from '../../pipes/money.pipe';

@Component({
  selector: 'app-buy-property-panel',
  standalone: true,
  imports: [PropertyCardComponent, ButtonComponent, MoneyPipe],
  templateUrl: './buy-property-panel.component.html',
})
export class BuyPropertyPanelComponent {
  readonly edition = input.required<Edition>();
  readonly me = input.required<Player>();
  readonly players = input.required<Player[]>();
  readonly currency = input.required<CurrencyConfig>();
  readonly buyAction = output<{ propertyId: string }>();

  protected selectedProperty = model<PropertyMetadata | undefined>(undefined);

  protected availableProperties = computed(() => {
    const ownedIds = new Set(
      this.players().flatMap((p) => p.properties.map((pp) => pp.propertyId)),
    );
    return this.edition().properties.filter((p) => !ownedIds.has(p.id));
  });

  protected canBuy = computed(() => {
    const property = this.selectedProperty();
    return !!property && this.me().cash >= property.price;
  });

  protected groupedProperties = computed(() => {
    const map = new Map<string, PropertyMetadata[]>();
    for (const p of this.availableProperties()) {
      const list = map.get(p.group) ?? [];
      list.push(p);
      map.set(p.group, list);
    }
    return Array.from(map.entries()).map(([group, properties]) => ({
      group,
      properties: properties.sort((a, b) => a.order - b.order),
    }));
  });

  protected onSelect(property: PropertyMetadata): void {
    this.selectedProperty.set(property);
  }

  protected submit(): void {
    const property = this.selectedProperty();
    if (property) {
      this.buyAction.emit({ propertyId: property.id });
      this.selectedProperty.set(undefined);
    }
  }
}
