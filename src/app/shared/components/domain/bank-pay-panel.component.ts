import { Component, computed, inject, input, model, output, signal } from '@angular/core';
import type { CurrencyConfig, Edition, Player } from '../../../core/models';
import { AmountInputComponent } from '../ui/amount-input.component';
import { ButtonComponent } from '../ui/button.component';
import { MoneyFormatService } from '../../../core/services/money-format.service';
import { ICONS } from '../../icons';

@Component({
  selector: 'app-bank-pay-panel',
  imports: [AmountInputComponent, ButtonComponent],
  templateUrl: './bank-pay-panel.component.html',
})
export class BankPayPanelComponent {
  protected readonly formatter = inject(MoneyFormatService);

  readonly players = input.required<Player[]>();
  readonly currency = input.required<CurrencyConfig>();
  readonly edition = input.required<Edition>();
  readonly amount = model(0);
  readonly reason = model('');
  readonly payAction = output<{ toId: string; amount: number; reason: string }>();

  protected readonly icons = ICONS;
  protected readonly toId = signal<string | undefined>(undefined);

  protected eligibleTo = computed(() =>
    this.players().filter((p) => !p.bankrupt),
  );

  protected amountChips = computed(() => {
    const edition = this.edition();
    const values = [edition.goSalary, edition.jailFine, edition.incomeTax, edition.luxuryTax].filter(
      (v): v is number => typeof v === 'number' && v > 0,
    );
    const unique = Array.from(new Set(values));
    return unique.sort((a, b) => b - a).slice(0, 4);
  });

  protected selectedTo = computed(() => {
    const id = this.toId();
    if (!id) return undefined;
    return this.players().find((p) => p.id === id);
  });

  protected finalBalance = computed(() => {
    const player = this.selectedTo();
    if (!player) return this.amount();
    return player.cash + this.amount();
  });

  protected canSubmit = computed(() => this.amount() > 0 && !!this.toId());

  protected onReasonInput(value: string): void {
    this.reason.set(value);
  }

  protected selectTo(id: string): void {
    this.toId.set(id);
  }

  protected toggleAmountChip(value: number): void {
    if (this.amount() === value) {
      this.amount.set(0);
    } else {
      this.amount.set(value);
    }
  }

  submit(): void {
    const to = this.toId();
    if (!to) return;
    this.payAction.emit({
      toId: to,
      amount: this.amount(),
      reason: this.reason() || 'Pago del Banco',
    });
    this.amount.set(0);
    this.reason.set('');
    this.toId.set(undefined);
  }
}
