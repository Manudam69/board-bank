import { Component, computed, inject, input, model, output } from '@angular/core';
import type { CurrencyConfig, Edition, Player, PropertyMetadata } from '../../../core/models';
import { PropertyCardComponent } from './property-card.component';
import { ButtonComponent } from '../ui/button.component';
import { MoneyPipe } from '../../pipes/money.pipe';
import { RentService } from '../../../core/services/rent.service';

@Component({
  selector: 'app-build-panel',
  standalone: true,
  imports: [PropertyCardComponent, ButtonComponent, MoneyPipe],
  templateUrl: './build-panel.component.html',
})
export class BuildPanelComponent {
  private readonly rentService = inject(RentService);

  readonly edition = input.required<Edition>();
  readonly me = input.required<Player>();
  readonly currency = input.required<CurrencyConfig>();
  readonly buildAction = output<{ propertyId: string; mode: 'house' | 'hotel' | 'sell-house' | 'sell-hotel' }>();

  protected selected = model<PropertyMetadata | undefined>(undefined);

  protected candidateProperties = computed(() => {
    return this.me().properties
      .filter((pp) => !pp.mortgaged)
      .map((pp) => ({
        meta: this.edition().properties.find((p) => p.id === pp.propertyId),
        owned: pp,
      }))
      .filter((x): x is { meta: PropertyMetadata; owned: typeof x.owned } => !!x.meta);
  });

  protected selectedOwned = computed(() => {
    const property = this.selected();
    if (!property) return undefined;
    return this.me().properties.find((pp) => pp.propertyId === property.id);
  });

  protected canBuildHouse = computed(() => {
    const property = this.selected();
    const owned = this.selectedOwned();
    if (!property || !owned) return false;
    if (property.isRailroad || property.isUtility) return false;
    if (owned.hasHotel) return false;
    if (this.me().cash < property.houseCost) return false;
    return this.rentService.canBuildMore(this.me(), this.edition(), property);
  });

  protected canBuildHotel = computed(() => {
    const property = this.selected();
    const owned = this.selectedOwned();
    if (!property || !owned) return false;
    if (property.isRailroad || property.isUtility) return false;
    return owned.houses === 4 && !owned.hasHotel && this.me().cash >= property.hotelCost;
  });

  protected canSellHouse = computed(() => {
    const owned = this.selectedOwned();
    return !!owned && owned.houses > 0 && !owned.hasHotel;
  });

  protected canSellHotel = computed(() => {
    const owned = this.selectedOwned();
    return !!owned && owned.hasHotel;
  });

  protected onSelect(property: PropertyMetadata): void {
    this.selected.set(property);
  }

  protected submit(mode: 'house' | 'hotel' | 'sell-house' | 'sell-hotel'): void {
    const property = this.selected();
    if (property) {
      this.buildAction.emit({ propertyId: property.id, mode });
    }
  }
}
