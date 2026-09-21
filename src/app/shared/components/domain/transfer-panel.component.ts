import { Component, computed, inject, input, model, output, signal } from '@angular/core';
import type { CurrencyConfig, Edition, Player } from '../../../core/models';
import { AmountInputComponent } from '../ui/amount-input.component';
import { ButtonComponent } from '../ui/button.component';
import { MoneyFormatService } from '../../../core/services/money-format.service';
import { ICONS } from '../../icons';

@Component({
  selector: 'app-transfer-panel',
  imports: [AmountInputComponent, ButtonComponent],
  templateUrl: './transfer-panel.component.html',
})
export class TransferPanelComponent {
  protected readonly formatter = inject(MoneyFormatService);

  readonly me = input.required<Player>();
  readonly players = input.required<Player[]>();
  readonly currency = input.required<CurrencyConfig>();
  readonly edition = input<Edition | undefined>(undefined);
  readonly amount = model(0);
  readonly reason = model('');
  readonly transferAction = output<{ toId: string | 'bank'; amount: number; reason: string }>();

  protected readonly icons = ICONS;
  protected readonly toId = signal<string | undefined>(undefined);

  protected eligibleTo = computed(() => {
    return [
      { id: 'bank' as const, name: 'Banco', avatarColor: '#64748b' },
      ...this.players()
        .filter((p) => p.id !== this.me().id && !p.bankrupt)
        .map((p) => ({ id: p.id, name: p.name, avatarColor: p.avatarColor })),
    ];
  });

  protected remaining = computed(() => Math.max(0, this.me().cash - this.amount()));

  protected canSubmit = computed(() => {
    return this.amount() > 0 && !!this.toId() && this.me().cash >= this.amount();
  });

  protected onReasonInput(value: string): void {
    this.reason.set(value);
  }

  protected selectTo(id: string): void {
    this.toId.set(id);
  }

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
