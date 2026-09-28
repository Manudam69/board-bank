import { Component, computed, effect, inject, input, linkedSignal, output, signal } from '@angular/core';
import type { CurrencyConfig, Edition, Player, PropertyMetadata } from '../../../core/models';
import {
  BuildingRulesService,
  type BuildingAction,
  type BuildingActionId,
  type GroupBuildingState,
} from '../../../core/services/building-rules.service';
import { BalanceComponent } from '../../components/ui/balance.component';
import { ButtonComponent } from '../../components/ui/button.component';
import { MoneyPipe } from '../../pipes/money.pipe';
import { RearrangePanelComponent } from './rearrange-panel.component';

export type BuildManagerAction =
  | { kind: 'build-house'; propertyId: string }
  | { kind: 'build-hotel'; propertyId: string }
  | { kind: 'sell-house'; propertyId: string }
  | { kind: 'sell-hotel'; propertyId: string }
  | { kind: 'rearrange'; distribution: Record<string, number> };

export interface PropertyCard {
  meta: PropertyMetadata;
  level: number;
  owned?: import('../../../core/models').PlayerProperty;
  isEntry: boolean;
  primaryAction?: BuildingAction;
  sellAction?: BuildingAction;
}

@Component({
  selector: 'app-build-manager',
  imports: [BalanceComponent, ButtonComponent, MoneyPipe, RearrangePanelComponent],
  templateUrl: './build-manager.component.html',
})
export class BuildManagerComponent {
  private readonly rules = inject(BuildingRulesService);

  readonly edition = input.required<Edition>();
  readonly me = input.required<Player>();
  readonly currency = input.required<CurrencyConfig>();
  readonly initialPropertyId = input<string | undefined>(undefined);
  readonly busy = input(false);

  readonly action = output<BuildManagerAction>();

  protected readonly groups = computed(() => this.rules.getPlayerGroups(this.me(), this.edition()));

  private readonly selectionSource = computed(() => ({
    groups: this.groups(),
    initialId: this.initialPropertyId(),
  }));

  protected readonly selectedGroupId = linkedSignal<
    { groups: GroupBuildingState[]; initialId: string | undefined },
    string
  >({
    source: this.selectionSource,
    computation: (source, previous) => {
      const { groups, initialId } = source;
      const entryChanged = previous !== undefined && previous.source.initialId !== initialId;

      if (entryChanged && initialId) {
        const initialGroup = this.edition().properties.find((p) => p.id === initialId)?.group;
        if (initialGroup && groups.some((g) => g.group === initialGroup)) return initialGroup;
      }

      const current = previous?.value;
      if (current && groups.some((g) => g.group === current)) {
        return current;
      }

      if (initialId) {
        const initialGroup = this.edition().properties.find((p) => p.id === initialId)?.group;
        if (initialGroup && groups.some((g) => g.group === initialGroup)) return initialGroup;
      }

      return groups[0]?.group ?? '';
    },
  });

  protected readonly selectedGroup = computed(() => {
    const id = this.selectedGroupId();
    if (!id) return undefined;
    return this.rules.getGroupState(this.me(), this.edition(), id);
  });

  protected readonly distribution = computed(() => {
    const group = this.selectedGroup();
    if (!group) return [];
    return group.properties.map((p) => (p.level === 5 ? 'H' : p.level));
  });

  protected readonly laggingIds = computed(() => {
    const group = this.selectedGroup();
    if (!group || !group.canBuild) return new Set<string>();
    const min = Math.min(...group.properties.map((p) => p.level));
    return new Set(group.properties.filter((p) => p.level === min).map((p) => p.meta.id));
  });

  protected readonly hasLagging = computed(() => {
    const group = this.selectedGroup();
    if (!group) return false;
    return this.laggingIds().size > 0 && this.laggingIds().size < group.properties.length;
  });

  protected isLagging(propertyId: string): boolean {
    return this.hasLagging() && this.laggingIds().has(propertyId);
  }

  protected readonly propertyCards = computed(() => {
    const group = this.selectedGroup();
    if (!group) return [];
    const entryId = this.initialPropertyId();

    return group.properties.map((state) => {
      let primaryAction: BuildingAction | undefined;
      let sellAction: BuildingAction | undefined;

      if (group.canBuild) {
        const actions = this.rules.getAvailableActions(this.me(), this.edition(), state.meta.id);
        const buildHouse = actions.find((a) => a.id === 'build-house');
        const buildHotel = actions.find((a) => a.id === 'build-hotel');
        const sellHouse = actions.find((a) => a.id === 'sell-house');
        const sellHotel = actions.find((a) => a.id === 'sell-hotel');

        if (state.level < 4) primaryAction = buildHouse;
        else if (state.level === 4) primaryAction = buildHotel;

        if (state.level === 5) sellAction = sellHotel;
        else sellAction = sellHouse;
      }

      return {
        meta: state.meta,
        level: state.level,
        owned: state.owned,
        isEntry: state.meta.id === entryId,
        primaryAction,
        sellAction,
      } satisfies PropertyCard;
    });
  });

  protected readonly canRearrange = computed(() => {
    const group = this.selectedGroup();
    if (!group) return { available: false, reason: '' };
    return this.rules.canRearrange(this.me(), this.edition(), group.group);
  });

  protected readonly rearrangeMode = signal(false);
  protected readonly pulsePropertyId = signal<string | null>(null);

  constructor() {
    effect(() => {
      if (this.pulsePropertyId()) {
        setTimeout(() => this.pulsePropertyId.set(null), 600);
      }
    });
  }

  protected selectGroup(group: string): void {
    this.selectedGroupId.set(group);
    this.rearrangeMode.set(false);
  }

  protected runAction(
    propertyId: string,
    kind: 'build-house' | 'build-hotel' | 'sell-house' | 'sell-hotel',
  ): void {
    if (this.busy()) return;
    this.pulsePropertyId.set(propertyId);
    this.action.emit({ kind, propertyId });
  }

  protected enterRearrange(): void {
    this.rearrangeMode.set(true);
  }

  protected exitRearrange(): void {
    this.rearrangeMode.set(false);
  }

  protected onRearrangeApply(distribution: Record<string, number>): void {
    this.action.emit({ kind: 'rearrange', distribution });
  }

  protected pips(level: number): number[] {
    return level <= 0 ? [] : Array.from({ length: level }, (_, i) => i);
  }

  protected levelLabel(level: number): string {
    if (level === 5) return 'Hotel';
    if (level === 0) return 'Sin casas';
    return `${level} casa${level > 1 ? 's' : ''}`;
  }

  protected ariaLabelFor(action: BuildingAction, propertyName: string): string {
    if (action.id === 'build-house') return `Construir casa en ${propertyName} por ${this.format(action.cost ?? 0)}`;
    if (action.id === 'build-hotel') return `Construir hotel en ${propertyName} por ${this.format(action.cost ?? 0)}`;
    if (action.id === 'sell-house') return `Vender casa de ${propertyName} por ${this.format(action.refund ?? 0)}`;
    if (action.id === 'sell-hotel') return `Vender hotel de ${propertyName} por ${this.format(action.refund ?? 0)}`;
    return action.label;
  }

  protected buildSubject(id: BuildingActionId): string {
    return id === 'build-hotel' ? 'Hotel' : 'Casa';
  }

  protected sellSubject(id: BuildingActionId): string {
    return id === 'sell-hotel' ? 'Hotel' : 'Casa';
  }

  private format(amount: number): string {
    return amount.toLocaleString('es-ES');
  }
}
