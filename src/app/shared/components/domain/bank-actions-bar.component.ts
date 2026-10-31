import { Component, ElementRef, inject, output, signal } from '@angular/core';
import { ICONS } from '../../icons';

export type BankAction = 'transfer' | 'bank-payment' | 'buy' | 'rent' | 'mortgage' | 'build' | 'trade';

interface ActionItem {
  id: BankAction;
  label: string;
  short: string;
  icon: string;
}

const ACTIONS: ActionItem[] = [
  { id: 'rent', label: 'Pagar renta', short: 'Renta', icon: ICONS['banknote'] },
  { id: 'transfer', label: 'Transferir', short: 'Transferir', icon: ICONS['send'] },
  { id: 'bank-payment', label: 'Pagar del Banco', short: 'Banco', icon: ICONS['circle-dollar-sign'] },
  { id: 'buy', label: 'Comprar', short: 'Comprar', icon: ICONS['shopping-cart'] },
  { id: 'build', label: 'Construir', short: 'Construir', icon: ICONS['hammer'] },
  { id: 'mortgage', label: 'Hipotecas', short: 'Hipotecas', icon: ICONS['lock'] },
  { id: 'trade', label: 'Intercambiar', short: 'Intercambiar', icon: ICONS['arrow-left-right'] },
];

@Component({
  selector: 'app-bank-actions-bar',
  templateUrl: './bank-actions-bar.component.html',
  host: {
    '(document:click)': 'onDocumentClick($event)',
    '(document:keydown.escape)': 'showMore.set(false)',
  },
})
export class BankActionsBarComponent {
  readonly action = output<BankAction>();
  protected readonly icons = ICONS;
  protected readonly showMore = signal(false);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  /** Phones: four primary actions plus an overflow menu, all in one thumb-reachable row. */
  protected readonly mobileActions = ACTIONS.slice(0, 4);
  protected readonly mobileMoreActions = ACTIONS.slice(4);

  /** Tablet and desktop: highlighted primary action, quick actions and overflow menu. */
  protected readonly primaryAction = ACTIONS[0];
  protected readonly quickActions = ACTIONS.slice(1, 5);
  protected readonly moreActions = ACTIONS.slice(5);

  protected emit(action: BankAction): void {
    this.showMore.set(false);
    this.action.emit(action);
  }

  protected onDocumentClick(event: Event): void {
    if (this.showMore() && !this.host.nativeElement.contains(event.target as Node)) {
      this.showMore.set(false);
    }
  }
}
