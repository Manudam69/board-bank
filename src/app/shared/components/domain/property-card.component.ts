import { Component, computed, inject, input, output } from '@angular/core';
import type { Edition, PlayerProperty, PropertyMetadata } from '../../../core/models';
import { MoneyFormatService } from '../../../core/services/money-format.service';
import { MoneyPipe } from '../../pipes/money.pipe';
import { MoneyDisplayComponent } from './money-display.component';

@Component({
  selector: 'app-property-card',
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
  readonly rentAmount = input<number | undefined>(undefined);
  readonly rentAmountText = input<string | undefined>(undefined);
  readonly propertyClick = output<PropertyMetadata>();
  readonly propertyAction = output<PropertyMetadata>();

  private readonly formatter = inject(MoneyFormatService);

  protected currency = computed(() => this.edition().currency);
  protected isOwned = computed(() => !!this.owned());
  protected isMortgaged = computed(() => this.owned()?.mortgaged ?? false);
  protected hasContextualRent = computed(() =>
    this.rentAmount() !== undefined || this.rentAmountText() !== undefined,
  );

  protected buildingSummary = computed(() => {
    const o = this.owned();
    if (!o) return null;
    if (o.hasHotel) return { type: 'hotel', label: 'Hotel' };
    if (o.houses > 0) return { type: 'houses', label: `${o.houses} casa${o.houses > 1 ? 's' : ''}` };
    return null;
  });

  protected needsBorder = computed(() => {
    const color = this.property().groupColor.toUpperCase();
    return color === '#FFFFFF' || color === '#FFFF00' || color === '#000000';
  });

  protected ariaLabel = computed(() => {
    const parts = [this.property().name, this.property().group];
    const rentAmount = this.rentAmount();
    const rentText = this.rentAmountText();
    if (rentAmount !== undefined) {
      parts.push(`Renta ${this.formatter.format(rentAmount, this.currency())}`);
    } else if (rentText) {
      parts.push(`Renta ${rentText}`);
    }
    if (this.isMortgaged()) parts.push('Hipotecada');
    const building = this.buildingSummary();
    if (building) parts.push(building.label);
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
