import { Component, computed, inject, input, model, output, type OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import type { CurrencyConfig, Edition, Player, PropertyMetadata, Room } from '../../../core/models';
import { ICONS } from '../../icons';
import { PropertyCardComponent } from './property-card.component';
import { ButtonComponent } from '../ui/button.component';
import { MoneyDisplayComponent } from './money-display.component';
import { MoneyPipe } from '../../pipes/money.pipe';
import { RentService } from '../../../core/services/rent.service';

interface Receiver {
  id: string;
  name: string;
  avatarColor: string;
  propertyIds: string[];
}

@Component({
  selector: 'app-rent-panel',
  imports: [FormsModule, PropertyCardComponent, ButtonComponent, MoneyDisplayComponent, MoneyPipe],
  templateUrl: './rent-panel.component.html',
})
export class RentPanelComponent implements OnInit {
  private readonly rentService = inject(RentService);

  readonly room = input.required<Room>();
  readonly me = input.required<Player>();
  readonly edition = input.required<Edition>();
  readonly currency = input.required<CurrencyConfig>();
  readonly rentAction = output<{ toId: string; propertyId: string; amount: number }>();

  protected selectedToId = model<string | undefined>(undefined);
  protected selectedProperty = model<PropertyMetadata | undefined>(undefined);
  protected diceSum = model<number | undefined>(undefined);

  protected receivers = computed(() => {
    const me = this.me();
    return this.room().players
      .filter((p) => p.id !== me.id && !p.bankrupt && p.properties.length > 0)
      .map((p) => ({
        id: p.id,
        name: p.name,
        avatarColor: p.avatarColor,
        propertyIds: p.properties
          .filter((pp) => {
            const meta = this.edition().properties.find((m) => m.id === pp.propertyId);
            return !!meta && !pp.mortgaged;
          })
          .map((pp) => pp.propertyId),
      }))
      .filter((r) => r.propertyIds.length > 0)
      .sort((a, b) => a.name.localeCompare(b.name));
  });

  protected receiverProperties = computed(() => {
    const toId = this.selectedToId();
    if (!toId) return [];
    const receiver = this.receivers().find((r) => r.id === toId);
    if (!receiver) return [];
    const ids = new Set(receiver.propertyIds);
    return this.edition().properties
      .filter((p) => ids.has(p.id))
      .sort((a, b) => a.order - b.order);
  });

  protected needsDice = computed(() => this.selectedProperty()?.isUtility ?? false);

  protected resolvedDice = computed(() => {
    if (!this.needsDice()) return undefined;
    return this.diceSum() ?? 7;
  });

  protected rentInfo = computed(() => {
    const property = this.selectedProperty();
    if (!property) return null;
    return this.rentService.calculate(
      this.room(),
      this.edition(),
      property.id,
      this.resolvedDice(),
    );
  });

  protected canPay = computed(() => {
    const amount = this.rentInfo()?.amount ?? 0;
    return !!this.selectedToId() && !!this.selectedProperty() && this.me().cash >= amount && amount > 0;
  });

  protected isValidDice = computed(() => {
    if (!this.needsDice()) return true;
    const dice = this.diceSum();
    return dice !== undefined && dice >= 2 && dice <= 12;
  });

  protected selectedOwnerName = computed(() => {
    const property = this.selectedProperty();
    if (!property) return '';
    const owner = this.room().players.find((p) =>
      p.properties.some((pp) => pp.propertyId === property.id),
    );
    return owner?.name ?? '';
  });

  protected readonly icons = ICONS;

  ngOnInit(): void {
    const list = this.receivers();
    if (list.length === 1) {
      this.selectedToId.set(list[0].id);
    }
  }

  protected selectTo(toId: string): void {
    this.selectedToId.set(toId);
    this.selectedProperty.set(undefined);
    this.diceSum.set(undefined);
  }

  protected onSelectProperty(property: PropertyMetadata): void {
    this.selectedProperty.set(property);
    if (property.isUtility) {
      this.diceSum.set(7);
    } else {
      this.diceSum.set(undefined);
    }
  }

  protected onDiceInput(value: number | null): void {
    this.diceSum.set(value ?? undefined);
  }

  protected submit(): void {
    const toId = this.selectedToId();
    const property = this.selectedProperty();
    const amount = this.rentInfo()?.amount ?? 0;
    if (toId && property && amount > 0) {
      this.rentAction.emit({ toId, propertyId: property.id, amount });
      this.reset();
    }
  }

  protected reset(): void {
    this.selectedToId.set(undefined);
    this.selectedProperty.set(undefined);
    this.diceSum.set(undefined);
    const list = this.receivers();
    if (list.length === 1) {
      this.selectedToId.set(list[0].id);
    }
  }
}
