import { Component, computed, input, output } from '@angular/core';
import type { CurrencyConfig, Edition, Player, PropertyMetadata } from '../../../core/models';
import { MoneyPipe } from '../../pipes/money.pipe';
import { ButtonComponent } from '../ui/button.component';
import { ICONS } from '../../icons';

export interface PropertyAction {
  id: 'buy' | 'mortgage' | 'unmortgage' | 'build' | 'trade' | 'view';
  label: string;
  icon: string;
  variant: 'primary' | 'secondary' | 'danger';
}

@Component({
  selector: 'app-property-detail-sheet',
  standalone: true,
  imports: [MoneyPipe, ButtonComponent],
  templateUrl: './property-detail-sheet.component.html',
})
export class PropertyDetailSheetComponent {
  readonly property = input.required<PropertyMetadata | undefined>();
  readonly edition = input.required<Edition>();
  readonly currency = input.required<CurrencyConfig>();
  readonly owner = input<Player | undefined>(undefined);
  readonly owned = input(false);
  readonly canMortgage = input(false);
  readonly canUnmortgage = input(false);
  readonly canBuild = input(false);
  readonly closeAction = output<void>();
  readonly action = output<PropertyAction['id']>();

  protected ICONS = ICONS;
  protected actions = computed(() => {
    const list: PropertyAction[] = [];
    if (!this.owned() && !this.owner()) {
      list.push({ id: 'buy', label: 'Comprar', icon: ICONS['shopping-cart'], variant: 'primary' });
    }
    if (this.owned()) {
      if (this.canBuild()) list.push({ id: 'build', label: 'Construir', icon: ICONS['hammer'], variant: 'primary' });
      if (this.canMortgage()) list.push({ id: 'mortgage', label: 'Hipotecar', icon: ICONS['lock'], variant: 'secondary' });
      if (this.canUnmortgage()) list.push({ id: 'unmortgage', label: 'Deshipotecar', icon: ICONS['lock-open'], variant: 'secondary' });
    }
    list.push({ id: 'view', label: 'Cerrar', icon: ICONS['x'], variant: 'secondary' });
    return list;
  });

  protected needsDarkText = computed(() => {
    const p = this.property();
    if (!p) return false;
    const color = p.groupColor.toUpperCase();
    return color === '#FFFFFF' || color === '#FFFF00' || color === '#F1C40F' || color === '#FFEB3B';
  });

  protected rentLevels = computed(() => {
    const p = this.property();
    if (!p) return [];
    return p.rents.map((value, i) => ({
      label: i === 0 ? 'Base' : i === 5 ? 'Hotel' : `${i} casa${i > 1 ? 's' : ''}`,
      value,
    }));
  });

  protected emit(actionId: PropertyAction['id']): void {
    this.action.emit(actionId);
    if (actionId === 'view') {
      this.closeAction.emit();
    }
  }
}
