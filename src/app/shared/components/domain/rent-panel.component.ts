import { Component, computed, inject, input, model, output, signal, type OnInit } from '@angular/core';
import type { CurrencyConfig, Edition, Player, PlayerProperty, PropertyMetadata, Room } from '../../../core/models';
import { PropertyCardComponent } from './property-card.component';
import { MoneyDisplayComponent } from './money-display.component';
import { MoneyFormatService } from '../../../core/services/money-format.service';
import { MoneyPipe } from '../../pipes/money.pipe';
import { RentService } from '../../../core/services/rent.service';
import { PlayerAvatarComponent } from '../ui/player-avatar.component';
import { PropertyGroupBarComponent } from '../ui/property-group-bar.component';
import { WizardComponent } from '../ui/wizard.component';
import { ICONS } from '../../icons';

export type RentStep = 'receiver' | 'property' | 'confirm';

const STEPS: readonly RentStep[] = ['receiver', 'property', 'confirm'];
const MIN_DICE = 2;
const MAX_DICE = 12;
const DEFAULT_DICE = 7;

interface Receiver {
  id: string;
  name: string;
  avatarColor: string;
  propertyIds: string[];
}

interface ReceiverProperty {
  property: PropertyMetadata;
  owned: PlayerProperty;
  rentAmount?: number;
  rentAmountText?: string;
}

@Component({
  selector: 'app-rent-panel',
  imports: [
    PropertyCardComponent,
    MoneyDisplayComponent,
    MoneyPipe,
    PlayerAvatarComponent,
    PropertyGroupBarComponent,
    WizardComponent,
  ],
  templateUrl: './rent-panel.component.html',
})
export class RentPanelComponent implements OnInit {
  private readonly rentService = inject(RentService);
  private readonly formatter = inject(MoneyFormatService);

  readonly room = input.required<Room>();
  readonly me = input.required<Player>();
  readonly edition = input.required<Edition>();
  readonly currency = input.required<CurrencyConfig>();
  readonly rentAction = output<{ toId: string; propertyId: string; amount: number }>();
  readonly initialToId = input<string | undefined>(undefined);

  protected readonly icons = ICONS as Record<string, string>;
  protected readonly stepLabels = ['Cobrador', 'Propiedad', 'Pagar'];
  protected readonly minDice = MIN_DICE;
  protected readonly maxDice = MAX_DICE;

  protected readonly step = signal<RentStep>('receiver');
  protected selectedToId = model<string | undefined>(undefined);
  protected selectedProperty = model<PropertyMetadata | undefined>(undefined);
  protected diceSum = model<number | undefined>(undefined);

  protected readonly stepIndex = computed(() => STEPS.indexOf(this.step()));

  protected receivers = computed<Receiver[]>(() => {
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

  protected readonly canChangeReceiver = computed(() => this.receivers().length > 1);

  protected readonly selectedReceiver = computed(() =>
    this.receivers().find((r) => r.id === this.selectedToId()),
  );

  protected receiverProperties = computed(() => {
    const toId = this.selectedToId();
    if (!toId) return [] as ReceiverProperty[];
    const receiver = this.receivers().find((r) => r.id === toId);
    if (!receiver) return [] as ReceiverProperty[];
    const ids = new Set(receiver.propertyIds);
    const owner = this.room().players.find((p) => p.id === toId);
    return this.edition().properties
      .filter((p) => ids.has(p.id))
      .sort((a, b) => a.order - b.order)
      .map((property) => {
        const owned = owner?.properties.find((pp) => pp.propertyId === property.id)!;
        if (property.isUtility) {
          const perDie = owner ? this.rentService.utilityPerDie(owner, this.edition(), property) : 0;
          return {
            property,
            owned,
            rentAmountText: `${this.formatter.format(perDie, this.currency())} × dados`,
          };
        }
        const amount = owner ? this.rentService.calculate(this.room(), this.edition(), property.id).amount : 0;
        return { property, owned, rentAmount: amount };
      });
  });

  protected needsDice = computed(() => this.selectedProperty()?.isUtility ?? false);

  protected resolvedDice = computed(() => {
    if (!this.needsDice()) return undefined;
    return this.diceSum() ?? DEFAULT_DICE;
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

  /** Presentational list so the keyed @for re-runs the pop-in animation on amount change. */
  protected rentInfoList = computed(() => {
    const info = this.rentInfo();
    return info ? [{ amount: info.amount, reason: info.reason }] : [];
  });

  protected canPay = computed(() => {
    const amount = this.rentInfo()?.amount ?? 0;
    return !!this.selectedToId() && !!this.selectedProperty() && this.me().cash >= amount && amount > 0;
  });

  protected remaining = computed(() => this.me().cash - (this.rentInfo()?.amount ?? 0));

  protected isValidDice = computed(() => {
    if (!this.needsDice()) return true;
    const dice = this.diceSum();
    return dice !== undefined && dice >= MIN_DICE && dice <= MAX_DICE;
  });

  protected readonly submitDisabled = computed(
    () => !this.selectedToId() || !this.selectedProperty() || !this.isValidDice(),
  );

  protected readonly title = computed(() => {
    switch (this.step()) {
      case 'receiver':
        return '¿A quién le pagas?';
      case 'property':
        return '¿En qué propiedad caíste?';
      case 'confirm':
        return 'Confirma el pago';
    }
  });

  protected readonly hint = computed(() => {
    switch (this.step()) {
      case 'receiver':
        return 'Toca al jugador dueño de la propiedad.';
      case 'property':
        return `Elige la propiedad de ${this.selectedReceiver()?.name ?? 'este jugador'}. La renta ya está calculada.`;
      case 'confirm':
        return 'Revisa el monto y confirma.';
    }
  });

  protected readonly primaryLabel = computed(() => {
    const info = this.rentInfo();
    if (!info) return 'Pagar renta';
    const amount = this.formatter.format(info.amount, this.currency());
    return this.canPay() ? `Pagar ${amount}` : `Conseguir efectivo y pagar ${amount}`;
  });

  ngOnInit(): void {
    const list = this.receivers();
    const initial = this.initialToId();
    const initialReceiver = initial ? list.find((r) => r.id === initial) : undefined;

    if (initialReceiver) {
      this.selectedToId.set(initialReceiver.id);
    } else if (list.length === 1) {
      this.selectedToId.set(list[0].id);
    }
    if (this.selectedToId()) this.step.set('property');
  }

  protected goTo(step: RentStep): void {
    this.step.set(step);
  }

  protected back(): void {
    const previous = STEPS[this.stepIndex() - 1];
    if (previous) this.step.set(previous);
  }

  protected selectTo(toId: string): void {
    if (this.selectedToId() !== toId) {
      this.selectedProperty.set(undefined);
      this.diceSum.set(undefined);
    }
    this.selectedToId.set(toId);
    this.step.set('property');
  }

  protected onSelectProperty(property: PropertyMetadata): void {
    this.selectedProperty.set(property);
    this.diceSum.set(property.isUtility ? DEFAULT_DICE : undefined);
    this.step.set('confirm');
  }

  protected onDiceInput(value: number | null): void {
    this.diceSum.set(value ?? undefined);
  }

  protected bumpDice(delta: number): void {
    const current = this.diceSum() ?? DEFAULT_DICE;
    this.diceSum.set(Math.min(MAX_DICE, Math.max(MIN_DICE, current + delta)));
  }

  protected submit(): void {
    const toId = this.selectedToId();
    const property = this.selectedProperty();
    const amount = this.rentInfo()?.amount ?? 0;
    if (toId && property && amount > 0) {
      this.rentAction.emit({ toId, propertyId: property.id, amount });
    }
  }
}
