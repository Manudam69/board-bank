import { Component, computed, input, output } from '@angular/core';
import type { Edition, PlayerProperty, PropertyMetadata } from '../../../core/models';
import { MoneyPipe } from '../../pipes/money.pipe';
import { ICONS } from '../../icons';

@Component({
  selector: 'app-property-row',
  standalone: true,
  imports: [MoneyPipe],
  templateUrl: './property-row.component.html',
})
export class PropertyRowComponent {
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

  protected ICONS = ICONS;
  protected currency = computed(() => this.edition().currency);
  protected isOwned = computed(() => !!this.owned());
  protected isMortgaged = computed(() => this.owned()?.mortgaged ?? false);
  protected buildingSummary = computed(() => {
    const o = this.owned();
    if (!o) return null;
    if (o.hasHotel) return 'Hotel';
    if (o.houses > 0) return `${o.houses} casa${o.houses > 1 ? 's' : ''}`;
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

  protected needsDarkText = computed(() => {
    const color = this.property().groupColor.toUpperCase();
    return color === '#FFFFFF' || color === '#FFFF00' || color === '#F1C40F' || color === '#FFEB3B';
  });

  protected ariaLabel = computed(() => {
    const parts = [this.property().name, this.property().group];
    if (this.isMortgaged()) parts.push('hipotecada');
    if (this.buildingSummary()) parts.push(this.buildingSummary()!);
    return parts.join(', ');
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
