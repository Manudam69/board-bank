import {
  Component,
  computed,
  effect,
  input,
  output,
  signal,
} from '@angular/core';
import type { CurrencyConfig, Edition, Player, PropertyMetadata } from '../../../core/models';
import { unmortgageCost } from '../../../core/services/property.service';
import { BalanceComponent } from '../../components/ui/balance.component';
import { ButtonComponent } from '../../components/ui/button.component';
import { MoneyPipe } from '../../pipes/money.pipe';

export type MortgageActionKind = 'mortgage' | 'unmortgage';

export interface MortgagePanelAction {
  kind: MortgageActionKind;
  propertyId: string;
}

interface MortgageItem {
  meta: PropertyMetadata;
  owned: import('../../../core/models').PlayerProperty;
  kind: MortgageActionKind | null;
  amount: number;
  available: boolean;
  blockedReason: string | null;
  mortgaged: boolean;
  hasBuildings: boolean;
  buildingLabel: string | null;
}

@Component({
  selector: 'app-mortgage-panel',
  imports: [BalanceComponent, ButtonComponent, MoneyPipe],
  templateUrl: './mortgage-panel.component.html',
})
export class MortgagePanelComponent {
  readonly edition = input.required<Edition>();
  readonly me = input.required<Player>();
  readonly currency = input.required<CurrencyConfig>();
  readonly busy = input(false);

  readonly action = output<MortgagePanelAction>();

  protected readonly pulsePropertyId = signal<string | null>(null);

  constructor() {
    effect(() => {
      if (this.pulsePropertyId()) {
        setTimeout(() => this.pulsePropertyId.set(null), 600);
      }
    });
  }

  protected summary = computed(() => {
    const properties = this.me().properties;
    const mortgaged = properties.filter((p) => p.mortgaged).length;
    return {
      total: properties.length,
      mortgaged,
    };
  });

  protected items = computed(() => {
    const edition = this.edition();
    const me = this.me();
    const metaMap = new Map(edition.properties.map((p) => [p.id, p]));

    const all = me.properties.map((owned) => {
      const meta = metaMap.get(owned.propertyId);
      if (!meta) return null;

      const mortgaged = owned.mortgaged;
      const hasBuildings = owned.houses > 0 || owned.hasHotel;

      let kind: MortgageActionKind | null = null;
      let amount = 0;
      let available = false;
      let blockedReason: string | null = null;

      if (mortgaged) {
        kind = 'unmortgage';
        amount = unmortgageCost(meta);
        if (me.cash >= amount) {
          available = true;
        } else {
          blockedReason = 'Dinero insuficiente';
        }
      } else if (hasBuildings) {
        kind = null;
        amount = meta.mortgageValue;
        available = false;
        blockedReason = 'Vende primero las construcciones';
      } else {
        kind = 'mortgage';
        amount = meta.mortgageValue;
        available = true;
      }

      const buildingLabel = this.buildingLabel(owned);

      return {
        meta,
        owned,
        kind,
        amount,
        available,
        blockedReason,
        mortgaged,
        hasBuildings,
        buildingLabel,
      } satisfies MortgageItem;
    });

    const valid = all.filter((item): item is MortgageItem => !!item);

    valid.sort((a, b) => {
      const score = (item: MortgageItem) => {
        if (item.available) return 0;
        if (item.mortgaged && item.blockedReason) return 1;
        if (item.hasBuildings) return 2;
        return 3;
      };
      const diff = score(a) - score(b);
      if (diff !== 0) return diff;
      return a.meta.order - b.meta.order;
    });

    return valid;
  });

  protected hasAvailable = computed(() => this.items().some((item) => item.available));
  protected hasBlocked = computed(() => this.items().some((item) => !item.available));

  protected runAction(item: MortgageItem): void {
    if (this.busy() || !item.available || !item.kind) return;
    this.pulsePropertyId.set(item.meta.id);
    this.action.emit({ kind: item.kind, propertyId: item.meta.id });
  }

  protected ariaLabel(item: MortgageItem): string {
    const name = item.meta.name;
    const amountText = this.format(item.amount);
    if (item.kind === 'mortgage') {
      return `Hipotecar ${name} por ${amountText}`;
    }
    if (item.kind === 'unmortgage') {
      if (item.blockedReason) {
        return `Deshipotecar ${name}: ${item.blockedReason}`;
      }
      return `Deshipotecar ${name} por ${amountText}`;
    }
    return `${name}: ${item.blockedReason ?? 'No disponible'}`;
  }

  protected format(amount: number): string {
    return this.currency().symbol + amount.toLocaleString('es-ES');
  }

  private buildingLabel(owned: import('../../../core/models').PlayerProperty): string | null {
    if (owned.hasHotel) return 'Hotel';
    if (owned.houses > 0) return `${owned.houses} casa${owned.houses > 1 ? 's' : ''}`;
    return null;
  }
}
