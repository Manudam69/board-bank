import { Component, input, output } from '@angular/core';
import { ButtonComponent } from '../ui/button.component';

export type BankAction = 'transfer' | 'buy' | 'rent' | 'mortgage' | 'unmortgage' | 'build' | 'trade';

@Component({
  selector: 'app-bank-actions-bar',
  standalone: true,
  imports: [ButtonComponent],
  templateUrl: './bank-actions-bar.component.html',
})
export class BankActionsBarComponent {
  readonly action = output<BankAction>();
}
