import { Component, output, signal } from '@angular/core';
import { ICONS } from '../../icons';

export type BankAction = 'transfer' | 'buy' | 'rent' | 'mortgage' | 'unmortgage' | 'build' | 'trade';

interface ActionItem {
  id: BankAction;
  label: string;
  icon: string;
  primary?: boolean;
}

const ACTIONS: ActionItem[] = [
  { id: 'transfer', label: 'Transferir', icon: ICONS['send'], primary: true },
  { id: 'buy', label: 'Comprar', icon: ICONS['shopping-cart'] },
  { id: 'rent', label: 'Alquiler', icon: ICONS['banknote'] },
  { id: 'build', label: 'Construir', icon: ICONS['hammer'] },
  { id: 'mortgage', label: 'Hipotecar', icon: ICONS['lock'] },
  { id: 'unmortgage', label: 'Deshipotecar', icon: ICONS['lock-open'] },
  { id: 'trade', label: 'Intercambiar', icon: ICONS['arrow-left-right'] },
];

@Component({
  selector: 'app-bank-actions-bar',
  standalone: true,
  templateUrl: './bank-actions-bar.component.html',
})
export class BankActionsBarComponent {
  readonly action = output<BankAction>();
  protected readonly icons = ICONS;
  protected readonly showMore = signal(false);
  protected readonly primaryAction = ACTIONS[0];
  protected readonly quickActions = ACTIONS.slice(1, 4);
  protected readonly moreActions = ACTIONS.slice(4);

  protected emit(action: BankAction): void {
    this.showMore.set(false);
    this.action.emit(action);
  }
}
