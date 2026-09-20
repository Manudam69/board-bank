import { Component, computed, input, model, output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import type { CurrencyConfig, Player } from '../../../core/models';
import { AmountInputComponent } from '../ui/amount-input.component';
import { ButtonComponent } from '../ui/button.component';
import { MoneyPipe } from '../../pipes/money.pipe';

@Component({
  selector: 'app-transfer-panel',
  standalone: true,
  imports: [FormsModule, AmountInputComponent, ButtonComponent, MoneyPipe],
  templateUrl: './transfer-panel.component.html',
})
export class TransferPanelComponent {
  readonly me = input.required<Player>();
  readonly players = input.required<Player[]>();
  readonly currency = input.required<CurrencyConfig>();
  readonly amount = model(0);
  readonly reason = model('');
  readonly transferAction = output<{ toId: string | 'bank'; amount: number; reason: string }>();

  protected toId = model<string | undefined>(undefined);

  protected eligibleTo = computed(() => {
    return [
      { id: 'bank' as const, name: 'Banco' },
      ...this.players().filter((p) => p.id !== this.me().id && !p.bankrupt),
    ];
  });

  protected canSubmit = computed(() => {
    return this.amount() > 0 && !!this.toId() && this.me().cash >= this.amount();
  });

  protected submit(): void {
    const to = this.toId();
    if (!to) return;
    this.transferAction.emit({
      toId: to,
      amount: this.amount(),
      reason: this.reason() || 'Transferencia',
    });
    this.amount.set(0);
    this.reason.set('');
    this.toId.set(undefined);
  }
}
