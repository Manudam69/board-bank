export type TransactionType =
  | 'transfer'
  | 'buy-property'
  | 'pay-rent'
  | 'mortgage'
  | 'unmortgage'
  | 'build-houses'
  | 'sell-houses'
  | 'salary'
  | 'tax'
  | 'bank-fee'
  | 'bank-payment'
  | 'trade'
  | 'bankruptcy'
  | 'game-end'
  | 'undo';

export interface TransactionLogEntry {
  id: string;
  timestamp: number;
  type: TransactionType;
  fromPlayerId?: string | 'bank';
  toPlayerId?: string | 'bank';
  amount: number;
  description: string;
  propertyIds?: string[];
  /** Detalles extra (ej. resumen de intercambio, buildKind, undo references). */
  metadata?: Record<string, unknown>;
}
