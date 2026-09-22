import { Component, computed, input, model, output, signal } from '@angular/core';
import type { CurrencyConfig, Edition, Player, PlayerProperty, PropertyMetadata } from '../../../core/models';
import { AmountInputComponent } from '../ui/amount-input.component';
import { ButtonComponent } from '../ui/button.component';
import { MoneyPipe } from '../../pipes/money.pipe';

interface TradePropertyOption {
  readonly meta: PropertyMetadata;
  readonly hasBuildings: boolean;
}

@Component({
  selector: 'app-trade-builder',
  imports: [AmountInputComponent, ButtonComponent, MoneyPipe],
  templateUrl: './trade-builder.component.html',
})
export class TradeBuilderComponent {
  readonly edition = input.required<Edition>();
  readonly me = input.required<Player>();
  readonly players = input.required<Player[]>();
  readonly currency = input.required<CurrencyConfig>();
  readonly proposeAction = output<{
    toId: string;
    fromCash: number;
    toCash: number;
    fromProperties: string[];
    toProperties: string[];
  }>();

  protected toId = signal<string | undefined>(undefined);
  protected fromCash = model(0);
  protected toCash = model(0);
  protected fromProperties = model<Set<string>>(new Set());
  protected toProperties = model<Set<string>>(new Set());

  protected eligibleTo = computed(() =>
    this.players().filter((p) => p.id !== this.me().id && !p.bankrupt),
  );

  protected myPropertiesList = computed(() => this.buildPropertyOptions(this.me().properties));

  protected toPropertiesList = computed(() => {
    const id = this.toId();
    if (!id) return [];
    const player = this.players().find((p) => p.id === id);
    if (!player) return [];
    return this.buildPropertyOptions(player.properties);
  });

  protected canSubmit = computed(() => {
    const to = this.toId();
    if (!to || to === this.me().id) return false;
    const toPlayer = this.players().find((p) => p.id === to);
    if (!toPlayer) return false;
    if (this.me().cash < this.fromCash()) return false;
    if (toPlayer.cash < this.toCash()) return false;
    return this.fromCash() >= 0 && this.toCash() >= 0;
  });

  protected selectTo(id: string): void {
    this.toId.set(id);
    this.toProperties.set(new Set());
  }

  protected toggleFrom(option: TradePropertyOption): void {
    if (option.hasBuildings) return;
    const propertyId = option.meta.id;
    const set = new Set(this.fromProperties());
    if (set.has(propertyId)) set.delete(propertyId);
    else set.add(propertyId);
    this.fromProperties.set(set);
  }

  protected toggleTo(option: TradePropertyOption): void {
    if (option.hasBuildings) return;
    const propertyId = option.meta.id;
    const set = new Set(this.toProperties());
    if (set.has(propertyId)) set.delete(propertyId);
    else set.add(propertyId);
    this.toProperties.set(set);
  }

  protected submit(): void {
    const to = this.toId();
    if (!to) return;
    this.proposeAction.emit({
      toId: to,
      fromCash: this.fromCash(),
      toCash: this.toCash(),
      fromProperties: Array.from(this.fromProperties()),
      toProperties: Array.from(this.toProperties()),
    });
    this.fromCash.set(0);
    this.toCash.set(0);
    this.fromProperties.set(new Set());
    this.toProperties.set(new Set());
    this.toId.set(undefined);
  }

  private buildPropertyOptions(properties: PlayerProperty[]): TradePropertyOption[] {
    return properties
      .map((pp) => {
        const meta = this.edition().properties.find((p) => p.id === pp.propertyId);
        if (!meta) return null;
        return {
          meta,
          hasBuildings: pp.houses > 0 || pp.hasHotel,
        };
      })
      .filter((option): option is TradePropertyOption => !!option);
  }
}
