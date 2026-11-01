import { Component, computed, inject, input, model, output, signal } from '@angular/core';
import type { CurrencyConfig, Edition, Player, PropertyMetadata } from '../../../core/models';
import { PropertyCardComponent } from './property-card.component';
import { MoneyFormatService } from '../../../core/services/money-format.service';
import { MoneyPipe } from '../../pipes/money.pipe';
import { PropertyGroupBarComponent } from '../ui/property-group-bar.component';
import { WizardComponent } from '../ui/wizard.component';

export type BuyStep = 'property' | 'confirm';

@Component({
  selector: 'app-buy-property-panel',
  standalone: true,
  imports: [PropertyCardComponent, MoneyPipe, PropertyGroupBarComponent, WizardComponent],
  templateUrl: './buy-property-panel.component.html',
})
export class BuyPropertyPanelComponent {
  private readonly formatter = inject(MoneyFormatService);

  readonly edition = input.required<Edition>();
  readonly me = input.required<Player>();
  readonly players = input.required<Player[]>();
  readonly currency = input.required<CurrencyConfig>();
  readonly buyAction = output<{ propertyId: string }>();

  protected readonly stepLabels = ['Propiedad', 'Comprar'];
  protected readonly step = signal<BuyStep>('property');
  protected readonly activeGroup = signal<string | null>(null);
  protected selectedProperty = model<PropertyMetadata | undefined>(undefined);

  protected availableProperties = computed(() => {
    const ownedIds = new Set(
      this.players().flatMap((p) => p.properties.map((pp) => pp.propertyId)),
    );
    return this.edition().properties.filter((p) => !ownedIds.has(p.id));
  });

  /** Groups that still have something to buy, in board order, for the filter chips. */
  protected availableGroups = computed(() => {
    const seen = new Map<string, { group: string; color: string; order: number }>();
    for (const p of this.availableProperties()) {
      const existing = seen.get(p.group);
      if (!existing || p.order < existing.order) {
        seen.set(p.group, { group: p.group, color: p.groupColor, order: p.order });
      }
    }
    return Array.from(seen.values()).sort((a, b) => a.order - b.order);
  });

  protected groupedProperties = computed(() => {
    const active = this.activeGroup();
    const map = new Map<string, PropertyMetadata[]>();
    for (const p of this.availableProperties()) {
      if (active && p.group !== active) continue;
      const list = map.get(p.group) ?? [];
      list.push(p);
      map.set(p.group, list);
    }
    return Array.from(map.entries()).map(([group, properties]) => ({
      group,
      properties: properties.sort((a, b) => a.order - b.order),
    }));
  });

  protected canAfford = computed(() => {
    const property = this.selectedProperty();
    return !!property && this.me().cash >= property.price;
  });

  protected remaining = computed(() => this.me().cash - (this.selectedProperty()?.price ?? 0));

  protected canSubmit = computed(() => !!this.selectedProperty());

  protected readonly stepIndex = computed(() => (this.step() === 'property' ? 0 : 1));

  protected readonly primaryLabel = computed(() => {
    const property = this.selectedProperty();
    if (!property) return 'Comprar';
    const price = this.formatter.format(property.price, this.currency());
    return this.canAfford() ? `Comprar ${price}` : `Conseguir efectivo y comprar ${price}`;
  });

  protected selectGroup(group: string | null): void {
    this.activeGroup.set(group);
  }

  protected onSelect(property: PropertyMetadata): void {
    this.selectedProperty.set(property);
    this.step.set('confirm');
  }

  protected back(): void {
    this.step.set('property');
  }

  protected submit(): void {
    const property = this.selectedProperty();
    if (property) {
      this.buyAction.emit({ propertyId: property.id });
    }
  }
}
