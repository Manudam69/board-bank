import { NgTemplateOutlet } from '@angular/common';
import { Component, computed, input, model, output, signal } from '@angular/core';
import type { CurrencyConfig, Edition, Player, PlayerProperty, PropertyMetadata } from '../../../core/models';
import { AmountInputComponent } from '../ui/amount-input.component';
import { ButtonComponent } from '../ui/button.component';
import { MoneyPipe } from '../../pipes/money.pipe';
import { PropertyGroupBarComponent } from '../ui/property-group-bar.component';
import { WizardComponent } from '../ui/wizard.component';
import { ICONS } from '../../icons';

export type TradeStep = 'player' | 'give' | 'receive' | 'review';

export interface TradeProposal {
  toId: string;
  fromCash: number;
  toCash: number;
  fromProperties: string[];
  toProperties: string[];
}

interface TradePropertyOption {
  readonly meta: PropertyMetadata;
  readonly hasBuildings: boolean;
  readonly mortgaged: boolean;
}

interface TradePropertyGroup {
  readonly group: string;
  readonly color: string;
  readonly items: TradePropertyOption[];
}

const STEPS: readonly TradeStep[] = ['player', 'give', 'receive', 'review'];

function stepLabel(step: TradeStep): string {
  switch (step) {
    case 'player':
      return 'Jugador';
    case 'give':
      return 'Tú das';
    case 'receive':
      return 'Recibes';
    case 'review':
      return 'Enviar';
  }
}

@Component({
  selector: 'app-trade-builder',
  imports: [
    AmountInputComponent,
    MoneyPipe,
    NgTemplateOutlet,
    PropertyGroupBarComponent,
    WizardComponent,
  ],
  templateUrl: './trade-builder.component.html',
})
export class TradeBuilderComponent {
  readonly edition = input.required<Edition>();
  readonly me = input.required<Player>();
  readonly players = input.required<Player[]>();
  readonly currency = input.required<CurrencyConfig>();
  readonly proposeAction = output<TradeProposal>();

  protected readonly icons = ICONS as Record<string, string>;
  protected readonly steps = STEPS;

  protected readonly step = signal<TradeStep>('player');
  protected readonly stepLabels = STEPS.map((s) => stepLabel(s));
  protected readonly toId = signal<string | undefined>(undefined);
  protected readonly fromCash = model(0);
  protected readonly toCash = model(0);
  protected readonly fromProperties = model<Set<string>>(new Set());
  protected readonly toProperties = model<Set<string>>(new Set());

  protected readonly stepIndex = computed(() => STEPS.indexOf(this.step()));

  protected readonly eligibleTo = computed(() =>
    this.players().filter((p) => p.id !== this.me().id && !p.bankrupt),
  );

  protected readonly partner = computed(() =>
    this.players().find((p) => p.id === this.toId()),
  );

  protected readonly myPropertyGroups = computed(() =>
    this.groupOptions(this.buildPropertyOptions(this.me().properties)),
  );

  protected readonly partnerPropertyGroups = computed(() => {
    const partner = this.partner();
    return partner ? this.groupOptions(this.buildPropertyOptions(partner.properties)) : [];
  });

  protected readonly fromSelection = computed(() =>
    this.selectedOptions(this.me().properties, this.fromProperties()),
  );

  protected readonly toSelection = computed(() => {
    const partner = this.partner();
    return partner ? this.selectedOptions(partner.properties, this.toProperties()) : [];
  });

  protected readonly isEmpty = computed(
    () =>
      this.fromCash() <= 0 &&
      this.toCash() <= 0 &&
      this.fromProperties().size === 0 &&
      this.toProperties().size === 0,
  );

  protected readonly giveTooMuch = computed(() => this.fromCash() > this.me().cash);
  protected readonly receiveTooMuch = computed(() => {
    const partner = this.partner();
    return !!partner && this.toCash() > partner.cash;
  });

  protected readonly canSubmit = computed(() => {
    const partner = this.partner();
    if (!partner || partner.id === this.me().id) return false;
    if (this.isEmpty()) return false;
    if (this.giveTooMuch() || this.receiveTooMuch()) return false;
    return this.fromCash() >= 0 && this.toCash() >= 0;
  });

  /** Why the offer cannot be sent yet, in plain words. */
  protected readonly blocker = computed(() => {
    const partner = this.partner();
    if (!partner) return 'Elige con quién quieres intercambiar.';
    if (this.isEmpty()) return 'La oferta está vacía. Agrega dinero o propiedades en alguno de los dos lados.';
    if (this.giveTooMuch()) return 'Ofreces más dinero del que tienes.';
    if (this.receiveTooMuch()) return `${partner.name} no tiene tanto dinero.`;
    return null;
  });

  protected goTo(target: TradeStep): void {
    this.step.set(target);
  }

  protected next(): void {
    const target = STEPS[this.stepIndex() + 1];
    if (target) this.goTo(target);
  }

  protected back(): void {
    const target = STEPS[this.stepIndex() - 1];
    if (target) this.goTo(target);
  }

  protected selectTo(id: string): void {
    if (this.toId() !== id) {
      this.toId.set(id);
      this.toProperties.set(new Set());
      this.toCash.set(0);
    }
    this.goTo('give');
  }

  protected toggleFrom(option: TradePropertyOption): void {
    if (option.hasBuildings) return;
    this.fromProperties.set(this.toggled(this.fromProperties(), option.meta.id));
  }

  protected toggleTo(option: TradePropertyOption): void {
    if (option.hasBuildings) return;
    this.toProperties.set(this.toggled(this.toProperties(), option.meta.id));
  }

  protected submit(): void {
    const to = this.toId();
    if (!to || !this.canSubmit()) return;
    this.proposeAction.emit({
      toId: to,
      fromCash: this.fromCash(),
      toCash: this.toCash(),
      fromProperties: Array.from(this.fromProperties()),
      toProperties: Array.from(this.toProperties()),
    });
  }

  protected initials(name: string): string {
    return name.trim().slice(0, 2).toUpperCase() || '?';
  }

  protected propertyCount(player: Player): number {
    return player.properties.length;
  }

  protected stepHint(): string {
    const name = this.partner()?.name ?? '';
    switch (this.step()) {
      case 'player':
        return 'Toca a un jugador y pasamos al siguiente paso.';
      case 'give':
        return `Lo que le entregas a ${name}. Si no das dinero o propiedades, déjalo vacío.`;
      case 'receive':
        return `Lo que te entrega ${name}. Si no pides nada de algo, déjalo vacío.`;
      case 'review':
        return `${name} verá la oferta y podrá aceptarla o rechazarla. No se mueve nada hasta que acepte.`;
    }
  }

  protected stepTitle(step: TradeStep): string {
    switch (step) {
      case 'player':
        return '¿Con quién quieres intercambiar?';
      case 'give':
        return '¿Qué le das tú?';
      case 'receive':
        return '¿Qué quieres recibir?';
      case 'review':
        return 'Revisa tu oferta';
    }
  }

  private toggled(current: Set<string>, id: string): Set<string> {
    const next = new Set(current);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    return next;
  }

  private selectedOptions(properties: PlayerProperty[], selected: Set<string>): TradePropertyOption[] {
    return this.buildPropertyOptions(properties).filter((option) => selected.has(option.meta.id));
  }

  private groupOptions(options: TradePropertyOption[]): TradePropertyGroup[] {
    const groups = new Map<string, TradePropertyGroup>();
    for (const option of options) {
      const existing = groups.get(option.meta.group);
      if (existing) existing.items.push(option);
      else
        groups.set(option.meta.group, {
          group: option.meta.group,
          color: option.meta.groupColor,
          items: [option],
        });
    }
    return Array.from(groups.values());
  }

  private buildPropertyOptions(properties: PlayerProperty[]): TradePropertyOption[] {
    return properties
      .map((pp) => {
        const meta = this.edition().properties.find((p) => p.id === pp.propertyId);
        if (!meta) return null;
        return {
          meta,
          hasBuildings: pp.houses > 0 || pp.hasHotel,
          mortgaged: pp.mortgaged,
        };
      })
      .filter((option): option is TradePropertyOption => !!option);
  }
}
