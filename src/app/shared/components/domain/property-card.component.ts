import { Component, computed, input, output } from '@angular/core';
import { NgClass } from '@angular/common';
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
  protected buildingText = computed(() => {
    const o = this.owned();
    if (!o) return '';
    if (o.hasHotel) return '🏨 Hotel';
    if (o.houses > 0) return `🏠 ${o.houses} casa(s)`;
    return '';
  });

  protected rentPreview = computed(() => {
    const o = this.owned();
    if (!o) return this.property().rents[0];
    if (o.hasHotel) return this.property().rents[5];
    return this.property().rents[o.houses];
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
