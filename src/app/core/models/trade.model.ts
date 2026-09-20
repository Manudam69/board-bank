export interface TradeItems {
  cash: number;
  propertyIds: string[];
}

export type TradeStatus = 'pending' | 'accepted' | 'rejected';

export interface TradeOffer {
  id: string;
  status: TradeStatus;
  fromPlayerId: string;
  toPlayerId: string;
  fromItems: TradeItems;
  toItems: TradeItems;
  createdAt: number;
  resolvedAt?: number;
}
