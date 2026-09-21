import { Component, computed, inject, input } from '@angular/core';
import type { CurrencyConfig, Player, Room, TransactionLogEntry } from '../../../core/models';
import { MoneyFormatService } from '../../../core/services/money-format.service';
import { ICONS } from '../../icons';

interface EnrichedLog extends TransactionLogEntry {
  fromName?: string;
  toName?: string;
  formattedAmount: string;
  isIncoming: boolean;
  isOutgoing: boolean;
  isUndone: boolean;
  timeAgo: string;
}

const ONE_MINUTE = 60_000;
const ONE_HOUR = 60 * ONE_MINUTE;
const ONE_DAY = 24 * ONE_HOUR;

@Component({
  selector: 'app-log-feed',
  standalone: true,
  imports: [],
  templateUrl: './log-feed.component.html',
})
export class LogFeedComponent {
  private readonly formatter = inject(MoneyFormatService);

  readonly room = input.required<Room>();
  readonly currency = input.required<CurrencyConfig>();
  readonly perspectivePlayerId = input<string | undefined>(undefined);

  protected readonly icons = ICONS;

  protected logs = computed<EnrichedLog[]>(() => {
    const players = new Map<string, Player>(this.room().players.map((p) => [p.id, p]));
    const me = this.perspectivePlayerId();
    const now = Date.now();
    return [...this.room().log]
      .filter((entry) => entry.type !== 'undo')
      .sort((a, b) => b.timestamp - a.timestamp)
      .map((entry) => {
        const isIncoming = !!me && entry.toPlayerId === me && entry.amount > 0;
        const isOutgoing = !!me && entry.fromPlayerId === me && entry.amount > 0;
        return {
          ...entry,
          fromName: entry.fromPlayerId === 'bank' ? 'Banco' : players.get(entry.fromPlayerId ?? '')?.name,
          toName: entry.toPlayerId === 'bank' ? 'Banco' : players.get(entry.toPlayerId ?? '')?.name,
          formattedAmount: this.formatter.format(entry.amount, this.currency()),
          isIncoming,
          isOutgoing,
          isUndone: !!entry.metadata?.['undone'],
          timeAgo: this.timeAgo(entry.timestamp, now),
        };
      });
  });

  protected typeIcon(type: TransactionLogEntry['type']): string {
    const map: Record<TransactionLogEntry['type'], string> = {
      transfer: this.icons['arrow-left-right'],
      'buy-property': this.icons['shopping-cart'],
      'pay-rent': this.icons['banknote'],
      mortgage: this.icons['lock'],
      unmortgage: this.icons['lock-open'],
      'build-houses': this.icons['hammer'],
      'sell-houses': this.icons['minus'],
      salary: this.icons['circle-dollar-sign'],
      tax: this.icons['circle-dollar-sign'],
      'bank-fee': this.icons['banknote'],
      trade: this.icons['arrow-left-right'],
      bankruptcy: this.icons['alert-triangle'],
      'game-end': this.icons['crown'],
      undo: this.icons['rotate-ccw'],
    };
    return map[type];
  }

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
      'game-end': 'Fin de partida',
      undo: 'Deshacer',
    };
    return labels[type];
  }

  private timeAgo(timestamp: number, now = Date.now()): string {
    const diff = now - timestamp;
    if (diff < ONE_MINUTE) return 'Ahora mismo';
    if (diff < ONE_HOUR) {
      const m = Math.floor(diff / ONE_MINUTE);
      return `Hace ${m} min`;
    }
    if (diff < ONE_DAY) {
      const h = Math.floor(diff / ONE_HOUR);
      return `Hace ${h} h`;
    }
    const d = Math.floor(diff / ONE_DAY);
    return d === 1 ? 'Ayer' : `Hace ${d} días`;
  }
}
