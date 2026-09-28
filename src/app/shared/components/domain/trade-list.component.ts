import { Component, computed, inject, input, output } from '@angular/core';
import { DatePipe } from '@angular/common';
import type { CurrencyConfig, Edition, Player, TradeOffer } from '../../../core/models';
import { MoneyFormatService } from '../../../core/services/money-format.service';
import { ButtonComponent } from '../ui/button.component';

type ResolvedTrade = TradeOffer & { status: 'accepted' | 'rejected' | 'cancelled' };

@Component({
  selector: 'app-trade-list',
  standalone: true,
  imports: [DatePipe, ButtonComponent],
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
