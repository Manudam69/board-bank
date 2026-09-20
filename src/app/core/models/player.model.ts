export interface PlayerProperty {
  propertyId: string;
  /** 0..4. Si es 4 y hasHotel es true, se interpreta como hotel. */
  houses: number;
  hasHotel: boolean;
  mortgaged: boolean;
}

export interface Player {
  id: string;
  name: string;
  avatarColor: string;
  cash: number;
  properties: PlayerProperty[];
  bankrupt: boolean;
  /** Quien creó la sala; solo el host puede empezar/terminar y editar opciones. */
  host: boolean;
  joinedAt: number;
}
