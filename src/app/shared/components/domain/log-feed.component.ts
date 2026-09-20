import { Component, computed, inject, input } from '@angular/core';
import { DatePipe } from '@angular/common';
import type { CurrencyConfig, Player, Room, TransactionLogEntry } from '../../../core/models';
import { MoneyFormatService } from '../../../core/services/money-format.service';

type EnrichedLog = TransactionLogEntry & { fromName?: string; toName?: string; formattedAmount: string };

@Component({
  selector: 'app-log-feed',
  standalone: true,
  imports: [DatePipe],
  templateUrl: './log-feed.component.html',
})
export class LogFeedComponent {
  private readonly formatter = inject(MoneyFormatService);

  readonly room = input.required<Room>();
  readonly currency = input.required<CurrencyConfig>();

  protected logs = computed<EnrichedLog[]>(() => {
    const players = new Map<string, Player>(
      this.room().players.map((p) => [p.id, p]),
    );
    return [...this.room().log]
      .sort((a, b) => b.timestamp - a.timestamp)
      .map((entry) => ({
        ...entry,
        fromName: entry.fromPlayerId === 'bank' ? 'Banco' : players.get(entry.fromPlayerId ?? '')?.name,
        toName: entry.toPlayerId === 'bank' ? 'Banco' : players.get(entry.toPlayerId ?? '')?.name,
        formattedAmount: this.formatter.format(entry.amount, this.currency()),
      }));
  });

  protected typeLabel(type: TransactionLogEntry['type']): string {
    const labels: Record<TransactionLogEntry['type'], string> = {
      transfer: 'Transferencia',
      'buy-property': 'Compra',
      'pay-rent': 'Alquiler',
      mortgage: 'Hipoteca',
      unmortgage: 'Deshipoteca',
      'build-houses': 'Construcción',
      'sell-houses': 'Venta',
      salary: 'Sueldo',
      tax: 'Impuesto',
      'bank-fee': 'Banco',
      trade: 'Intercambio',
      bankruptcy: 'Quiebra',
    };
    return labels[type];
  }
}
