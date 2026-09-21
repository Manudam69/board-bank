export type CurrencyScale = 'units' | 'thousands' | 'millions' | 'billions' | 'trillions';

export interface CurrencyConfig {
  symbol: string;
  code: string;
  scale: CurrencyScale;
}

export interface PropertyMetadata {
  id: string;
  name: string;
  group: string;
  groupColor: string;
  order: number;
  price: number;
  mortgageValue: number;
  houseCost: number;
  hotelCost: number;
  /** base, 1casa, 2casas, 3casas, 4casas, hotel */
  rents: [number, number, number, number, number, number];
  /** Si es ferrocarril, la lógica de alquiler usa multiplicador por cantidad de ferrocarriles */
  isRailroad?: boolean;
  /** Si es servicio, la lógica usa dados multiplicado por factor según servicios poseídos */
  isUtility?: boolean;
}

export interface Edition {
  id: string;
  name: string;
  description?: string;
  currency: CurrencyConfig;
  startingMoney: number;
  goSalary: number;
  jailFine: number;
  incomeTax: number;
  luxuryTax: number;
  properties: PropertyMetadata[];
  /** true si el usuario puede modificar/eliminar esta edición */
  isCustom?: boolean;
  /** clave para identificar ediciones predefinidas de solo lectura */
  readonly?: boolean;
}
