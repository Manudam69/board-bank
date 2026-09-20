import { Component, output, signal } from '@angular/core';
import { ButtonComponent } from '../ui/button.component';

export type BankAction = 'transfer' | 'buy' | 'rent' | 'mortgage' | 'unmortgage' | 'build' | 'trade';

interface ActionItem {
  id: BankAction;
  label: string;
  icon: string;
  primary?: boolean;
}

const ACTIONS: ActionItem[] = [
  { id: 'transfer', label: 'Transferir', icon: 'M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4', primary: true },
  { id: 'buy', label: 'Comprar', icon: 'M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z', primary: true },
  { id: 'rent', label: 'Alquiler', icon: 'M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z', primary: true },
  { id: 'build', label: 'Construir', icon: 'M3 21h18M5 21V7l8-4 8 4v14M8 21v-9a2 2 0 012-2h4a2 2 0 012 2v9', primary: true },
  { id: 'mortgage', label: 'Hipotecar', icon: 'M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z' },
  { id: 'unmortgage', label: 'Deshipotecar', icon: 'M8 11V7a4 4 0 118 0m-4 8v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2z' },
  { id: 'trade', label: 'Intercambiar', icon: 'M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4' },
];

@Component({
  selector: 'app-bank-actions-bar',
  standalone: true,
  imports: [ButtonComponent],
  templateUrl: './bank-actions-bar.component.html',
})
export class BankActionsBarComponent {
  readonly action = output<BankAction>();
  protected readonly showMore = signal(false);
  protected readonly primaryActions = ACTIONS.filter((a) => a.primary);
  protected readonly secondaryActions = ACTIONS.filter((a) => !a.primary);

  protected emit(action: BankAction): void {
    this.showMore.set(false);
    this.action.emit(action);
  }
}
