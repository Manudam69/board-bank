import { Component, computed, input, output } from '@angular/core';
import type { Edition, PlayerProperty, PropertyMetadata } from '../../../core/models';
import { MoneyPipe } from '../../pipes/money.pipe';
import { MoneyDisplayComponent } from './money-display.component';

@Component({
  selector: 'app-property-card',
  standalone: true,
  imports: [MoneyDisplayComponent, MoneyPipe],
  templateUrl: './property-card.component.html',
})
export class PropertyCardComponent {
  readonly property = input.required<PropertyMetadata>();
  readonly edition = input.required<Edition>();
  readonly owned = input<PlayerProperty | null>(null);
  readonly ownerName = input<string>('');
  readonly selectable = input(false);
  readonly selected = input(false);
  readonly disabled = input(false);
  readonly showActions = input(false);
  readonly actionLabel = input('Acción');
  readonly propertyClick = output<PropertyMetadata>();
  readonly propertyAction = output<PropertyMetadata>();

  protected currency = computed(() => this.edition().currency);
  protected isOwned = computed(() => !!this.owned());
  protected isMortgaged = computed(() => this.owned()?.mortgaged ?? false);

  protected buildingSummary = computed(() => {
    const o = this.owned();
    if (!o) return null;
    if (o.hasHotel) return { type: 'hotel', label: 'Hotel' };
    if (o.houses > 0) return { type: 'houses', label: `${o.houses} casa${o.houses > 1 ? 's' : ''}` };
    return null;
  });

  protected rentPreview = computed(() => {
    const o = this.owned();
    if (!o) return this.property().rents[0];
    if (o.hasHotel) return this.property().rents[5];
    return this.property().rents[o.houses];
  });

  protected needsBorder = computed(() => {
    const color = this.property().groupColor.toUpperCase();
    return color === '#FFFFFF' || color === '#FFFF00' || color === '#000000';
  });

  protected onClick(): void {
    if (!this.disabled()) {
      this.propertyClick.emit(this.property());
    }
  }

  protected onAction(event: MouseEvent): void {
    event.stopPropagation();
    if (!this.disabled()) {
      this.propertyAction.emit(this.property());
    }
  }
}
