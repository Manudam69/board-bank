import { Component, computed, inject, input, output } from '@angular/core';
import { DatePipe, NgTemplateOutlet } from '@angular/common';
import type { CurrencyConfig, Edition, Player, PropertyMetadata, TradeOffer } from '../../../core/models';
import { MoneyFormatService } from '../../../core/services/money-format.service';
import { ButtonComponent } from '../ui/button.component';
import { PropertyGroupBarComponent } from '../ui/property-group-bar.component';

type ResolvedTrade = TradeOffer & { status: 'accepted' | 'rejected' | 'cancelled' };

@Component({
  selector: 'app-trade-list',
  imports: [DatePipe, NgTemplateOutlet, ButtonComponent, PropertyGroupBarComponent],
  templateUrl: './trade-list.component.html',
})
export class TradeListComponent {
  private readonly formatter = inject(MoneyFormatService);

  readonly roomId = input.required<string>();
  readonly trades = input.required<TradeOffer[]>();
  readonly players = input.required<Player[]>();
  readonly currency = input.required<CurrencyConfig>();
  readonly edition = input.required<Edition>();
  readonly currentPlayerId = input<string | undefined>(undefined);
  readonly acceptAction = output<string>();
  readonly rejectAction = output<string>();
  readonly cancelAction = output<string>();

  private playerMap = computed(() => {
    return new Map<string, Player>(this.players().map((p) => [p.id, p]));
  });

  private myTrades = computed(() => {
    const id = this.currentPlayerId();
    return this.trades().filter((t) => t.fromPlayerId === id || t.toPlayerId === id);
  });

  protected pendingTrades = computed(() =>
    this.myTrades()
      .filter((t): t is TradeOffer => t.status === 'pending')
      .sort((a, b) => b.createdAt - a.createdAt),
  );

  protected historyTrades = computed(() =>
    this.myTrades()
      .filter((t): t is ResolvedTrade => t.status !== 'pending')
      .sort((a, b) => (b.resolvedAt ?? b.createdAt) - (a.resolvedAt ?? a.createdAt)),
  );

  protected format(amount: number): string {
    return this.formatter.format(amount, this.currency());
  }

  protected propertyNames(ids: string[]): string {
    return ids
      .map((id) => this.edition().properties.find((p) => p.id === id)?.name)
      .filter(Boolean)
      .join(', ') || '—';
  }

  protected propertyList(ids: string[]): PropertyMetadata[] {
    return ids
      .map((id) => this.edition().properties.find((p) => p.id === id))
      .filter((property): property is PropertyMetadata => !!property);
  }

  /** The offer described from the current player's point of view. */
  protected perspective(offer: TradeOffer): {
    iAmSender: boolean;
    otherName: string;
    give: TradeOffer['fromItems'];
    receive: TradeOffer['toItems'];
  } {
    const iAmSender = offer.fromPlayerId === this.currentPlayerId();
    return {
      iAmSender,
      otherName: this.playerName(iAmSender ? offer.toPlayerId : offer.fromPlayerId),
      give: iAmSender ? offer.fromItems : offer.toItems,
      receive: iAmSender ? offer.toItems : offer.fromItems,
    };
  }

  protected playerName(id: string): string {
    return this.playerMap().get(id)?.name ?? 'Desconocido';
  }

  protected canAccept(offer: TradeOffer): boolean {
    return offer.status === 'pending' && offer.toPlayerId === this.currentPlayerId();
  }

  protected canReject(offer: TradeOffer): boolean {
    return offer.status === 'pending' && offer.toPlayerId === this.currentPlayerId();
  }

  protected canCancel(offer: TradeOffer): boolean {
    return offer.status === 'pending' && offer.fromPlayerId === this.currentPlayerId();
  }
}
