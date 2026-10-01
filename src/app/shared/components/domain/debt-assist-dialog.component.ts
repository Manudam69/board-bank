import {
  Component,
  computed,
  effect,
  inject,
  input,
  model,
  output,
  signal,
} from '@angular/core';
import { ButtonComponent } from '../../components/ui/button.component';
import { MoneyPipe } from '../../pipes/money.pipe';
import { ICONS } from '../../icons';
import type { CurrencyConfig, Edition, Player } from '../../../core/models';
import { DebtAssistanceService, type DebtPayment } from '../../../core/services/debt-assistance.service';
import type { EvaluatedDebtAction } from '../../../core/services/liquidation.service';

interface SellPropertyPlan {
  propertyId: string;
  propertyName: string;
  group: string;
  groupColor: string;
  currentLevel: number;
  proposedLevel: number;
  actions: EvaluatedDebtAction[];
  selectedCount: number;
  selectedRecovery: number;
  nextAction?: EvaluatedDebtAction;
  restriction?: string;
}

interface SellGroupPlan {
  group: string;
  label: string;
  color: string;
  properties: SellPropertyPlan[];
  selectedRecovery: number;
  maxRecovery: number;
  totalBuildings: number;
}

@Component({
  selector: 'app-debt-assist-dialog',
  imports: [ButtonComponent, MoneyPipe],
  templateUrl: './debt-assist-dialog.component.html',
})
export class DebtAssistDialogComponent {
  private readonly debtService = inject(DebtAssistanceService);

  readonly open = input.required<boolean>();
  readonly me = input.required<Player>();
  readonly edition = input.required<Edition>();
  readonly currency = input.required<CurrencyConfig>();
  /** Pago pendiente. Si no se proporciona, el diálogo opera en modo "recuperación". */
  readonly payment = input<DebtPayment | undefined>(undefined);
  readonly busy = input(false);

  readonly applyAction = output<string[]>();
  readonly bankruptcyAction = output<void>();
  readonly closeAction = output<void>();

  protected readonly icons = ICONS as Record<string, string>;
  protected readonly selectedIds = model<Set<string>>(new Set());
  protected readonly expandedGroups = signal<Set<string>>(new Set());
  private initialized = false;

  readonly paymentAmount = computed(() => this.payment()?.amount ?? 0);
  readonly isRecoveryOnly = computed(() => !this.payment());
  readonly shortfall = computed(() =>
    this.debtService.calculateShortfall(this.paymentAmount(), this.me().cash),
  );

  readonly options = computed(() =>
    this.debtService.getLiquidationOptions(this.me(), this.edition(), this.selectedIds()),
  );

  readonly sellActions = computed(() => this.options().sellActions);
  readonly mortgageActions = computed(() => this.options().mortgageActions);
  readonly blockedMortgages = computed(() => this.options().blockedMortgages);
  readonly maxRecovery = computed(() => this.options().totalRecovery);
  readonly selectedRecovery = computed(() => this.options().selectedRecovery);

  readonly hasSellActions = computed(() => this.sellActions().length > 0);
  readonly hasMortgageActions = computed(() => this.mortgageActions().length > 0);
  readonly hasBlockedMortgages = computed(() => this.blockedMortgages().length > 0);

  readonly sellRecovery = computed(() =>
    this.sellActions().reduce((sum, a) => sum + (a.selected ? a.amount : 0), 0),
  );
  readonly mortgageRecovery = computed(() =>
    this.mortgageActions().reduce((sum, a) => sum + (a.selected ? a.amount : 0), 0),
  );

  readonly maxSellRecovery = computed(() => this.sellActions().reduce((sum, action) => sum + action.amount, 0));
  readonly maxMortgageRecovery = computed(() => Math.max(0, this.maxRecovery() - this.maxSellRecovery()));

  readonly sellGroups = computed<SellGroupPlan[]>(() => {
    const actionsByProperty = new Map<string, EvaluatedDebtAction[]>();
    for (const action of this.sellActions()) {
      const actions = actionsByProperty.get(action.propertyId) ?? [];
      actions.push(action);
      actionsByProperty.set(action.propertyId, actions);
    }

    const groups = new Map<string, SellPropertyPlan[]>();
    for (const [propertyId, actions] of actionsByProperty) {
      const meta = this.edition().properties.find((property) => property.id === propertyId);
      if (!meta) continue;

      const current = this.me().properties.find((property) => property.propertyId === propertyId);
      const selected = actions.filter((action) => action.selected);
      const selectedCount = selected.length;
      const currentLevel = current?.hasHotel ? 5 : (current?.houses ?? 0);
      const proposedLevel = Math.max(0, currentLevel - selectedCount);
      const nextAction = actions.find((action) => !action.selected && action.available);
      const firstBlocked = actions.find((action) => !action.selected && !action.available);
      const propertyPlan: SellPropertyPlan = {
        propertyId,
        propertyName: meta.name,
        group: meta.group,
        groupColor: meta.groupColor,
        currentLevel,
        proposedLevel,
        actions,
        selectedCount,
        selectedRecovery: selected.reduce((sum, action) => sum + action.amount, 0),
        nextAction,
        restriction: firstBlocked?.reason,
      };
      const properties = groups.get(meta.group) ?? [];
      properties.push(propertyPlan);
      groups.set(meta.group, properties);
    }

    return [...groups.entries()].map(([group, properties]) => ({
      group,
      label: this.groupLabel(group),
      color: properties[0]?.groupColor ?? '#000000',
      properties,
      selectedRecovery: properties.reduce((sum, property) => sum + property.selectedRecovery, 0),
      maxRecovery: properties.reduce(
        (sum, property) => sum + property.actions.reduce((propertySum, action) => propertySum + action.amount, 0),
        0,
      ),
      totalBuildings: properties.reduce((sum, property) => sum + property.currentLevel, 0),
    }));
  });

  readonly totalAvailable = computed(() => this.me().cash + this.selectedRecovery());
  readonly remainingCash = computed(() => this.totalAvailable() - this.paymentAmount());
  readonly canPay = computed(() => this.totalAvailable() >= this.paymentAmount());
  readonly remainingShortfall = computed(() => Math.max(0, this.paymentAmount() - this.totalAvailable()));

  readonly headerTitle = computed(() => {
    if (this.isRecoveryOnly()) return 'Recuperar efectivo';
    const shortfall = this.shortfall();
    return shortfall > 0 ? `Necesitas cubrir ${this.format(shortfall)}` : 'Deuda cubierta';
  });

  readonly contextLabel = computed(() => {
    const p = this.payment();
    if (!p) return 'Liquidación de activos';
    return p.label;
  });

  constructor() {
    effect(() => {
      const isOpen = this.open();
      if (isOpen && !this.initialized) {
        this.initialized = true;
        this.suggestPlan();
      }
      if (!isOpen) {
        this.initialized = false;
      }
    });

    effect(() => {
      // Cuando cambia el jugador/room, cualquier selección inválida se descarta
      // automáticamente porque options() se recalcula y selectedRecovery baja.
      // No hace falta mutar selectedIds aquí; la UI simplemente mostrará
      // acciones inválidas como no disponibles.
      this.options();
    });
  }

  private suggestPlan(): void {
    const plan = this.debtService.buildSuggestedPlan(this.paymentAmount(), this.me(), this.edition());
    this.selectedIds.set(new Set(plan.suggestedActionIds));
  }

  private format(amount: number): string {
    return amount.toLocaleString('es-ES');
  }

  protected reasonId(id: string): string {
    return `reason-${id.replace(/:/g, '-')}`;
  }

  protected actionLabel(action: EvaluatedDebtAction): string {
    switch (action.type) {
      case 'sell-hotel':
        return 'Hotel';
      case 'sell-house': {
        const count = action.id.split(':').pop();
        return count ? `Casa #${count}` : 'Casa';
      }
      default:
        return '';
    }
  }

  protected levelLabel(level: number): string {
    if (level === 5) return 'Hotel';
    if (level === 0) return 'Sin edificios';
    return `${level} ${level === 1 ? 'casa' : 'casas'}`;
  }

  protected groupLabel(group: string): string {
    return group.charAt(0).toUpperCase() + group.slice(1);
  }

  protected adjustSell(property: SellPropertyPlan, increase: boolean): void {
    if (increase) {
      if (property.nextAction) this.toggleSell(property.nextAction);
      return;
    }

    const selected = [...property.actions].reverse().find((action) => action.selected);
    if (selected) this.toggleSell(selected);
  }

  protected isGroupExpanded(group: string): boolean {
    return this.expandedGroups().has(group);
  }

  protected toggleGroup(group: string): void {
    this.expandedGroups.update((groups) => {
      const next = new Set(groups);
      if (next.has(group)) next.delete(group);
      else next.add(group);
      return next;
    });
  }

  protected toggleSell(action: EvaluatedDebtAction): void {
    if (!action.available && !action.selected) return;
    this.toggle(action.id);
  }

  protected toggleMortgage(action: EvaluatedDebtAction): void {
    if (!action.available && !action.selected) return;
    this.toggle(action.id);
  }

  private toggle(id: string): void {
    this.selectedIds.update((set) => {
      const next = new Set(set);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  protected apply(): void {
    const selected = this.options().sellActions
      .filter((a) => a.selected)
      .map((a) => a.id)
      .concat(this.options().mortgageActions.filter((a) => a.selected).map((a) => a.id));

    if (selected.length === 0) return;
    this.applyAction.emit(selected);
  }

  protected requestBankruptcy(): void {
    this.bankruptcyAction.emit();
  }

  protected close(): void {
    this.closeAction.emit();
  }
}
