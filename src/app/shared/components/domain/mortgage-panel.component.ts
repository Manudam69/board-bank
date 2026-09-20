import { Component, computed, input, model, output } from '@angular/core';
import type { CurrencyConfig, Edition, Player, PropertyMetadata } from '../../../core/models';
import { PropertyCardComponent } from './property-card.component';
import { ButtonComponent } from '../ui/button.component';

@Component({
  selector: 'app-mortgage-panel',
  standalone: true,
  imports: [PropertyCardComponent, ButtonComponent],
  templateUrl: './mortgage-panel.component.html',
})
export class MortgagePanelComponent {
  readonly edition = input.required<Edition>();
  readonly me = input.required<Player>();
  readonly currency = input.required<CurrencyConfig>();
  readonly mode = input<'mortgage' | 'unmortgage'>('mortgage');
  readonly action = output<{ propertyId: string }>();

  protected selected = model<PropertyMetadata | undefined>(undefined);

  protected candidateProperties = computed(() => {
    return this.me().properties
      .filter((pp) => {
        if (this.mode() === 'mortgage') {
          return !pp.mortgaged && pp.houses === 0 && !pp.hasHotel;
        }
        return pp.mortgaged;
      })
      .map((pp) => this.edition().properties.find((p) => p.id === pp.propertyId))
      .filter((p): p is PropertyMetadata => !!p);
  });

  protected canSubmit = computed(() => !!this.selected());

  protected onSelect(property: PropertyMetadata): void {
    this.selected.set(property);
  }

  protected submit(): void {
    const property = this.selected();
    if (property) {
      this.action.emit({ propertyId: property.id });
      this.selected.set(undefined);
    }
  }
}
